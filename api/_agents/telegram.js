// 결재 흐름용 텔레그램 호출. 실패해도 예외를 던지지 않고 { ok: false }를 돌려준다.

async function call(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return { ok: false }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { ok: response.ok }
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
