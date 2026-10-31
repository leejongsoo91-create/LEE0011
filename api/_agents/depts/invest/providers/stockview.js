// StockView 공급자: STOCKVIEW_URL의 StockView API(/api/...)를 읽어 투자 부서의 공통 모양으로 바꾼다.
// StockView 코드는 바꾸지 않는다. 읽기만 한다. (StockView: github.com/leejongsoo91-create/stockview)
//
// 기준 시각(asOf, ms):
//   국내 시세 → 종목의 updated_at · 미국 시세·지수·공시·공포탐욕·거래량 급증·실적 → /api/cache/status의 갱신 후 경과 시간
//   차트 → 마지막 봉 날짜(장 마감 시각) · 뉴스 → 기사 timestamp(미국) 또는 "YYYY.MM.DD HH:MM"(국내)
//   StockView가 데이터를 못 받아 코드에 넣어 둔 예전 값을 내보내면 캐시 기록이 없어서 asOf = null → "기준 시각 확인 불가" 경고

export const REQUEST_TIMEOUT_MS = 15_000
const SLEEPING = 'StockView가 응답하지 않아요 (잠들어 있으면 깨어나는 데 1분쯤 걸려요). 1분 뒤 다시 물어봐 주세요'

export class InvestDataError extends Error {}

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : value == null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null)

// "2026.10.31 14:20" · "2026.10.31" · "2026-10-31 14:20" (한국 시간) → ms
export function parseKrTime(text) {
  const m = String(text ?? '').match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:\.?\s+(\d{1,2}):(\d{2}))?/)
  if (!m) return null
  const [, y, mo, d, h = '0', mi = '0'] = m
  const pad = (v) => String(v).padStart(2, '0')
  const ms = Date.parse(`${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00+09:00`)
  return Number.isFinite(ms) ? ms : null
}

// 일봉 날짜 → 그 날 장 마감 시각 (국내 15:30 KST, 미국 16:00 미국 동부 표준시 기준 근사)
export const barCloseMs = (date, market) =>
  Date.parse(market === 'KR' ? `${date}T15:30:00+09:00` : `${date}T16:00:00-05:00`)

export function createStockviewProvider(baseUrl, { fetchImpl = (...args) => globalThis.fetch(...args), now = () => Date.now() } = {}) {
  const base = String(baseUrl ?? '').trim().replace(/\/+$/, '')
  if (!/^https?:\/\//.test(base)) throw new InvestDataError('STOCKVIEW_URL이 http(s) 주소가 아니에요 (Vercel 환경변수 확인)')

  async function get(path, { allow404 = false } = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let response
    try {
      response = await fetchImpl(`${base}${path}`, { signal: controller.signal, headers: { Accept: 'application/json' } })
    } catch {
      throw new InvestDataError(SLEEPING)
    } finally {
      clearTimeout(timer)
    }
    if (allow404 && response.status === 404) return null
    if (response.status === 502 || response.status === 503 || response.status === 504) throw new InvestDataError(SLEEPING)
    if (!response.ok) throw new InvestDataError(`StockView 응답 오류 (${response.status})`)
    try {
      return await response.json()
    } catch {
      throw new InvestDataError('StockView가 알 수 없는 형식으로 답했어요')
    }
  }

  // /api/cache/status: { key: { age_sec, ... } } → 그 데이터의 마지막 갱신 시각(ms). 한 번 읽고 재사용한다.
  let statusPromise = null
  async function updatedAt(key) {
    statusPromise ??= get('/api/cache/status').catch(() => ({}))
    const status = await statusPromise
    const age = num(status?.[key]?.age_sec)
    return age == null ? null : now() - age * 1000
  }

  let usListPromise = null
  const usList = () => (usListPromise ??= get('/api/stocks').then((rows) => (Array.isArray(rows) ? rows : [])))

  return {
    name: 'stockview',
    label: 'StockView',

    async searchUS() {
      return (await usList()).map((row) => ({ ticker: String(row.ticker ?? ''), name: row.name ?? '', nameKo: row.name_ko ?? '' }))
    },

    async searchKR(query) {
      const rows = await get(`/api/kr-stocks?q=${encodeURIComponent(query)}`)
      return (Array.isArray(rows) ? rows : []).map((row) => ({ ticker: row.ticker, code: row.code, name: row.name ?? '' }))
    },

    async quote({ market, ticker }) {
      const row = await get(`/api/stock/${encodeURIComponent(ticker)}`, { allow404: true })
      if (!row || row.error) return null
      const asOf = market === 'KR' && num(row.updated_at) ? num(row.updated_at) * 1000 : await updatedAt(market === 'KR' ? 'kr_stocks' : 'stocks')
      return {
        ticker: row.ticker ?? ticker,
        name: market === 'US' ? row.name_ko || row.name || ticker : row.name || ticker,
        price: num(row.price),
        changePct: num(row.change_pct),
        volume: num(row.volume),
        high52: num(row.week52_high),
        low52: num(row.week52_low),
        pe: num(row.pe),
        asOf,
      }
    },

    async chart({ market, ticker }, period) {
      const rows = await get(`/api/chart/${encodeURIComponent(ticker)}?period=${period}&interval=1d`)
      const bars = (Array.isArray(rows) ? rows : [])
        .filter((bar) => typeof bar?.time === 'string')
        .map((bar) => ({ date: bar.time, open: num(bar.open), high: num(bar.high), low: num(bar.low), close: num(bar.close), volume: num(bar.volume), dummy: Boolean(bar._dummy) }))
      const last = bars.at(-1)
      return { bars, dummy: bars.some((bar) => bar.dummy), asOf: last ? barCloseMs(last.date, market) : null }
    },

    // 종목 뉴스(US: /api/stock-news, KR: /api/kr-news) 또는 시장 뉴스(/api/news에서 그 시장 기사만)
    async news({ market, ticker, code }) {
      let rows
      if (ticker || code) rows = await get(market === 'KR' ? `/api/kr-news/${encodeURIComponent(code)}` : `/api/stock-news/${encodeURIComponent(ticker)}`)
      else {
        const all = await get('/api/news')
        rows = (Array.isArray(all) ? all : []).filter((item) => (market === 'KR' ? item.market === 'KR' : item.market !== 'KR'))
      }
      return (Array.isArray(rows) ? rows : []).map((item) => ({
        title: String(item.title ?? '').trim(),
        source: item.source ?? '',
        url: item.url ?? item.link ?? '',
        at: num(item.timestamp) ? num(item.timestamp) * 1000 : parseKrTime(item.time),
      }))
    },

    async disclosures() {
      const rows = await get('/api/kr-disclosures')
      return {
        items: (Array.isArray(rows) ? rows : []).map((item) => ({ time: item.time ?? '', company: item.company ?? '', title: item.title ?? '', category: item.category ?? item.type ?? '', url: item.link ?? '' })),
        asOf: await updatedAt('kr_disclosures'),
      }
    },

    // 시장 브리핑 재료. 한 곳이 실패해도 나머지는 보여 주도록 각각 따로 받는다.
    async brief(market) {
      const part = async (fn) => {
        try {
          return { ok: true, ...(await fn()) }
        } catch (error) {
          return { ok: false, error: error.message }
        }
      }
      const list = (value) => (Array.isArray(value) ? value : [])
      const surge = (row) => ({ ticker: row.ticker, name: row.name ?? row.ticker, changePct: num(row.change_pct), ratio: num(row.volume_ratio) })
      const wantUS = market !== 'KR'
      const [indices, fearGreed, surges, earnings, news] = await Promise.all([
        part(async () => ({
          items: list(await get('/api/indices')).map((row) => ({ name: row.name, value: num(row.value), changePct: num(row.change_pct) })),
          asOf: await updatedAt('indices'),
        })),
        wantUS
          ? part(async () => {
              const value = await get('/api/fear-greed')
              return { value: num(value?.score) == null ? null : { score: num(value.score), rating: value.rating ?? '' }, asOf: await updatedAt('fear_greed') }
            })
          : null,
        part(async () => {
          const value = await get('/api/volume-surges')
          return { us: list(value?.us).map(surge), kr: list(value?.kr).map(surge), asOf: await updatedAt('daily_signals') }
        }),
        wantUS
          ? part(async () => ({
              items: list(await get('/api/earnings?period=today')).map((row) => ({ symbol: row.symbol, name: row.name ?? '', time: row.time ?? '' })),
              asOf: await updatedAt('earnings'),
            }))
          : null,
        part(async () => ({
          items: list(await get('/api/news')).map((item) => ({
            title: String(item.title ?? '').trim(),
            source: item.source ?? '',
            url: item.url ?? '',
            market: item.market === 'KR' ? 'KR' : 'US',
            at: num(item.timestamp) ? num(item.timestamp) * 1000 : parseKrTime(item.time),
          })),
        })),
      ])
      return { indices, fearGreed, surges, earnings, news }
    },
  }
}
