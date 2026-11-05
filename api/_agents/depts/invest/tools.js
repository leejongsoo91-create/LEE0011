// 투자 부서 도구 6개 (모두 read: 조회만, 결재 없이 실행). 규칙서: depts/invest/rules.md
//   invest.quote · invest.chart_summary · invest.news · invest.disclosures · invest.brief · invest.report(종목 리포트)
// 데이터는 공급자(providers/)에게만 묻는다. 기본값·구형 데이터 경고·시장 구분은 AI가 아니라 이 코드가 챙긴다.
// 매수·매도 추천이나 가격 예측은 하지 않는다. 데이터만 정리해 보고한다.

import { InvestDataError, NOT_CONNECTED, currentProvider } from './providers/index.js'
import { resolveProblem, resolveSymbol } from './resolve.js'
import { asOfNote, assemble, count, freshnessWarning, kstShort, money, pct } from './format.js'

export const MARKETS = ['US', 'KR']
export const PERIODS = { '1mo': '1개월', '3mo': '3개월', '6mo': '6개월', '1y': '1년', '2y': '2년' }
export const DEFAULT_PERIOD = '3mo'
export const NEWS_LIMIT = 5
export const DISCLOSURE_LIMIT = 10
export const REPORT_NEWS_LIMIT = 3
const MARKET_LABEL = { US: '미국', KR: '국내' }

function onlyKeys(args, allowed) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return '인자가 객체가 아닙니다'
  const unknown = Object.keys(args).filter((key) => !allowed.includes(key))
  return unknown.length ? `모르는 인자: ${unknown.join(', ')}` : null
}
const badSymbol = (value) => typeof value !== 'string' || !value.trim() || value.length > 40
const checkMarket = (value) => (MARKETS.includes(value) ? null : 'market_type은 "US"(미국) 또는 "KR"(국내)이어야 합니다')

const symbolSchema = { type: 'string', description: '캡틴이 말한 그대로의 티커·종목명·종목코드 (예: AAPL, 애플, Nvidia, 삼성전자, 005930). 직접 바꾸지 말 것' }
const marketSchema = { type: 'string', enum: MARKETS, description: 'US(미국) 또는 KR(국내). 종목을 보고 먼저 정한다' }

// 공급자 준비: 연결 전이면 안내 문장으로 끝낸다 (설정이 잘못됐으면 오류)
async function withProvider(work) {
  const provider = currentProvider()
  if (!provider) return { summary: NOT_CONNECTED, connected: false }
  return work(provider)
}

// 종목 찾기 → 못 찾았거나 여러 개면 그 안내를 보고로
async function withSymbol(provider, market, symbol, work) {
  const result = await resolveSymbol(provider, market, symbol)
  const problem = resolveProblem(result, market, symbol)
  if (problem) return { summary: assemble({ sample: provider.sample, lines: [problem] }) }
  return work(result.found)
}

// 차트 막대 → 기간 수익률·최고·최저·최근 5일 거래량 배수 (막대가 2개 미만이면 null)
function chartStats(rawBars) {
  const bars = rawBars.filter((bar) => bar.close != null)
  if (bars.length < 2) return null
  const first = bars[0]
  const last = bars.at(-1)
  const high = bars.reduce((a, b) => ((b.high ?? b.close) > (a.high ?? a.close) ? b : a))
  const low = bars.reduce((a, b) => ((b.low ?? b.close) < (a.low ?? a.close) ? b : a))
  const avg = (list) => list.reduce((sum, bar) => sum + (bar.volume ?? 0), 0) / list.length
  return {
    first,
    last,
    changePct: (last.close / first.close - 1) * 100,
    high: { price: high.high ?? high.close, date: high.date },
    low: { price: low.low ?? low.close, date: low.date },
    volumeRatio: avg(bars) > 0 ? avg(bars.slice(-5)) / avg(bars) : null,
  }
}
const day = (date) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`

// 현재가가 1년(52주) 최저~최고 사이 어디쯤인지 (0~100%)
function yearRange(q, market) {
  if (q.high52 == null || q.low52 == null || !(q.high52 > q.low52)) return null
  const position = Math.round(((q.price - q.low52) / (q.high52 - q.low52)) * 100)
  return { text: `1년 범위 ${money(q.low52, market)}~${money(q.high52, market)} 중 ${position}% 위치`, position }
}

const label = (found) => `${found.name}(${found.market === 'KR' ? found.code : found.ticker})`

export const investQuote = {
  label: '시세',
  risk: 'read',
  description: '종목 1개의 현재가·등락률·거래량·1년(52주) 최고/최저 대비 위치·PER을 기준 시각과 함께 조회한다. 가격만 물었을 때 쓴다.',
  schema: { type: 'object', properties: { symbol: symbolSchema, market_type: marketSchema }, required: ['symbol', 'market_type'] },
  check(args) {
    const keys = onlyKeys(args, ['symbol', 'market_type'])
    if (keys) return keys
    if (badSymbol(args.symbol)) return 'symbol은 1~40자 글자여야 합니다'
    return checkMarket(args.market_type)
  },
  describe: (args) => `${args.symbol} · ${MARKET_LABEL[args.market_type]}`,
  run: (args) =>
    withProvider((provider) =>
      withSymbol(provider, args.market_type, args.symbol, async (found) => {
        const q = await provider.quote(found)
        if (!q || q.price == null) return { summary: assemble({ sample: provider.sample, lines: [`${label(found)} 가격 정보를 받지 못했어요`] }) }
        const warning = freshnessWarning(q.asOf)
        const details = [
          `거래량 ${count(q.volume)}`,
          yearRange(q, found.market)?.text,
          q.pe != null ? `PER ${q.pe.toFixed(1)}` : null,
        ].filter(Boolean)
        return {
          summary: assemble({
            sample: provider.sample,
            warnings: [warning],
            lines: [`${label(found)} ${money(q.price, found.market)} (${pct(q.changePct)}) · ${asOfNote(q.asOf)}`, details.join(' · ')],
          }),
          asOf: q.asOf ?? null,
        }
      }),
    ),
}

export const investChartSummary = {
  label: '차트 요약',
  risk: 'read',
  description: '종목 1개의 기간 수익률, 기간 최고·최저(날짜), 최근 5일 거래량 변화를 요약한다. 기간을 말하지 않으면 3개월.',
  schema: {
    type: 'object',
    properties: {
      symbol: symbolSchema,
      market_type: marketSchema,
      period: { type: 'string', enum: Object.keys(PERIODS), description: '1mo·3mo·6mo·1y·2y. 캡틴이 기간을 말하지 않았으면 넣지 않는다(기본 3mo)' },
    },
    required: ['symbol', 'market_type'],
  },
  check(args) {
    const keys = onlyKeys(args, ['symbol', 'market_type', 'period'])
    if (keys) return keys
    if (badSymbol(args.symbol)) return 'symbol은 1~40자 글자여야 합니다'
    if (args.period != null && !Object.hasOwn(PERIODS, args.period)) return `period는 ${Object.keys(PERIODS).join(', ')} 중 하나여야 합니다`
    return checkMarket(args.market_type)
  },
  describe: (args) => `${args.symbol} · ${MARKET_LABEL[args.market_type]} · ${args.period ? PERIODS[args.period] : `${PERIODS[DEFAULT_PERIOD]}(기본값)`}`,
  run: (args) =>
    withProvider((provider) =>
      withSymbol(provider, args.market_type, args.symbol, async (found) => {
        const period = args.period ?? DEFAULT_PERIOD
        const periodLabel = args.period ? PERIODS[period] : `${PERIODS[period]}(기본값)`
        const chart = await provider.chart(found, period)
        if (chart.dummy) {
          return { summary: `⚠️ StockView가 ${label(found)}의 실제 차트를 받지 못해 예시 차트를 보냈어요. 실제 데이터가 아니라서 숫자는 보여 드리지 않을게요` }
        }
        const stats = chartStats(chart.bars)
        if (!stats) return { summary: assemble({ sample: provider.sample, lines: [`${label(found)} ${periodLabel} 차트 데이터가 없어요`] }) }
        const { first, last, high, low, volumeRatio } = stats
        return {
          summary: assemble({
            sample: provider.sample,
            warnings: [freshnessWarning(chart.asOf)],
            lines: [
              `${label(found)} ${periodLabel}: ${pct(stats.changePct)} (${money(first.close, found.market)} → ${money(last.close, found.market)}) · ${asOfNote(chart.asOf)}`,
              `최고 ${money(high.price, found.market)} (${day(high.date)}) · 최저 ${money(low.price, found.market)} (${day(low.date)})`,
              volumeRatio != null ? `최근 5일 거래량: 기간 평균의 ${volumeRatio.toFixed(1)}배` : null,
            ].filter(Boolean),
          }),
          asOf: chart.asOf ?? null,
        }
      }),
    ),
}

// 뉴스 목록 문장 (최신순, 최대 5건) + 가장 최신 기사 기준 경고
function newsLines(items) {
  const sorted = items.filter((item) => item.title).sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, NEWS_LIMIT)
  const lines = sorted.map((item) => `• ${item.title}${item.source ? ` — ${item.source}` : ''}${item.at ? `, ${kstShort(item.at)}` : ''}`)
  return { lines, newest: sorted[0]?.at ?? null, total: sorted.length }
}

export const investNews = {
  label: '뉴스',
  risk: 'read',
  description: '종목 뉴스(종목을 말했을 때) 또는 그 시장 뉴스를 최신순 최대 5건 조회한다. 날짜를 말하지 않으면 최신.',
  schema: {
    type: 'object',
    properties: { symbol: { ...symbolSchema, description: `${symbolSchema.description}. 시장 전체 뉴스면 넣지 않는다` }, market_type: marketSchema },
    required: ['market_type'],
  },
  check(args) {
    const keys = onlyKeys(args, ['symbol', 'market_type'])
    if (keys) return keys
    if (args.symbol != null && badSymbol(args.symbol)) return 'symbol은 1~40자 글자여야 합니다'
    return checkMarket(args.market_type)
  },
  describe: (args) => (args.symbol ? `${args.symbol} · ${MARKET_LABEL[args.market_type]} · 최신` : `${MARKET_LABEL[args.market_type]} 시장 뉴스 · 최신`),
  run: (args) =>
    withProvider(async (provider) => {
      const report = async (title, items) => {
        const { lines, newest, total } = newsLines(items)
        if (total === 0) return { summary: assemble({ sample: provider.sample, lines: [`${title}: 새 뉴스가 없어요`] }) }
        return {
          summary: assemble({ sample: provider.sample, warnings: [freshnessWarning(newest)], lines: [`${title} · 최신 ${total}건`, ...lines] }),
          asOf: newest,
        }
      }
      if (!args.symbol) return report(`${MARKET_LABEL[args.market_type]} 시장 뉴스`, await provider.news({ market: args.market_type }))
      return withSymbol(provider, args.market_type, args.symbol, async (found) =>
        report(`${label(found)} 뉴스`, await provider.news({ market: found.market, ticker: found.market === 'US' ? found.ticker : null, code: found.code ?? null })),
      )
    }),
}

export const investDisclosures = {
  label: '공시',
  risk: 'read',
  description: '국내(KR) 오늘 공시를 최대 10건 조회한다. 종목을 말하면 그 종목 공시만. 미국 종목은 지원하지 않는다.',
  schema: {
    type: 'object',
    properties: { symbol: { ...symbolSchema, description: '국내 종목명·코드. 오늘 전체 공시면 넣지 않는다' }, market_type: { type: 'string', enum: ['KR'], description: '항상 KR' } },
    required: ['market_type'],
  },
  check(args) {
    const keys = onlyKeys(args, ['symbol', 'market_type'])
    if (keys) return keys
    if (args.symbol != null && badSymbol(args.symbol)) return 'symbol은 1~40자 글자여야 합니다'
    return args.market_type === 'KR' ? null : '공시는 국내(KR)만 지원합니다 (market_type은 "KR")'
  },
  describe: (args) => (args.symbol ? `${args.symbol} 오늘 공시` : '오늘 국내 공시'),
  run: (args) =>
    withProvider(async (provider) => {
      const report = async (title, filter) => {
        const { items, asOf } = await provider.disclosures()
        const picked = items.filter(filter).slice(0, DISCLOSURE_LIMIT)
        if (picked.length === 0) return { summary: assemble({ sample: provider.sample, warnings: [freshnessWarning(asOf)], lines: [`${title}: 없어요 · ${asOfNote(asOf)}`] }) }
        return {
          summary: assemble({
            sample: provider.sample,
            warnings: [freshnessWarning(asOf)],
            lines: [`${title} ${picked.length}건 · ${asOfNote(asOf)}`, ...picked.map((d) => `• ${d.time} ${d.company} — ${d.title}${d.category ? ` [${d.category}]` : ''}`)],
          }),
          asOf: asOf ?? null,
        }
      }
      if (!args.symbol) return report('오늘 국내 공시', () => true)
      return withSymbol(provider, 'KR', args.symbol, (found) => {
        const key = found.name.replace(/\s+/g, '')
        return report(`${label(found)} 오늘 공시`, (d) => String(d.company).replace(/\s+/g, '') === key)
      })
    }),
}

const BRIEF_INDICES = { US: ['S&P 500', 'NASDAQ', 'Dow Jones', 'VIX'], KR: ['KOSPI', 'KOSDAQ', 'USD/KRW'] }
const fmtIndex = (row) => `${row.name} ${row.value == null ? '-' : row.value.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${pct(row.changePct)})`

export const investBrief = {
  label: '시장 브리핑',
  risk: 'read',
  description: '오늘 기준 시장 브리핑: 주요 지수, 공포·탐욕 지수(미국), 거래량 급증 상위, 오늘 실적 발표(미국), 주요 뉴스 3건.',
  schema: {
    type: 'object',
    properties: { market_type: { type: 'string', enum: MARKETS, description: '한 시장만 원할 때 US 또는 KR. 말하지 않았으면 넣지 않는다(두 시장 모두)' } },
    required: [],
  },
  check(args) {
    const keys = onlyKeys(args, ['market_type'])
    if (keys) return keys
    return args.market_type == null ? null : checkMarket(args.market_type)
  },
  describe: (args) => (args.market_type ? `${MARKET_LABEL[args.market_type]} 시장 · 오늘` : '미국·국내 시장 · 오늘'),
  run: (args) =>
    withProvider(async (provider) => {
      const market = args.market_type ?? null
      const markets = market ? [market] : MARKETS
      const b = await provider.brief(market)
      const parts = [b.indices, b.fearGreed, b.surges, b.earnings, b.news].filter(Boolean)
      if (parts.every((p) => !p.ok)) throw new InvestDataError(parts[0]?.error ?? '브리핑 데이터를 받지 못했어요')

      const warnings = []
      const lines = [`📈 ${market ? MARKET_LABEL[market] : '미국·국내'} 시장 브리핑 (오늘)`]
      const failed = (what, part) => `${what}: 불러오지 못했어요 (${part.error})`

      // 지수
      if (b.indices.ok) {
        const names = markets.flatMap((m) => BRIEF_INDICES[m])
        const rows = names.map((name) => b.indices.items.find((row) => row.name === name)).filter(Boolean)
        warnings.push(freshnessWarning(b.indices.asOf))
        lines.push(`지수 · ${asOfNote(b.indices.asOf)}`, rows.length ? `  ${rows.map(fmtIndex).join(' · ')}` : '  (지수 없음)')
      } else lines.push(failed('지수', b.indices))

      // 공포·탐욕 (미국)
      if (b.fearGreed) {
        if (b.fearGreed.ok && b.fearGreed.value) {
          warnings.push(freshnessWarning(b.fearGreed.asOf))
          lines.push(`공포·탐욕 지수 ${b.fearGreed.value.score} (${b.fearGreed.value.rating}) · ${asOfNote(b.fearGreed.asOf)}`)
        } else if (!b.fearGreed.ok) lines.push(failed('공포·탐욕 지수', b.fearGreed))
      }

      // 거래량 급증 상위 3
      if (b.surges.ok) {
        warnings.push(freshnessWarning(b.surges.asOf))
        lines.push(`거래량 급증 · ${asOfNote(b.surges.asOf)}`)
        for (const m of markets) {
          const top = [...b.surges[m.toLowerCase()]].sort((x, y) => (y.ratio ?? 0) - (x.ratio ?? 0)).slice(0, 3)
          const text = top.map((s) => `${s.name}(${m === 'KR' ? String(s.ticker).replace(/\.K[SQ]$/, '') : s.ticker}) 평소의 ${s.ratio == null ? '-' : s.ratio.toFixed(1)}배, ${pct(s.changePct)}`)
          lines.push(`  ${MARKET_LABEL[m]}: ${text.length ? text.join(' / ') : '없음'}`)
        }
      } else lines.push(failed('거래량 급증', b.surges))

      // 오늘 실적 발표 (미국)
      if (b.earnings) {
        if (b.earnings.ok) {
          warnings.push(freshnessWarning(b.earnings.asOf))
          const items = b.earnings.items.slice(0, 5).map((e) => `${e.symbol}${e.time ? `(${e.time})` : ''}`)
          const more = b.earnings.items.length > 5 ? ` 외 ${b.earnings.items.length - 5}개` : ''
          lines.push(`오늘 실적 발표(미국): ${items.length ? items.join(', ') + more : '없음'}`)
        } else lines.push(failed('오늘 실적 발표', b.earnings))
      }

      // 주요 뉴스 3건
      if (b.news.ok) {
        const items = b.news.items.filter((n) => markets.includes(n.market) && n.title).sort((x, y) => (y.at ?? 0) - (x.at ?? 0)).slice(0, 3)
        if (items.length) {
          warnings.push(freshnessWarning(items[0].at))
          lines.push('주요 뉴스', ...items.map((n) => `  • ${n.title}${n.at ? ` (${kstShort(n.at)})` : ''}`))
        } else lines.push('주요 뉴스: 없음')
      } else lines.push(failed('주요 뉴스', b.news))

      return { summary: assemble({ sample: provider.sample, warnings, lines }) }
    }),
}


// 지시 끝에 붙은 "리포트·정리해줘·보고서" 같은 말을 떼고 종목 이름만 남긴다. (예: 삼성전자리포트 → 삼성전자)
const REPORT_WORDS = /\s*(?:종목\s*)?(?:리포트|레포트|보고서|정리해\s*줘|정리|요약해\s*줘|요약)\s*$/u
export const stripReportWords = (symbol) => String(symbol).replace(REPORT_WORDS, '').trim() || String(symbol).trim()

export const NO_ADVICE = '참고  투자 판단(사라·팔라)은 하지 않습니다'

// 종목 리포트: 가격·흐름(3개월)·뉴스 3건·오늘 공시(국내)를 한 번에. 한 조각이 실패해도 나머지는 보여 준다.
export const investReport = {
  label: '종목 리포트',
  risk: 'read',
  description:
    '종목 1개 리포트: 가격(현재가·등락률·1년 범위 위치·PER), 흐름(3개월 수익률·최고·최저), 최신 뉴스 3건, 오늘 공시(국내만)를 한 보고로 정리한다. 리포트·정리·요약을 원하거나, 종목 이름만 보냈거나, 사도 되는지·팔아야 하는지 물었을 때 쓴다.',
  schema: { type: 'object', properties: { symbol: symbolSchema, market_type: marketSchema }, required: ['symbol', 'market_type'] },
  check(args) {
    const keys = onlyKeys(args, ['symbol', 'market_type'])
    if (keys) return keys
    if (badSymbol(args.symbol)) return 'symbol은 1~40자 글자여야 합니다'
    return checkMarket(args.market_type)
  },
  describe: (args) => `${stripReportWords(args.symbol)} · ${MARKET_LABEL[args.market_type]} · 가격·흐름(3개월)·뉴스·공시`,
  run: (args) =>
    withProvider((provider) =>
      withSymbol(provider, args.market_type, stripReportWords(args.symbol), async (found) => {
        const isKR = found.market === 'KR'
        const [quote, chart, news, disclosures] = await Promise.allSettled([
          provider.quote(found),
          provider.chart(found, DEFAULT_PERIOD),
          provider.news({ market: found.market, ticker: isKR ? null : found.ticker, code: found.code ?? null }),
          isKR ? provider.disclosures() : Promise.resolve(null),
        ])
        const parts = isKR ? [quote, chart, news, disclosures] : [quote, chart, news]
        if (parts.every((part) => part.status === 'rejected')) throw quote.reason

        const m = found.market
        const failed = '받지 못했어요'
        const warnings = []
        const lines = []

        // 가격
        const q = quote.status === 'fulfilled' ? quote.value : null
        if (q && q.price != null) {
          warnings.push(freshnessWarning(q.asOf))
          lines.push(`📊 ${label(found)} 리포트 · ${asOfNote(q.asOf)}`)
          const price = [`${money(q.price, m)} (${pct(q.changePct)})`, yearRange(q, m)?.text, q.pe != null ? `PER ${q.pe.toFixed(1)}` : null]
          lines.push(`가격  ${price.filter(Boolean).join(' · ')}`)
        } else {
          lines.push(`📊 ${label(found)} 리포트`, `가격  ${failed}`)
        }

        // 흐름 (3개월)
        const c = chart.status === 'fulfilled' ? chart.value : null
        const stats = c && !c.dummy ? chartStats(c.bars ?? []) : null
        if (stats) {
          warnings.push(freshnessWarning(c.asOf))
          lines.push(
            `흐름  ${PERIODS[DEFAULT_PERIOD]} ${pct(stats.changePct)} · 최고 ${money(stats.high.price, m)} (${day(stats.high.date)}) · 최저 ${money(stats.low.price, m)} (${day(stats.low.date)})`,
          )
        } else {
          lines.push(`흐름  ${c?.dummy ? '실제 차트를 받지 못했어요' : c ? '차트 데이터가 없어요' : failed}`)
        }

        // 뉴스 (최신 3건)
        if (news.status === 'fulfilled') {
          const { lines: newsList, newest, total } = newsLines(news.value ?? [])
          if (total === 0) lines.push('뉴스  새 뉴스가 없어요')
          else {
            warnings.push(freshnessWarning(newest))
            lines.push('뉴스', ...newsList.slice(0, REPORT_NEWS_LIMIT).map((line) => `  ${line}`))
          }
        } else lines.push(`뉴스  ${failed}`)

        // 공시 (국내만, 오늘)
        if (!isKR) lines.push('공시  국내 종목만 조회할 수 있어요')
        else if (disclosures.status === 'fulfilled' && disclosures.value) {
          const { items = [], asOf } = disclosures.value
          const key = found.name.replace(/\s+/g, '')
          const mine = items.filter((d) => String(d.company).replace(/\s+/g, '') === key).slice(0, DISCLOSURE_LIMIT)
          if (mine.length === 0) lines.push('공시  오늘 없어요')
          else {
            warnings.push(freshnessWarning(asOf))
            lines.push('공시', ...mine.map((d) => `  • ${d.time} ${d.title}${d.category ? ` [${d.category}]` : ''}`))
          }
        } else lines.push(`공시  ${failed}`)

        lines.push(NO_ADVICE)
        return { summary: assemble({ sample: provider.sample, warnings, lines }), asOf: q?.asOf ?? null }
      }),
    ),
}
