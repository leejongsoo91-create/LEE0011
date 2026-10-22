const weekdays = ['일', '월', '화', '수', '목', '금', '토']

// '2026-10-23' → '2026년 10월 23일 (금)'. 형식이 맞지 않으면 받은 값을 그대로 돌려준다.
export function formatKoreanDate(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '')
  if (!match) return date ?? ''
  const [, year, month, day] = match
  const weekday = weekdays[new Date(Number(year), Number(month) - 1, Number(day)).getDay()]
  return `${year}년 ${Number(month)}월 ${Number(day)}일 (${weekday})`
}

// '15:30' → '오후 3시 30분', '09:00' → '오전 9시'. 시간이 없으면 '종일'.
export function formatKoreanTime(time) {
  const match = /^(\d{2}):(\d{2})/.exec(time ?? '')
  if (!match) return '종일'
  const hour = Number(match[1])
  const minute = Number(match[2])
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour < 12 ? '오전' : '오후'} ${hour12}시${minute === 0 ? '' : ` ${minute}분`}`
}
