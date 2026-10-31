// 투자 부서: 종목 찾기, 공급자(none·sample·stockview), 기본값, 구형 데이터 경고, 시장 구분(market_type) 라우팅.
// StockView는 가짜 서버(fetchImpl)로 대신한다. 실제 StockView·AI 호출 없음.

import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { handleUpdate } from './approval.js'
import { investBrief, investChartSummary, investDisclosures, investNews, investQuote } from './depts/invest/tools.js'
import { NOT_CONNECTED, currentProvider, setInvestProvider } from './depts/invest/providers/index.js'
import { createSampleProvider } from './depts/invest/providers/sample.js'
import { createStockviewProvider, parseKrTime } from './depts/invest/providers/stockview.js'
import { resolveSymbol } from './depts/invest/resolve.js'
import { freshnessWarning, kstLabel, SAMPLE_MARK, UNKNOWN_TIME_WARNING } from './depts/invest/format.js'
import { buildSystemPrompt, setAnthropicClient } from './planner.js'
import { loadRules } from './rules.js'
import { fakeAnthropic, installFakes, message } from './testkit.js'
import { validatePlan } from './validator.js'

const HOUR = 60 * 60 * 1000
let fake
let sv
let updateId = 12000
beforeEach(() => {
  fake = installFakes()
  sv = fakeStockview()
  setInvestProvider(createStockviewProvider('https://sv.test/', { fetchImpl: sv.fetch }))
})

// 가짜 StockView 서버. data를 바꿔 상황을 만든다. paths에 요청 주소가 쌓인다.
function fakeStockview() {
  const now = Date.now()
  const data = {
    stocks: [
      { ticker: 'AAPL', name: 'Apple Inc.', name_ko: '애플', price: 271.3, change_pct: 1.21, volume: 52_300_000, week52_high: 288.6, week52_low: 169.2, pe: 36.2 },
      { ticker: 'NVDA', name: 'NVIDIA Corp.', name_ko: '엔비디아', price: 186.4, change_pct: -0.84, volume: 198_000_000, week52_high: 212.2, week52_low: 86.6, pe: 52.8 },
      { ticker: 'GOOGL', name: 'Alphabet Inc. Class A', name_ko: '알파벳A', price: 281.2, change_pct: 0.9, volume: 1, week52_high: 2, week52_low: 1 },
      { ticker: 'GOOG', name: 'Alphabet Inc. Class C', name_ko: '알파벳C', price: 282, change_pct: 0.9, volume: 1, week52_high: 2, week52_low: 1 },
    ],
    kr: [
      { ticker: '005930.KS', code: '005930', name: '삼성전자', price: 98400, change_pct: 1.86, volume: 18_400_000, week52_high: 104200, week52_low: 50800, pe: 21.3, updated_at: Math.round((now - 5 * 60 * 1000) / 1000) },
      { ticker: '005935.KS', code: '005935', name: '삼성전자우', price: 78000, change_pct: 1.1, volume: 1, week52_high: 2, week52_low: 1 },
    ],
    status: { stocks: { age_sec: 120 }, kr_stocks: { age_sec: 120 }, indices: { age_sec: 60 }, fear_greed: { age_sec: 600 }, daily_signals: { age_sec: 3600 }, earnings: { age_sec: 1800 }, kr_disclosures: { age_sec: 300 } },
    chart: null,
    usNews: [{ title: 'Apple hits record', source: 'Reuters', timestamp: Math.round((now - HOUR) / 1000), url: 'u' }],
    krNews: [{ title: '삼성전자, 신제품 공개', source: '연합뉴스', time: '2026.10.31 14:20', url: 'u' }],
    news: [
      { title: 'US market up', source: 'AP', timestamp: Math.round((now - 2 * HOUR) / 1000), market: undefined },
      { title: '코스피 상승', source: '한경', timestamp: Math.round((now - 3 * HOUR) / 1000), market: 'KR' },
    ],
    disclosures: [
      { time: '15:42', company: '삼성전자', title: '기업설명회(IR) 개최', type: '코스피', category: 'IR', link: 'l' },
      { time: '14:10', company: 'SK하이닉스', title: '주요사항보고서', type: '코스피', category: '주요사항', link: 'l' },
    ],
    indices: [
      { name: 'S&P 500', value: 6840.2, change: 1, change_pct: 0.48 },
      { name: 'KOSPI', value: 4107.5, change: 1, change_pct: 1.12 },
    ],
    fearGreed: { score: 58, rating: 'Greed' },
    surges: { us: [{ ticker: 'TSLA', name: '테슬라', change_pct: 2.35, volume_ratio: 2.8 }], kr: [{ ticker: '005930.KS', name: '삼성전자', change_pct: 1.86, volume_ratio: 2.3 }] },
    earnings: [{ symbol: 'AAPL', name: 'Apple', time: 'After Close', date: 'x' }],
    fail: new Set(),
    hang: false,
  }
  const paths = []
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
  const fetch = async (url) => {
    const { pathname, searchParams } = new URL(url)
    paths.push(pathname + (searchParams.toString() ? `?${searchParams}` : ''))
    if (data.hang) throw new Error('aborted')
    if (data.fail.has(pathname)) return json({ error: 'boom' }, 500)
    if (pathname === '/api/cache/status') return json(data.status)
    if (pathname === '/api/stocks') return json(data.stocks)
    if (pathname === '/api/kr-stocks') {
      const q = searchParams.get('q') ?? ''
      return json(data.kr.filter((s) => s.code.includes(q) || s.name.includes(q)))
    }
    if (pathname.startsWith('/api/stock/')) {
      const t = decodeURIComponent(pathname.split('/').pop())
      const row = [...data.stocks, ...data.kr].find((s) => s.ticker === t)
      return row ? json(row) : json({ error: 'Not found' }, 404)
    }
    if (pathname.startsWith('/api/chart/')) return json(data.chart ?? makeBars(64))
    if (pathname.startsWith('/api/stock-news/')) return json(data.usNews)
    if (pathname.startsWith('/api/kr-news/')) return json(data.krNews)
    if (pathname === '/api/news') return json(data.news)
    if (pathname === '/api/kr-disclosures') return json(data.disclosures)
    if (pathname === '/api/indices') return json(data.indices)
    if (pathname === '/api/fear-greed') return json(data.fearGreed)
    if (pathname === '/api/volume-surges') return json(data.surges)
    if (pathname === '/api/earnings') return json(data.earnings)
    return json({ error: 'no route' }, 404)
  }
  return { data, paths, fetch }
}

// 날짜가 오늘까지 이어지는 일봉 n개 (종가 100 → 120, 마지막 5일 거래량 2배)
function makeBars(n, { dummy = false, endDaysAgo = 0 } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(Date.now() - (n - 1 - i + endDaysAgo) * 24 * HOUR).toISOString().slice(0, 10)
    const close = 100 + (20 * i) / (n - 1)
    return { time: date, open: close, high: i === 10 ? 130 : close + 1, low: i === 3 ? 90 : close - 1, close, volume: i >= n - 5 ? 2000 : 1000, ...(dummy ? { _dummy: true } : {}) }
  })
}

const run = (tool, args) => tool.run(args)

test('1. 인자 검사: market_type 필수, 공시는 KR만, 기간은 정해진 값만, 모르는 인자 거부', () => {
  assert.equal(investQuote.check({ symbol: '애플', market_type: 'US' }), null)
  assert.match(investQuote.check({ symbol: '애플' }), /market_type/)
  assert.match(investQuote.check({ symbol: '애플', market_type: 'JP' }), /market_type/)
  assert.match(investQuote.check({ symbol: '', market_type: 'US' }), /symbol/)
  assert.match(investQuote.check({ symbol: 'a', market_type: 'US', extra: 1 }), /모르는 인자/)
  assert.equal(investChartSummary.check({ symbol: 'NVDA', market_type: 'US' }), null, '기간 없이도 통과(기본 3개월)')
  assert.match(investChartSummary.check({ symbol: 'NVDA', market_type: 'US', period: '5y' }), /period/)
  assert.equal(investNews.check({ market_type: 'KR' }), null, '시장 뉴스는 종목 없이')
  assert.equal(investDisclosures.check({ market_type: 'KR', symbol: '삼성전자' }), null)
  assert.match(investDisclosures.check({ market_type: 'US', symbol: 'AAPL' }), /국내\(KR\)만/)
  assert.equal(investBrief.check({}), null)
  assert.match(investBrief.check({ market_type: 'EU' }), /market_type/)
  assert.equal(investChartSummary.describe({ symbol: '엔비디아', market_type: 'US' }), '엔비디아 · 미국 · 3개월(기본값)')
})

test('2. 종목 찾기: 미국은 티커·한글 이름·영문 이름·별칭, 국내는 이름·코드, 여러 개면 후보, 다른 시장으로 바꾸지 않음', async () => {
  const p = currentProvider()
  assert.equal((await resolveSymbol(p, 'US', 'aapl')).found.ticker, 'AAPL')
  assert.equal((await resolveSymbol(p, 'US', '애플')).found.ticker, 'AAPL')
  assert.equal((await resolveSymbol(p, 'US', 'Nvidia')).found.ticker, 'NVDA')
  assert.equal((await resolveSymbol(p, 'US', '구글')).found.ticker, 'GOOGL')
  assert.deepEqual((await resolveSymbol(p, 'US', '알파벳')).candidates.map((c) => c.ticker), ['GOOGL', 'GOOG'])
  assert.equal((await resolveSymbol(p, 'KR', '삼성전자')).found.code, '005930', '정확히 같은 이름이 우선(삼성전자우보다)')
  assert.equal((await resolveSymbol(p, 'KR', '005930')).found.name, '삼성전자')
  assert.ok((await resolveSymbol(p, 'US', '삼성전자')).none)

  const wrong = await run(investQuote, { symbol: '삼성전자', market_type: 'US' })
  assert.match(wrong.summary, /미국 시장에서 '삼성전자'을\(를\) 찾지 못했어요. 국내 종목인가요/)
  const many = await run(investQuote, { symbol: '알파벳', market_type: 'US' })
  assert.match(many.summary, /여러 개예요: 알파벳A\(GOOGL\), 알파벳C\(GOOG\)/)
})

test('3. 시세: 이름(티커)·가격·등락·52주 위치·기준 시각, 새 데이터면 경고 없음', async () => {
  const { summary } = await run(investQuote, { symbol: '애플', market_type: 'US' })
  assert.match(summary, /^애플\(AAPL\) \$271\.3 \(\+1\.21%\) · 기준: \d+\/\d+ \d\d:\d\d/)
  assert.match(summary, /거래량 5,230만/)
  assert.match(summary, /52주 \$169\.2~\$288\.6 중 86% 위치 · PER 36\.2/)
  assert.ok(!summary.includes('⚠️'))
  const kr = await run(investQuote, { symbol: '삼성전자', market_type: 'KR' })
  assert.match(kr.summary, /^삼성전자\(005930\) 98,400원 \(\+1\.86%\)/)
})

test('4. 구형 데이터: 기준 시각이 24시간 이상 지나면 맨 위와 지표 옆에 경고 (시각은 한국 시간)', async () => {
  const old = Date.now() - 30 * HOUR
  sv.data.kr[0].updated_at = Math.round(old / 1000)
  const { summary } = await run(investQuote, { symbol: '삼성전자', market_type: 'KR' })
  const label = kstLabel(Math.round(old / 1000) * 1000)
  const warning = `⚠️ [주의: ${label} 기준 구형 데이터]`
  assert.ok(summary.startsWith(warning), summary)
  assert.ok(summary.includes(`(+1.86%) · ${warning}`))
  assert.match(label, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  // 경계: 23시간 59분은 새 데이터, 24시간은 구형
  assert.equal(freshnessWarning(Date.now() - 24 * HOUR + 60_000), null)
  assert.match(freshnessWarning(Date.now() - 24 * HOUR), /구형 데이터/)
})

test('5. 기준 시각이 없는 데이터(StockView가 코드에 넣어 둔 예전 값) → 확인 불가 경고', async () => {
  delete sv.data.status.stocks
  const { summary } = await run(investQuote, { symbol: 'AAPL', market_type: 'US' })
  assert.ok(summary.startsWith(UNKNOWN_TIME_WARNING))
  sv.data.news = [{ title: 'NVIDIA Surges', source: 'Bloomberg', time: '10m ago' }]
  const news = await run(investNews, { market_type: 'US' })
  assert.ok(news.summary.startsWith(UNKNOWN_TIME_WARNING))
})

test('6. 차트 요약: 기간을 말하지 않으면 3개월(기본값)로 요청, 수익률·최고·최저·거래량 변화', async () => {
  const { summary } = await run(investChartSummary, { symbol: '엔비디아', market_type: 'US' })
  assert.ok(sv.paths.some((p) => p === '/api/chart/NVDA?period=3mo&interval=1d'))
  assert.match(summary, /^엔비디아\(NVDA\) 3개월\(기본값\): \+20\.00% \(\$100 → \$120\)/)
  assert.match(summary, /최고 \$130 \(\d+\/\d+\) · 최저 \$90 \(\d+\/\d+\)/)
  assert.match(summary, /최근 5일 거래량: 기간 평균의 1\.9배/)

  await run(investChartSummary, { symbol: 'NVDA', market_type: 'US', period: '1y' })
  assert.ok(sv.paths.some((p) => p === '/api/chart/NVDA?period=1y&interval=1d'))

  sv.data.chart = makeBars(64, { dummy: true })
  const dummy = await run(investChartSummary, { symbol: 'NVDA', market_type: 'US' })
  assert.match(dummy.summary, /예시 차트를 보냈어요/)
  assert.ok(!/\+20/.test(dummy.summary), '예시 차트의 숫자는 쓰지 않는다')

  sv.data.chart = makeBars(64, { endDaysAgo: 4 })
  const stale = await run(investChartSummary, { symbol: 'NVDA', market_type: 'US' })
  assert.match(stale.summary, /^⚠️ \[주의: .* 기준 구형 데이터\]/)
})

test('7. 뉴스 라우팅: US 종목 → /api/stock-news, KR 종목 → /api/kr-news, 시장 뉴스 → /api/news에서 그 시장만', async () => {
  const us = await run(investNews, { symbol: '애플', market_type: 'US' })
  assert.ok(sv.paths.includes('/api/stock-news/AAPL'))
  assert.ok(!sv.paths.some((p) => p.startsWith('/api/kr-news')))
  assert.match(us.summary, /^애플\(AAPL\) 뉴스 · 최신 1건\n• Apple hits record — Reuters, /)

  sv.paths.length = 0
  const kr = await run(investNews, { symbol: '삼성전자', market_type: 'KR' })
  assert.ok(sv.paths.includes('/api/kr-news/005930'))
  assert.ok(!sv.paths.some((p) => p.startsWith('/api/stock-news')))
  assert.match(kr.summary, /삼성전자, 신제품 공개 — 연합뉴스, 10\/31 14:20/)

  const marketKr = await run(investNews, { market_type: 'KR' })
  assert.match(marketKr.summary, /국내 시장 뉴스 · 최신 1건\n• 코스피 상승/)
  assert.ok(!marketKr.summary.includes('US market up'))
  const marketUs = await run(investNews, { market_type: 'US' })
  assert.ok(marketUs.summary.includes('US market up') && !marketUs.summary.includes('코스피'))
})

test('8. 공시: 오늘 전체 또는 종목만, 기준 시각 표시', async () => {
  const all = await run(investDisclosures, { market_type: 'KR' })
  assert.match(all.summary, /^오늘 국내 공시 2건 · 기준: /)
  const one = await run(investDisclosures, { market_type: 'KR', symbol: '삼성전자' })
  assert.match(one.summary, /^삼성전자\(005930\) 오늘 공시 1건/)
  assert.match(one.summary, /• 15:42 삼성전자 — 기업설명회\(IR\) 개최 \[IR\]/)
  assert.ok(!one.summary.includes('SK하이닉스'))
})

test('9. 시장 브리핑: 지수·공포탐욕·거래량 급증·실적·뉴스, 한 곳이 실패해도 나머지는 보여 주고 전부 실패하면 오류', async () => {
  const both = await run(investBrief, {})
  assert.match(both.summary, /📈 미국·국내 시장 브리핑 \(오늘\)/)
  assert.match(both.summary, /S&P 500 6,840\.2 \(\+0\.48%\) · KOSPI 4,107\.5 \(\+1\.12%\)/)
  assert.match(both.summary, /공포·탐욕 지수 58 \(Greed\)/)
  assert.match(both.summary, /미국: 테슬라\(TSLA\) 평소의 2\.8배, \+2\.35%/)
  assert.match(both.summary, /국내: 삼성전자\(005930\) 평소의 2\.3배/)
  assert.match(both.summary, /오늘 실적 발표\(미국\): AAPL\(After Close\)/)

  const kr = await run(investBrief, { market_type: 'KR' })
  assert.ok(!kr.summary.includes('공포·탐욕') && !kr.summary.includes('S&P 500') && !kr.summary.includes('실적 발표'))

  sv.data.fail.add('/api/fear-greed')
  const partial = await run(investBrief, { market_type: 'US' })
  assert.match(partial.summary, /공포·탐욕 지수: 불러오지 못했어요/)
  assert.match(partial.summary, /S&P 500/)

  for (const path of ['/api/indices', '/api/volume-surges', '/api/earnings', '/api/news']) sv.data.fail.add(path)
  await assert.rejects(() => run(investBrief, { market_type: 'US' }), /StockView 응답 오류 \(500\)/)
})

test('10. 공급자: 연결 전(none)·설정 오류·잠든 서버·예시 데이터', async () => {
  setInvestProvider(null)
  delete process.env.INVEST_PROVIDER
  assert.equal((await run(investQuote, { symbol: 'AAPL', market_type: 'US' })).summary, NOT_CONNECTED)

  process.env.INVEST_PROVIDER = 'stockview'
  delete process.env.STOCKVIEW_URL
  assert.throws(() => currentProvider(), /STOCKVIEW_URL이 비어 있어요/)
  process.env.INVEST_PROVIDER = 'yahoo'
  assert.throws(() => currentProvider(), /모르는 투자 데이터 공급자/)
  process.env.INVEST_PROVIDER = 'sample'
  assert.equal(currentProvider().name, 'sample')
  delete process.env.INVEST_PROVIDER

  sv.data.hang = true
  setInvestProvider(createStockviewProvider('https://sv.test', { fetchImpl: sv.fetch }))
  await assert.rejects(() => run(investQuote, { symbol: 'AAPL', market_type: 'US' }), /잠들어 있으면 깨어나는 데 1분쯤 걸려요/)

  setInvestProvider(createSampleProvider())
  const sample = await run(investQuote, { symbol: '삼성전자', market_type: 'KR' })
  assert.ok(sample.summary.startsWith(SAMPLE_MARK))
  for (const [tool, args] of [[investChartSummary, { symbol: '애플', market_type: 'US' }], [investNews, { market_type: 'KR' }], [investDisclosures, { market_type: 'KR' }], [investBrief, {}]]) {
    const { summary } = await run(tool, args)
    assert.ok(summary.startsWith(SAMPLE_MARK), summary)
    assert.ok(!summary.includes('⚠️ [주의'), '예시 데이터는 최신 시각')
  }
})

test('11. 전체 흐름: "삼성전자 지금 얼마야?" → AI 계획(invest.quote) → 조회만이라 결재 없이 실행 → 텔레그램 보고', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key'
  const client = fakeAnthropic({ summary: '삼성전자 시세 조회 (국내)', steps: [{ tool: 'invest.quote', args: { symbol: '삼성전자', market_type: 'KR' } }] })
  setAnthropicClient(client)
  assert.equal(await handleUpdate(message('삼성전자 지금 얼마야?', { updateId: updateId++ })), 'completed')
  const task = fake.tasks.at(-1)
  assert.equal(task.status, 'COMPLETED')
  assert.ok(task.event_logs.some((e) => e.event === 'AUTO_APPROVED'))
  assert.equal(task.plan_payload.steps[0].dept, 'invest')
  const report = fake.sent.at(-1).text
  assert.match(report, /✅ 완료[\s\S]*1\. 시세 — 삼성전자\(005930\) 98,400원 \(\+1\.86%\)/)
  assert.match(report, /👥 맡는 부서: 투자 부서/)
})

test('12. 규칙서·검증: 프롬프트에 투자 부서 규칙(시장 구분·기본값·추천 금지), 미국 공시 계획은 결재 전에 거부', () => {
  const prompt = buildSystemPrompt(loadRules(), new Date('2026-10-31T08:00:00Z'))
  assert.match(prompt, /# 투자 부서 규칙/)
  assert.match(prompt, /"삼성전자 뉴스" → KR, "애플 뉴스" → US/)
  assert.match(prompt, /기간을 말하지 않으면 `period`를 넣지 않는다/)
  assert.match(prompt, /사라·팔라 같은 판단이나 앞으로의 가격 예측은 하지 않는다/)
  assert.match(prompt, /invest\.quote \(위험도 read, 투자 부서\)/)
  const verdict = validatePlan({ steps: [{ tool: 'invest.disclosures', args: { symbol: 'AAPL', market_type: 'US' }, risk: 'read', dept: 'invest' }] })
  assert.equal(verdict.ok, false)
  assert.match(verdict.errors.join(' '), /국내\(KR\)만/)
})

test('13. 국내 뉴스 시각 읽기: "YYYY.MM.DD HH:MM"·날짜만·알 수 없는 형식', () => {
  assert.equal(parseKrTime('2026.10.31 14:20'), Date.parse('2026-10-31T14:20:00+09:00'))
  assert.equal(parseKrTime('2026.10.31'), Date.parse('2026-10-31T00:00:00+09:00'))
  assert.equal(parseKrTime('10m ago'), null)
})
