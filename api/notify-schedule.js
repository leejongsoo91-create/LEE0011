// Vercel 서버 함수: 새 일정이 등록되면 텔레그램으로 알림을 보낸다.
// 봇 토큰은 이 서버 함수의 환경변수에만 있고 브라우저로는 절대 내려가지 않는다.
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID  (Vercel > Settings > Environment Variables)
// 로그인한 사용자만 호출할 수 있도록 Supabase 로그인 토큰을 먼저 확인한다.
import { scheduleLines, sendTelegram } from './_lib/telegram.js'

export function buildMessage({ title, date, time }) {
  const lines = scheduleLines({ title, date, time })
  return lines && ['📅 [새로운 일정 등록]', ...lines].join('\n')
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
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      return res.status(503).json({ error: '텔레그램 설정이 없습니다' })
    }
    const text = buildMessage(req.body ?? {})
    if (!text) return res.status(400).json({ error: '날짜 형식이 올바르지 않습니다' })

    const result = await sendTelegram(text)
    if (!result.ok) return res.status(502).json({ error: '텔레그램 전송에 실패했습니다' })
    return res.status(200).json({ ok: true })
  } catch {
    return res.status(500).json({ error: '알림을 보내지 못했습니다' })
  }
}
