// 예시 공급자: 틀과 보고 모양을 폰에서 확인하기 위한 고정 예시 값. 실제 시세가 아니다.
// 보고에는 항상 "🧪 예시 데이터"가 붙는다. 값은 StockView 공급자와 같은 모양으로 돌려준다.

const MIN = 60 * 1000

const US = [
  { ticker: 'AAPL', name: 'Apple Inc.', nameKo: '애플', price: 271.3, changePct: 1.21, volume: 52_300_000, high52: 288.6, low52: 169.2, pe: 36.2 },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', nameKo: '엔비디아', price: 186.4, changePct: -0.84, volume: 198_000_000, high52: 212.2, low52: 86.6, pe: 52.8 },
  { ticker: 'TSLA', name: 'Tesla Inc.', nameKo: '테슬라', price: 448.9, changePct: 2.35, volume: 88_100_000, high52: 488.5, low52: 214.3, pe: 182.4 },
  { ticker: 'MSFT', name: 'Microsoft Corp.', nameKo: '마이크로소프트', price: 517.8, changePct: 0.42, volume: 21_400_000, high52: 555.5, low52: 344.8, pe: 37.9 },
  { ticker: 'GOOGL', name: 'Alphabet Inc. Class A', nameKo: '알파벳A', price: 281.2, changePct: 0.97, volume: 30_200_000, high52: 291.6, low52: 140.5, pe: 27.1 },
  { ticker: 'GOOG', name: 'Alphabet Inc. Class C', nameKo: '알파벳C', price: 282.0, changePct: 0.95, volume: 22_800_000, high52: 292.3, low52: 142.7, pe: 27.2 },
]
const KR = [
  { ticker: '005930.KS', code: '005930', name: '삼성전자', price: 98_400, changePct: 1.86, volume: 18_400_000, high52: 104_200, low52: 50_800, pe: 21.3 },
  { ticker: '000660.KS', code: '000660', name: 'SK하이닉스', price: 512_000, changePct: -1.15, volume: 4_100_000, high52: 548_000, low52: 162_900, pe: 13.8 },
  { ticker: '035420.KS', code: '035420', name: 'NAVER', price: 254_500, changePct: 0.59, volume: 690_000, high52: 295_000, low52: 181_200, pe: 19.6 },
]

const DAY = 24 * 60 * MIN
const DAYS = { '1mo': 22, '3mo': 64, '6mo': 126, '1y': 250, '2y': 500 }

// 정해진 모양의 예시 차트 (같은 종목·기간이면 늘 같은 값)
function sampleBars(stock, period, now) {
  const n = DAYS[period] ?? 64
  const seed = [...stock.ticker].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  const start = stock.price * 0.88
  return Array.from({ length: n }, (_, i) => {
    const wave = Math.sin((i + seed) / 6) * 0.03 + (i / n) * 0.12
    const close = Math.round(start * (1 + wave) * 100) / 100
    const date = new Date(now - (n - 1 - i) * DAY).toISOString().slice(0, 10)
    return { date, open: close * 0.995, high: close * 1.012, low: close * 0.988, close, volume: Math.round(stock.volume * (0.7 + ((i * 7 + seed) % 10) / 15)), dummy: false }
  })
}

export function createSampleProvider({ now = () => Date.now() } = {}) {
  const fresh = () => now() - 10 * MIN
  const find = ({ market, ticker }) => (market === 'KR' ? KR : US).find((s) => s.ticker === ticker)
  return {
    name: 'sample',
    label: '예시 데이터',
    sample: true,
    async searchUS() {
      return US.map(({ ticker, name, nameKo }) => ({ ticker, name, nameKo }))
    },
    async searchKR(query) {
      const q = String(query).trim().toLowerCase()
      return KR.filter((s) => s.code.includes(q) || s.name.toLowerCase().includes(q)).map(({ ticker, code, name }) => ({ ticker, code, name }))
    },
    async quote(symbol) {
      const s = find(symbol)
      if (!s) return null
      return { ticker: s.ticker, name: s.nameKo || s.name, price: s.price, changePct: s.changePct, volume: s.volume, high52: s.high52, low52: s.low52, pe: s.pe, asOf: fresh() }
    },
    async chart(symbol, period) {
      const s = find(symbol)
      const bars = s ? sampleBars(s, period, now()) : []
      return { bars, dummy: false, asOf: bars.length ? fresh() : null }
    },
    async news({ market, ticker, code }) {
      const who = ticker ? (US.find((s) => s.ticker === ticker)?.nameKo ?? ticker) : code ? (KR.find((s) => s.code === code)?.name ?? code) : market === 'KR' ? '코스피' : '미국 증시'
      return [0, 1, 2].map((i) => ({
        title: [`${who} 관련 예시 기사 제목입니다`, `${who} 예시 뉴스: 실적 기대감`, `${who} 예시 뉴스: 업계 동향`][i],
        source: '예시 언론사',
        url: 'https://example.com/news',
        at: now() - (i * 45 + 20) * MIN,
      }))
    },
    async disclosures() {
      return {
        items: [
          { time: '15:42', company: '삼성전자', title: '[예시] 기업설명회(IR) 개최', category: 'IR', url: 'https://kind.krx.co.kr/' },
          { time: '14:10', company: 'SK하이닉스', title: '[예시] 주요사항보고서', category: '주요사항', url: 'https://kind.krx.co.kr/' },
          { time: '11:05', company: 'NAVER', title: '[예시] 단일판매·공급계약 체결', category: '계약', url: 'https://kind.krx.co.kr/' },
        ],
        asOf: fresh(),
      }
    },
    async brief(market) {
      const asOf = fresh()
      const wantUS = market !== 'KR'
      return {
        indices: {
          ok: true,
          asOf,
          items: [
            { name: 'S&P 500', value: 6840.2, changePct: 0.48 },
            { name: 'NASDAQ', value: 23724.9, changePct: 0.61 },
            { name: 'Dow Jones', value: 47562.9, changePct: 0.09 },
            { name: 'VIX', value: 16.9, changePct: -3.2 },
            { name: 'KOSPI', value: 4107.5, changePct: 1.12 },
            { name: 'KOSDAQ', value: 900.4, changePct: 0.35 },
            { name: 'USD/KRW', value: 1424.3, changePct: -0.21 },
          ],
        },
        fearGreed: wantUS ? { ok: true, value: { score: 58, rating: 'Greed' }, asOf } : null,
        surges: {
          ok: true,
          asOf,
          us: [{ ticker: 'TSLA', name: '테슬라', changePct: 2.35, ratio: 2.8 }],
          kr: [{ ticker: '005930.KS', name: '삼성전자', changePct: 1.86, ratio: 2.3 }],
        },
        earnings: wantUS ? { ok: true, asOf, items: [{ symbol: 'AAPL', name: 'Apple Inc.', time: '장 마감 후' }] } : null,
        news: {
          ok: true,
          items: [
            { title: '예시: 미국 증시 기술주 강세', source: '예시 언론사', url: 'https://example.com', market: 'US', at: now() - 30 * MIN },
            { title: '예시: 코스피 반도체 중심 상승', source: '예시 언론사', url: 'https://example.com', market: 'KR', at: now() - 50 * MIN },
          ],
        },
      }
    },
  }
}
