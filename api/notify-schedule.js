// Vercel 서버 함수: 새 일정이 등록되면 텔레그램으로 알림을 보낸다.
// 봇 토큰은 이 서버 함수의 환경변수에만 있고 브라우저로는 절대 내려가지 않는다.
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID  (Vercel > Settings > Environment Variables)
// 로그인한 사용자만 호출할 수 있도록 Supabase 로그인 토큰을 먼저 확인한다.

const MAX_TITLE_LENGTH = 200

// '2026-10-23' → '2026년 10월 23일' (숫자 앞의 0은 뺀다)
export function formatDate(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '')
  if (!match) return null
  const [, year, month, day] = match
  return `${year}년 ${Number(month)}월 ${Number(day)}일`
}

export function buildMessage({ title, date }) {
  const formatted = formatDate(date)
  if (!formatted) return null
  const content = String(title ?? '').trim().slice(0, MAX_TITLE_LENGTH) || '제목 없음'
  return `📅 [새로운 일정 등록]\n날짜: ${formatted}\n내용: ${content}`
}

// 요청에 담긴 로그인 토큰이 진짜 Supabase 사용자의 것인지 확인한다.
async function isLoggedIn(authorization) {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey || !authorization?.startsWith('Bearer ')) return false
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  })
  return response.ok
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 사용할 수 있습니다' })

  try {
    if (!(await isLoggedIn(req.headers.authorization))) {
      return res.status(401).json({ error: '로그인이 필요합니다' })
    }
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (!token || !chatId) return res.status(503).json({ error: '텔레그램 설정이 없습니다' })

    const text = buildMessage(req.body ?? {})
    if (!text) return res.status(400).json({ error: '날짜 형식이 올바르지 않습니다' })

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    if (!response.ok) return res.status(502).json({ error: '텔레그램 전송에 실패했습니다' })
    return res.status(200).json({ ok: true })
  } catch {
    return res.status(500).json({ error: '알림을 보내지 못했습니다' })
  }
}
