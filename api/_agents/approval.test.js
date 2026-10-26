import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { handleUpdate } from './approval.js'
import handler from '../webhook.js'
import { hashPlan } from './plan.js'
import { callWebhook, click, installFakes, message } from './testkit.js'

let fake
beforeEach(() => {
  fake = installFakes()
})

// 새 지시를 하나 보내 결재 대기 작업과 그 버튼 데이터를 얻는다.
let nextUpdateId = 100
async function createPending(text = '내일 3시 회의') {
  assert.equal(await handleUpdate(message(text, { updateId: nextUpdateId++ })), 'created')
  const task = fake.tasks.at(-1)
  return { task, approve: `a:${task.id}`, reject: `r:${task.id}` }
}

test('1. 새 지시 → 작업 1건 생성, 결재 메시지(버튼 2개) 전송, 상태 PENDING', async () => {
  const { task } = await createPending()
  assert.equal(fake.tasks.length, 1)
  assert.equal(task.status, 'PENDING')
  assert.equal(task.task_query, '내일 3시 회의')
  assert.equal(task.plan_hash, hashPlan(task.plan_payload))
  assert.ok(new Date(task.expires_at) > new Date())
  assert.equal(fake.sent.length, 1)
  const buttons = fake.sent[0].reply_markup.inline_keyboard[0]
  assert.deepEqual(buttons.map((b) => b.callback_data), [`a:${task.id}`, `r:${task.id}`])
  assert.ok(buttons.every((b) => Buffer.byteLength(b.callback_data) <= 64))
})

test('2. 같은 update_id 재전송 → 작업·메시지가 더 생기지 않는다', async () => {
  await handleUpdate(message('지시', { updateId: 5 }))
  assert.equal(await handleUpdate(message('지시', { updateId: 5 })), 'duplicate')
  assert.equal(fake.tasks.length, 1)
  assert.equal(fake.sent.length, 1)
})

test('3. [승인] → APPROVED, 버튼 제거, 로그 기록', async () => {
  const { task, approve } = await createPending()
  assert.equal(await handleUpdate(click(approve)), 'approved')
  assert.equal(task.status, 'APPROVED')
  assert.equal(task.event_logs.at(-1).event, 'APPROVED')
  assert.equal(task.event_logs.length, 2)
  assert.deepEqual(fake.edits[0].reply_markup, { inline_keyboard: [] })
  assert.match(fake.edits[0].text, /승인됨/)
  assert.equal(fake.answers.length, 1)
})

test('4. [반려] → REJECTED, reject_count 1', async () => {
  const { task, reject } = await createPending()
  assert.equal(await handleUpdate(click(reject)), 'rejected')
  assert.equal(task.status, 'REJECTED')
  assert.equal(task.reject_count, 1)
})

test('5. 같은 버튼을 두 번(순서대로, 그리고 동시에) 눌러도 한 번만 처리된다', async () => {
  const first = await createPending('순서대로')
  assert.equal(await handleUpdate(click(first.approve)), 'approved')
  assert.equal(await handleUpdate(click(first.approve)), 'already')
  assert.equal(await handleUpdate(click(first.reject)), 'already')
  assert.equal(first.task.status, 'APPROVED')
  assert.equal(first.task.event_logs.length, 2)

  const second = await createPending('동시에')
  const results = await Promise.all([handleUpdate(click(second.approve)), handleUpdate(click(second.reject))])
  assert.deepEqual(results.filter((r) => r === 'approved' || r === 'rejected').length, 1)
  assert.equal(second.task.event_logs.length, 2)
})

test('6. 만료 후 클릭 → FAILED + EXPIRED 로그', async () => {
  const { task, approve } = await createPending()
  task.expires_at = new Date(Date.now() - 1000).toISOString()
  assert.equal(await handleUpdate(click(approve)), 'expired')
  assert.equal(task.status, 'FAILED')
  assert.equal(task.event_logs.at(-1).event, 'EXPIRED')
  assert.match(fake.edits[0].text, /만료/)
})

test('7. 계획이 바뀐 뒤(해시 불일치) 승인 → 거부, FAILED', async () => {
  const { task, approve } = await createPending()
  task.plan_payload = { ...task.plan_payload, steps: [{ tool: 'evil.tool', args: {}, risk: 'write' }] }
  assert.equal(await handleUpdate(click(approve)), 'hash-mismatch')
  assert.equal(task.status, 'FAILED')
  assert.equal(task.event_logs.at(-1).event, 'HASH_MISMATCH')
})

test('8. 내 채팅이 아닌 곳의 메시지·버튼 → 무시하고 DB·텔레그램에 아무 일도 없다', async () => {
  const { task, approve } = await createPending()
  const callsBefore = fake.dbCalls
  const sentBefore = fake.sent.length
  assert.equal(await handleUpdate(message('침입', { chatId: 99, updateId: 2 })), 'not-owner')
  assert.equal(await handleUpdate(click(approve, { chatId: 99 })), 'not-owner')
  assert.equal(fake.dbCalls, callsBefore)
  assert.equal(fake.sent.length, sentBefore)
  assert.equal(fake.answers.length, 0)
  assert.equal(task.status, 'PENDING')
})

test('9. 글자 없는 이벤트·알 수 없는 업데이트·잘못된 버튼 데이터 → 조용히 넘어간다', async () => {
  assert.equal(await handleUpdate({ update_id: 3, message: { chat: { id: 42 }, new_chat_members: [{}] } }), 'no-text')
  assert.equal(await handleUpdate({ update_id: 4, edited_message: {} }), 'ignored')
  assert.equal(await handleUpdate({}), 'ignored')
  assert.equal(await handleUpdate(click('x:not-a-uuid')), 'bad-data')
  assert.equal(await handleUpdate(click("a:1' or '1'='1")), 'bad-data')
  assert.equal(await handleUpdate(click('a:00000000-0000-4000-8000-000000000000')), 'not-found')
  assert.equal(fake.tasks.length, 0)
})

test('10. DB·텔레그램 오류가 나도 웹훅은 200을 돌려준다', async () => {
  fake.failDb = true
  let result = await callWebhook(handler, { body: message('지시') })
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { status: 'success' })
  assert.match(fake.sent.at(-1).text, /저장하지 못했어요/)

  fake.failDb = false
  fake.failTelegram = true
  result = await callWebhook(handler, { body: message('지시', { updateId: 8 }) })
  assert.equal(result.status, 200)
  assert.equal(fake.tasks.at(-1).status, 'FAILED')
  assert.equal(fake.tasks.at(-1).event_logs.at(-1).event, 'SEND_FAILED')
})

test('11. AGENT_MODE가 꺼져 있으면 기존 echo 응답 그대로, DB는 건드리지 않는다', async () => {
  fake = installFakes({ mode: null })
  const result = await callWebhook(handler, { body: message('안녕') })
  assert.equal(result.status, 200)
  assert.equal(fake.dbCalls, 0)
  assert.equal(fake.sent.length, 1)
  assert.match(fake.sent[0].text, /봇이 메시지를 수신했습니다/)
  assert.match(fake.sent[0].text, /안녕/)
  assert.equal(fake.sent[0].reply_markup, undefined)
})

test('12. 시크릿 헤더 검사와 POST 전용은 기존대로 동작한다', async () => {
  process.env.TELEGRAM_WEBHOOK_SECRET = 's3cret'
  assert.equal((await callWebhook(handler, { body: message('x') })).status, 401)
  assert.equal((await callWebhook(handler, { body: message('x'), headers: { 'x-telegram-bot-api-secret-token': 'bad' } })).status, 401)
  assert.equal(fake.tasks.length, 0)
  const ok = await callWebhook(handler, { body: message('x'), headers: { 'x-telegram-bot-api-secret-token': 's3cret' } })
  assert.equal(ok.status, 200)
  assert.equal(fake.tasks.length, 1)
  const get = await callWebhook(handler, { method: 'GET' })
  assert.equal(get.status, 405)
  assert.equal(get.headers.Allow, 'POST')
})
