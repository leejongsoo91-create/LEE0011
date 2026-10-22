// 텔레그램 알림 서버 함수들이 함께 쓰는 도우미. (_lib 폴더는 Vercel이 서버 함수로 만들지 않는다.)

const MAX_TITLE_LENGTH = 200

// '2026-10-23' → '2026년 10월 23일' (숫자 앞의 0은 뺀다)
export function formatDate(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '')
  if (!match) return null
  const [, year, month, day] = match
  return `${year}년 ${Number(month)}월 ${Number(day)}일`
}

// '15:30' → '오후 3시 30분', '09:00' → '오전 9시'
export function formatTime(time) {
  const match = /^(\d{2}):(\d{2})/.exec(time ?? '')
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  const period = hour < 12 ? '오전' : '오후'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${period} ${hour12}시${minute === 0 ? '' : ` ${minute}분`}`
}

export function cleanTitle(title) {
  return String(title ?? '').trim().slice(0, MAX_TITLE_LENGTH) || '제목 없음'
}

// 일정 메시지의 공통 본문: 날짜, (시간이 있으면) 시간, 내용
export function scheduleLines({ title, date, time }) {
  const formattedDate = formatDate(date)
  if (!formattedDate) return null
  const lines = [`날짜: ${formattedDate}`]
  const formattedTime = formatTime(time)
  if (formattedTime) lines.push(`시간: ${formattedTime}`)
  lines.push(`내용: ${cleanTitle(title)}`)
  return lines
}

export async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return { ok: false, reason: 'not-configured' }
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  return { ok: response.ok, reason: response.ok ? null : 'telegram-error' }
}
