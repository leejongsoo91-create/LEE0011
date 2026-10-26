// 텔레그램 웹훅 수신부: 봇에게 온 메시지를 받아서 답장한다.
// 지금은 통신 테스트용 메아리(echo)만 하고, 나중에 AI가 문장을 해석해 일정 등을 등록하는 로직을 여기에 붙인다.

import { handleUpdate } from './_agents/approval.js'

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

  // (선택) setWebhook에 secret_token을 지정했다면, 텔레그램이 보낸 요청인지 확인한다.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    return res.status(401).json({ status: 'unauthorized' })
  }

  // 결재 통제형 에이전트(결재 테스트 모드): AGENT_MODE=on일 때만 켜진다. 꺼져 있으면 아래 echo 응답이 그대로 동작한다.
  if (process.env.AGENT_MODE === 'on') {
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

  // TODO: 여기에서 text를 AI로 분석해 일정 등록 같은 명령으로 바꾼다.
  await reply(token, chatId, `✅ 봇이 메시지를 수신했습니다!\n요청하신 내용: ${text}\n(AI 분석 기능 연결 대기 중...)`)

  return res.status(200).json({ status: 'success' })
}
