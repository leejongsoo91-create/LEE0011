// 자동 테스트용 가짜 Supabase(PostgREST)와 가짜 텔레그램. 실제 서버에는 아무 요청도 가지 않는다.

import { randomUUID } from 'node:crypto'

export const OWNER = '42'

export function installFakes({ mode = 'on' } = {}) {
  process.env.TELEGRAM_BOT_TOKEN = 'TOKEN'
  process.env.TELEGRAM_CHAT_ID = OWNER
  process.env.SUPABASE_URL = 'https://mock.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  if (mode) process.env.AGENT_MODE = mode
  else delete process.env.AGENT_MODE

  const fake = { tasks: [], sent: [], edits: [], answers: [], dbCalls: 0, failDb: false, failTelegram: false }
  let nextMessageId = 500
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status })

  globalThis.fetch = async (url, options = {}) => {
    const address = new URL(url)
    const body = options.body ? JSON.parse(options.body) : undefined

    if (address.hostname === 'api.telegram.org') {
      const method = address.pathname.split('/').pop()
      if (fake.failTelegram) return json({ ok: false }, 500)
      if (method === 'sendMessage') {
        const messageId = nextMessageId++
        fake.sent.push({ ...body, message_id: messageId })
        return json({ ok: true, result: { message_id: messageId } })
      }
      if (method === 'editMessageText') fake.edits.push(body)
      if (method === 'answerCallbackQuery') fake.answers.push(body)
      return json({ ok: true })
    }

    // Supabase REST: agent_tasks 표 하나만 흉내 낸다.
    fake.dbCalls += 1
    if (fake.failDb) return json({ message: 'boom' }, 500)
    const method = options.method ?? 'GET'
    // eq.값 과 in.(값,값) 필터만 흉내 낸다. order·limit 등은 무시한다.
    const filters = [...address.searchParams]
      .filter(([, value]) => value.startsWith('eq.') || value.startsWith('in.('))
      .map(([key, value]) => [key, value.startsWith('eq.') ? [value.slice(3)] : value.slice(4, -1).split(',')])
    const matches = (row) => filters.every(([key, values]) => values.includes(String(row[key])))

    if (method === 'POST') {
      if (fake.tasks.some((row) => row.source_update_id === body.source_update_id)) return json([])
      const row = { id: randomUUID(), reject_count: 0, feedback: null, created_at: new Date().toISOString(), ...body }
      fake.tasks.push(row)
      return json([structuredClone(row)], 201)
    }
    if (method === 'PATCH') {
      const rows = fake.tasks.filter(matches)
      rows.forEach((row) => Object.assign(row, body))
      return json(structuredClone(rows))
    }
    return json(structuredClone(fake.tasks.filter(matches)))
  }
  return fake
}

export const message = (text, { updateId = 1, chatId = 42, replyTo } = {}) => ({
  update_id: updateId,
  message: { message_id: 10, chat: { id: chatId }, text, ...(replyTo != null ? { reply_to_message: { message_id: replyTo } } : {}) },
})

export const click = (data, { chatId = 42, messageId = 77 } = {}) => ({
  update_id: 999,
  callback_query: { id: 'cb1', from: { id: chatId }, message: { message_id: messageId, chat: { id: chatId } }, data },
})

// 웹훅 핸들러를 직접 호출할 때 쓰는 가짜 요청·응답
export async function callWebhook(handler, { method = 'POST', body, headers = {} } = {}) {
  const result = { status: 0, body: null, headers: {} }
  const res = {
    setHeader: (key, value) => (result.headers[key] = value),
    status: (code) => ((result.status = code), res),
    json: (value) => ((result.body = value), res),
  }
  await handler({ method, body, headers }, res)
  return result
}
