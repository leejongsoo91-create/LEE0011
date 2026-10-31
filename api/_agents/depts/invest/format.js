// 투자 부서 보고 문장 도우미: 한국 시간 표시, 구형 데이터 경고, 숫자 표시.
// 구형 데이터 판단과 경고 문구는 AI가 아니라 이 코드가 붙인다. (투자 부서 규칙서 '구형 데이터')

export const STALE_AFTER_MS = 24 * 60 * 60 * 1000
export const SAMPLE_MARK = '🧪 예시 데이터 (실제 시세 아님)'
export const UNKNOWN_TIME_WARNING = '⚠️ [주의: 기준 시각을 확인할 수 없는 데이터]'

const KST_OFFSET = 9 * 60 * 60 * 1000

// ms → "2026-10-31 15:30" (한국 시간)
export function kstLabel(ms) {
  const iso = new Date(ms + KST_OFFSET).toISOString()
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`
}

// ms → "10/31 15:30" (짧게)
export function kstShort(ms) {
  const iso = new Date(ms + KST_OFFSET).toISOString()
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))} ${iso.slice(11, 16)}`
}

export const isStale = (asOf, now = Date.now()) => typeof asOf === 'number' && now - asOf >= STALE_AFTER_MS

// 데이터 기준 시각에 따라 붙일 경고 (없으면 null)
//   기준 시각 없음 → 확인 불가 경고 · 24시간 이상 지남 → 구형 데이터 경고
export function freshnessWarning(asOf, now = Date.now()) {
  if (typeof asOf !== 'number' || !Number.isFinite(asOf)) return UNKNOWN_TIME_WARNING
  if (isStale(asOf, now)) return `⚠️ [주의: ${kstLabel(asOf)} 기준 구형 데이터]`
  return null
}

// "기준: 10/31 15:30" 또는 경고. 데이터 한 덩어리 옆에 붙인다.
export const asOfNote = (asOf, now = Date.now()) => freshnessWarning(asOf, now) ?? `기준: ${kstShort(asOf)}`

// 숫자 표시
export const pct = (value) => (typeof value === 'number' && Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : '-')
export function money(value, market) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return market === 'KR' ? `${Math.round(value).toLocaleString('ko-KR')}원` : `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}
export function count(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  if (value >= 1e8) return `${(value / 1e8).toFixed(1)}억`
  if (value >= 1e4) return `${Math.round(value / 1e4).toLocaleString('ko-KR')}만`
  return value.toLocaleString('ko-KR')
}

// 여러 경고를 모아 보고 맨 위에 한 줄씩 (같은 문구는 한 번만)
export const topWarnings = (warnings) => [...new Set(warnings.filter(Boolean))]

// 보고 문장 조립: [예시 표시] [맨 위 경고들] 본문
export function assemble({ sample = false, warnings = [], lines }) {
  return [...(sample ? [SAMPLE_MARK] : []), ...topWarnings(warnings), ...lines].join('\n')
}
