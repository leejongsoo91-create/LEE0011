// Vercel 서버 함수: 새 일정이 등록되면 텔레그램으로 알림을 보낸다.
// 봇 토큰은 이 서버 함수의 환경변수에만 있고 브라우저로는 절대 내려가지 않는다.
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID  (Vercel > Settings > Environment Variables)
// 대시보드 주인만 호출할 수 있다 (보고서 10): 로그인 토큰 확인 → 401, 주인이 아니면 → 403.
// 다른 계정이 생겨도 내 텔레그램으로 메시지를 보내지 못하게 한다.
import { ownerUserId } from './_agents/owner.js'
import { userIdFromToken } from './_lib/session.js'
import { scheduleLines, sendTelegram } from './_lib/telegram.js'

export function buildMessage({ title, date, time }) {
  const lines = scheduleLines({ title, date, time })
  return lines && ['📅 [새로운 일정 등록]', ...lines].join('\n')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 사용할 수 있습니다' })

  try {
    const userId = await userIdFromToken(req.headers?.authorization)
    if (!userId) return res.status(401).json({ error: '로그인이 필요합니다' })
    if (userId !== (await ownerUserId())) return res.status(403).json({ error: '권한이 없습니다' })
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      return res.status(503).json({ error: '텔레그램 설정이 없습니다' })
    }
    const text = buildMessage(req.body ?? {})
    if (!text) return res.status(400).json({ error: '날짜 형식이 올바르지 않습니다' })

    const result = await sendTelegram(text)
    if (!result.ok) return res.status(502).json({ error: '텔레그램 전송에 실패했습니다' })
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('[notify-schedule] 알림 실패', error?.message)
    return res.status(500).json({ error: '알림을 보내지 못했습니다' })
  }
}
