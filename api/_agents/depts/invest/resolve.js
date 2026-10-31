// 종목 찾기: 지시에 적힌 티커·종목명·코드를 market_type(US/KR) 안에서만 찾는다. 다른 시장으로 마음대로 바꾸지 않는다.
//   US: StockView 미국 종목 목록에서 티커 → 한글 이름(name_ko) → 영문 이름 순서 (대소문자 무시)
//   KR: StockView 국내 목록(/api/kr-stocks?q=)에서 코드·이름
// 돌려주는 값: { found: {market, ticker, code?, name} } | { candidates: [...] } | { none: true }

export const MAX_CANDIDATES = 5

// 자주 쓰는 다른 이름 (StockView 한글 이름과 다른 것만)
const US_ALIASES = { 구글: 'GOOGL', 페이스북: 'META', 페북: 'META', 엔비: 'NVDA', 마소: 'MSFT', 아마존닷컴: 'AMZN' }

const norm = (text) => String(text ?? '').replace(/\s+/g, '').toLowerCase()

// 정확히 같음 → (하나뿐이면) 이름이 그 말로 시작함 → 포함 순서로 좁힌다
function pick(list, exact, partial, toFound, starts = () => false) {
  const exactHits = list.filter(exact)
  if (exactHits.length === 1) return { found: toFound(exactHits[0]) }
  const startHits = exactHits.length ? [] : list.filter(starts)
  if (startHits.length === 1) return { found: toFound(startHits[0]) }
  const hits = exactHits.length > 1 ? exactHits : list.filter(partial)
  if (hits.length === 1) return { found: toFound(hits[0]) }
  if (hits.length > 1) return { candidates: hits.slice(0, MAX_CANDIDATES).map(toFound), more: Math.max(0, hits.length - MAX_CANDIDATES) }
  return { none: true }
}

export async function resolveSymbol(provider, market, symbol) {
  const q = norm(symbol)
  if (!q) return { none: true }

  if (market === 'US') {
    const alias = US_ALIASES[q]
    const key = alias ? alias.toLowerCase() : q
    const list = await provider.searchUS(symbol)
    const toFound = (row) => ({ market: 'US', ticker: row.ticker, name: row.nameKo || row.name || row.ticker })
    return pick(
      list,
      (row) => norm(row.ticker) === key || norm(row.nameKo) === key,
      (row) => norm(row.nameKo).includes(key) || norm(row.name).includes(key),
      toFound,
      (row) => norm(row.nameKo).startsWith(key) || norm(row.name).startsWith(key),
    )
  }

  const list = await provider.searchKR(String(symbol).trim())
  const toFound = (row) => ({ market: 'KR', ticker: row.ticker, code: row.code, name: row.name })
  return pick(
    list,
    (row) => norm(row.code) === q || norm(row.name) === q || norm(row.ticker) === q,
    (row) => norm(row.code).includes(q) || norm(row.name).includes(q),
    toFound,
    (row) => norm(row.name).startsWith(q),
  )
}

// 찾기 결과를 보고 문장으로 (찾았으면 null)
export function resolveProblem(result, market, symbol) {
  if (result.found) return null
  if (result.candidates) {
    const names = result.candidates.map((c) => `${c.name}(${market === 'KR' ? c.code : c.ticker})`).join(', ')
    return `'${symbol}'에 맞는 종목이 여러 개예요: ${names}${result.more ? ` 외 ${result.more}개` : ''}. 하나를 골라 다시 물어봐 주세요`
  }
  const other = market === 'US' ? '국내' : '미국'
  return `${market === 'US' ? '미국' : '국내'} 시장에서 '${symbol}'을(를) 찾지 못했어요. ${other} 종목인가요? 이름이나 티커를 확인해 주세요`
}
