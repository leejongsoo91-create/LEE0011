// 투자 부서: StockView 기준으로 시세·차트 요약·뉴스·공시·시장 브리핑을 조회한다. (모두 조회만)
// 부서 하나 = 폴더 하나 (index.js 등록 정보 · tools.js 도구 · rules.md 부서 규칙). 데이터는 providers/의 공급자가 가져온다.

import { investBrief, investChartSummary, investDisclosures, investNews, investQuote } from './tools.js'

export default {
  id: 'invest',
  name: '투자 부서',
  role: 'StockView 기준 시세·차트 요약·뉴스·공시·시장 브리핑 조회 (조회만)',
  examples: ['삼성전자 지금 얼마야?', '엔비디아 차트 요약', '애플 뉴스', '시장 브리핑 해줘'],
  rulesUrl: new URL('./rules.md', import.meta.url),
  tools: {
    'invest.quote': investQuote,
    'invest.chart_summary': investChartSummary,
    'invest.news': investNews,
    'invest.disclosures': investDisclosures,
    'invest.brief': investBrief,
  },
}
