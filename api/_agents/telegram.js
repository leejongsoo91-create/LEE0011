// 결재 흐름용 텔레그램 호출. 실패해도 예외를 던지지 않고 { ok: false }를 돌려준다.
// sendMessage는 보낸 메시지 번호(messageId)도 돌려준다. (반려 사유 답장이 어느 작업 것인지 찾을 때 쓴다)

async function call(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return { ok: false }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => null)
    return { ok: response.ok, messageId: data?.result?.message_id ?? null }
  } catch (error) {
    console.error(`[agents] 텔레그램 ${method} 실패`, error)
    return { ok: false }
  }
}

export const sendMessage = (chatId, text, replyMarkup) =>
  call('sendMessage', { chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) })

export const answerCallbackQuery = (callbackQueryId, text) =>
  call('answerCallbackQuery', { callback_query_id: callbackQueryId, text })

// 메시지 글자를 바꾸고 버튼을 모두 없앤다.
export const editMessageText = (chatId, messageId, text) =>
  call('editMessageText', { chat_id: chatId, message_id: messageId, text, reply_markup: { inline_keyboard: [] } })

// 이 메시지에 바로 답장하도록 입력창을 띄운다.
export const forceReply = (placeholder) => ({ force_reply: true, input_field_placeholder: placeholder })
