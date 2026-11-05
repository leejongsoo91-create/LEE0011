// 중앙관제 화면의 날짜·시각 계산. 모두 한국 시간(Asia/Seoul) 기준이다.

const KST = { timeZone: 'Asia/Seoul' }

// 'YYYY-MM-DD'
export const kstDate = (date = new Date()) => date.toLocaleDateString('sv-SE', KST)

// 'HH:MM'
export const kstTime = (date = new Date()) => date.toLocaleTimeString('en-GB', { ...KST, hour: '2-digit', minute: '2-digit' })

// 'YYYY-MM-DD'에 days일을 더한 날짜
export function addDays(ymd, days) {
  const date = new Date(`${ymd}T00:00:00+09:00`)
  date.setUTCDate(date.getUTCDate() + days)
  return kstDate(date)
}

// 시각 표시: 오늘이면 HH:MM, 아니면 MM-DD HH:MM
export function formatAt(iso, now = new Date()) {
  if (!iso) return ''
  const date = new Date(iso)
  const day = kstDate(date)
  return day === kstDate(now) ? kstTime(date) : `${day.slice(5)} ${kstTime(date)}`
}
