// 투자 데이터 공급자 고르기. Vercel 환경변수 INVEST_PROVIDER로 정한다 (에이전트 프로그램 자리와 같은 방식).
//   none(기본)  : 연결 전 — "투자 데이터가 아직 연결되지 않았어요"
//   sample     : 예시 데이터 (틀·보고 모양 확인용)
//   stockview  : STOCKVIEW_URL의 StockView API
// 새 공급자(예: 공식 API)는 같은 모양의 함수 묶음을 만들어 여기에 한 줄 더한다. 도구·규칙서는 그대로.

import { createSampleProvider } from './sample.js'
import { InvestDataError, createStockviewProvider } from './stockview.js'

export { InvestDataError }
export const PROVIDERS = ['none', 'sample', 'stockview']

export const NOT_CONNECTED =
  '투자 데이터가 아직 연결되지 않았어요. Vercel 환경변수 INVEST_PROVIDER를 sample(예시) 또는 stockview로 정해 주세요'

let override = null
// 테스트에서 공급자를 바꿔 끼울 때 (null이면 환경변수로 돌아감)
export const setInvestProvider = (provider) => {
  override = provider
}

// 지금 쓸 공급자. 연결 전이면 null.
export function currentProvider(env = process.env) {
  if (override) return override
  const name = (env.INVEST_PROVIDER ?? 'none').trim() || 'none'
  if (!PROVIDERS.includes(name)) throw new InvestDataError(`모르는 투자 데이터 공급자: ${name} (none, sample, stockview 중 하나)`)
  if (name === 'none') return null
  if (name === 'sample') return createSampleProvider()
  if (!env.STOCKVIEW_URL?.trim()) throw new InvestDataError('INVEST_PROVIDER=stockview인데 STOCKVIEW_URL이 비어 있어요 (Vercel 환경변수 확인)')
  return createStockviewProvider(env.STOCKVIEW_URL)
}
