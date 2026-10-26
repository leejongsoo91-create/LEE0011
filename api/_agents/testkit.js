// 자동 테스트용 가짜 Supabase(PostgREST)와 가짜 텔레그램. 실제 서버에는 아무 요청도 가지 않는다.

import { randomUUID } from 'node:crypto'

export const OWNER = '42'
export const OWNER_UID = '11111111-1111-4111-8111-111111111111'

export function installFakes({ mode = 'on' } = {}) {
  process.env.TELEGRAM_BOT_TOKEN = 'TOKEN'
  process.env.TELEGRAM_CHAT_ID = OWNER
  process.env.SUPABASE_URL = 'https://mock.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.AGENT_PLANNER
  delete process.env.AGENT_USER_ID
  if (mode) process.env.AGENT_MODE = mode
  else delete process.env.AGENT_MODE

  const tables = { agent_tasks: [], schedule: [] }
  const fake = { tables, tasks: tables.agent_tasks, schedule: tables.schedule, users: [{ id: OWNER_UID }], sent: [], edits: [], answers: [], dbCalls: 0, failDb: false, failTelegram: false, failScheduleInsert: false }
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

    // Supabase Auth 관리자 API: 사용자 목록
    if (address.pathname.startsWith('/auth/v1/admin/users')) return json({ users: fake.users })

    // Supabase REST: agent_tasks·schedule 표를 흉내 낸다.
    fake.dbCalls += 1
    if (fake.failDb) return json({ message: 'boom' }, 500)
    const method = options.method ?? 'GET'
    const table = tables[address.pathname.split('/').pop()]
    if (!table) return json({ message: 'no table' }, 404)
    // eq.값 과 in.(값,값) 필터만 흉내 낸다. order·limit 등은 무시한다.
    const filters = [...address.searchParams]
      .filter(([, value]) => /^(eq|gte|lte)\./.test(value) || value.startsWith('in.('))
      .map(([key, value]) => {
        if (value.startsWith('in.(')) return (row) => value.slice(4, -1).split(',').includes(String(row[key]))
        const [op, ...rest] = value.split('.')
        const target = rest.join('.')
        if (op === 'gte') return (row) => String(row[key]) >= target
        if (op === 'lte') return (row) => String(row[key]) <= target
        return (row) => String(row[key]) === target
      })
    const matches = (row) => filters.every((test) => test(row))

    if (method === 'POST') {
      if (table === tables.schedule) {
        if (fake.failScheduleInsert) return json({ message: 'insert failed' }, 500)
        const row = { id: randomUUID(), created_at: new Date().toISOString(), ...body }
        table.push(row)
        return json([structuredClone(row)], 201)
      }
      if (table.some((row) => row.source_update_id === body.source_update_id)) return json([])
      const row = { id: randomUUID(), reject_count: 0, feedback: null, created_at: new Date().toISOString(), ...body }
      table.push(row)
      return json([structuredClone(row)], 201)
    }
    if (method === 'PATCH') {
      const rows = table.filter(matches)
      rows.forEach((row) => Object.assign(row, body))
      return json(structuredClone(rows))
    }
    if (method === 'DELETE') {
      const rows = table.filter(matches)
      rows.forEach((row) => table.splice(table.indexOf(row), 1))
      return json(structuredClone(rows))
    }
    return json(structuredClone(table.filter(matches)))
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

// 가짜 Anthropic 클라이언트: messages.create가 정해 둔 submit_plan 입력을 돌려준다.
// reply가 함수면 요청(params)을 받아 입력을 만든다. 오류 객체면 그 오류를 던진다.
export function fakeAnthropic(reply) {
  const calls = []
  return {
    calls,
    messages: {
      create: async (params) => {
        calls.push(params)
        const input = typeof reply === 'function' ? reply(params) : reply
        if (input instanceof Error) throw input
        if (typeof input === 'string') return { stop_reason: 'end_turn', content: [{ type: 'text', text: input }] }
        return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_plan', id: 'tu_1', input }] }
      },
    },
  }
}
