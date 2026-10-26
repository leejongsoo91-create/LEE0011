// 텔레그램 웹훅 수신부: 봇에게 온 메시지·버튼을 받는다.
//   AGENT_MODE=on  → 결재 통제형 멀티 에이전트(api/_agents/approval.js)로 넘긴다. 이때는 시크릿 확인이 필수다.
//   그 밖          → 예전처럼 받은 글을 그대로 되돌려 주는 echo 응답만 한다.
//
// 시크릿: setWebhook에 secret_token을 넣으면 텔레그램이 모든 요청에 X-Telegram-Bot-Api-Secret-Token 헤더를 붙인다.
//         Vercel의 TELEGRAM_WEBHOOK_SECRET과 같을 때만 처리한다. (채팅 ID는 비밀이 아니라서 그것만으로는 위조를 막지 못한다)

import { timingSafeEqual } from 'node:crypto'
import { handleUpdate } from './_agents/approval.js'

function safeEqual(a = '', b = '') {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  return left.length === right.length && timingSafeEqual(left, right)
}

const TELEGRAM_TEXT_LIMIT = 4096

async function reply(token, chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, TELEGRAM_TEXT_LIMIT) }),
    })
  } catch (error) {
    // 답장이 실패해도 200을 돌려줘야 텔레그램이 같은 메시지를 계속 다시 보내지 않는다.
    console.error('[webhook] 답장 실패', error)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ status: 'method-not-allowed' })
  }

  // 시크릿을 설정했다면, 텔레그램이 보낸 요청인지 확인한다.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret && !safeEqual(req.headers['x-telegram-bot-api-secret-token'], secret)) {
    return res.status(401).json({ status: 'unauthorized' })
  }

  // 결재 통제형 에이전트: AGENT_MODE=on일 때만 켜진다. 꺼져 있으면 아래 echo 응답이 그대로 동작한다.
  if (process.env.AGENT_MODE === 'on') {
    // 실제 데이터를 바꾸는 경로라서, 시크릿이 없으면 누가 보낸 요청인지 믿을 수 없으므로 아예 처리하지 않는다.
    if (!secret) {
      console.error('[webhook] TELEGRAM_WEBHOOK_SECRET이 없어 에이전트 요청을 처리하지 않았습니다 (setWebhook secret_token과 같은 값을 Vercel에 넣어 주세요)')
      return res.status(200).json({ status: 'ignored' })
    }
    try {
      await handleUpdate(req.body)
    } catch (error) {
      // 처리에 실패해도 200을 돌려줘야 텔레그램이 같은 요청을 계속 다시 보내지 않는다.
      console.error('[webhook] 에이전트 처리 실패', error)
    }
    return res.status(200).json({ status: 'success' })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  const message = req.body?.message
  const text = message?.text
  const chatId = message?.chat?.id

  // 글자가 없는 시스템 이벤트(입장·사진·스티커 등)는 조용히 넘긴다.
  if (!token || !text || chatId == null) return res.status(200).json({ status: 'success' })

  // 내 채팅이 아니면 무시한다. (봇 주소를 아는 다른 사람이 말을 걸어도 답하지 않는다.)
  const ownerChatId = process.env.TELEGRAM_CHAT_ID
  if (ownerChatId && String(chatId) !== String(ownerChatId)) return res.status(200).json({ status: 'success' })

  await reply(token, chatId, `✅ 봇이 메시지를 수신했습니다!\n요청하신 내용: ${text}\n(AI 분석 기능 연결 대기 중...)`)

  return res.status(200).json({ status: 'success' })
}
