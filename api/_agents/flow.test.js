// 지시 → 계획 → 검증 → (결재) → 실행 → 원복/보고 전체 흐름 테스트. 텔레그램에서 하는 일을 그대로 흉내 낸다.

import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { handleUpdate } from './approval.js'
import { planAndRoute } from './orchestrator.js'
import { sandbox } from './registry.js'
import { createTask } from './tasks.js'
import { click, installFakes, message } from './testkit.js'

let fake
let updateId = 1000
beforeEach(() => {
  fake = installFakes()
  sandbox.clear()
})

const send = (text, options = {}) => handleUpdate(message(text, { updateId: updateId++, ...options }))
const events = (task) => task.event_logs.map((e) => e.event)
const lastTask = () => fake.tasks.at(-1)

test('1. "조회" 지시 → 결재 버튼 없이 바로 실행, COMPLETED 보고', async () => {
  assert.equal(await send('오늘 일정 조회'), 'completed')
  const task = lastTask()
  assert.equal(task.status, 'COMPLETED')
  assert.deepEqual(events(task), ['CREATED', 'PLANNED', 'AUTO_APPROVED', 'EXECUTE_START', 'STEP_START', 'STEP_DONE', 'COMPLETED'])
  assert.deepEqual(task.event_logs[1].rules, { global: true, deptTemplate: true, depts: { schedule: true, invest: true, agents: true } })
  assert.equal(fake.sent.length, 1)
  assert.equal(fake.sent[0].reply_markup, undefined, '결재 버튼이 없어야 한다')
  assert.match(fake.sent[0].text, /✅ 완료[\s\S]*결재 없이 실행[\s\S]*규칙서: 전사 공통 ✓ · 일정 부서 ✓/)
})

test('2. 쓰기 지시 → 결재 요청 → 승인 → 실행 → COMPLETED', async () => {
  assert.equal(await send('내일 3시 회의'), 'pending')
  const task = lastTask()
  assert.match(fake.sent[0].text, /결재 요청[\s\S]*테스트 쓰기 \[쓰기·원복 가능\]/)
  assert.equal(await handleUpdate(click(`a:${task.id}`)), 'approved')
  assert.equal(task.status, 'COMPLETED')
  assert.equal(sandbox.size, 1)
  assert.match(fake.sent.at(-1).text, /✅ 완료[\s\S]*1\. 테스트 쓰기 — 테스트 기록 1건 작성/)
})

test('3. "실패" 지시 → 승인 → 2단계 실패 → 1단계 원복 → FAILED 보고', async () => {
  await send('실패 테스트')
  const task = lastTask()
  await handleUpdate(click(`a:${task.id}`))
  assert.equal(task.status, 'FAILED')
  assert.equal(task.event_logs.at(-1).event, 'ROLLED_BACK')
  assert.equal(sandbox.size, 0)
  const report = fake.sent.at(-1).text
  assert.match(report, /↩️ 실패 → 원복 완료/)
  assert.match(report, /실패한 단계: 2\. 실패하는 테스트 쓰기 — 의도된 실패/)
  assert.match(report, /되돌린 단계 \(역순\):\n1\. 테스트 쓰기 — 원복 완료/)
})

test('4. "원복실패" 지시 → 원복도 실패 → 경고 보고', async () => {
  await send('원복실패 테스트')
  await handleUpdate(click(`a:${lastTask().id}`))
  assert.equal(lastTask().event_logs.at(-1).event, 'UNDO_FAILED')
  assert.match(fake.sent.at(-1).text, /🚨 실패 → 원복도 실패[\s\S]*❗원복 실패/)
})

test('5·6·7. 검증에 걸리는 계획 → 결재 요청 없이 FAILED와 사유 보고', async () => {
  const bad = [
    { steps: [{ tool: 'evil.tool', args: {}, risk: 'read' }] },
    { steps: Array.from({ length: 6 }, () => ({ tool: 'test.write', args: { text: 'x' }, risk: 'write' })) },
    { steps: [{ tool: 'test.write', args: { text: 'x' }, risk: 'read' }] },
  ]
  for (const plan of bad) {
    const task = await createTask({ query: '이상한 계획', sourceUpdateId: updateId++, status: 'PLANNING', log: { event: 'CREATED' } })
    assert.equal(await planAndRoute(task, 42, { planner: () => plan }), 'invalid')
    assert.equal(lastTask().status, 'FAILED')
    assert.equal(lastTask().event_logs.at(-1).event, 'VALIDATION_FAILED')
    assert.match(fake.sent.at(-1).text, /계획 검증 실패/)
    assert.equal(fake.sent.at(-1).reply_markup, undefined)
  }
  assert.equal(sandbox.size, 0)
})

test('8. 반려 → 사유 답장 → 재계획 → 새 결재 요청 (사유가 feedback에 저장)', async () => {
  await send('실패 테스트')
  const task = lastTask()
  assert.equal(await handleUpdate(click(`r:${task.id}`)), 'rejected')
  const prompt = fake.sent.at(-1)
  assert.equal(prompt.reply_markup.force_reply, true)
  assert.equal(task.event_logs.at(-1).prompt_message_id, prompt.message_id)

  assert.equal(await send('조회만 해 줘', { replyTo: prompt.message_id }), 'completed')
  assert.equal(task.feedback, '조회만 해 줘')
  assert.equal(task.plan_payload.scenario, 'lookup')
  assert.equal(fake.tasks.length, 1, '새 작업이 아니라 같은 작업을 다시 계획한다')
  assert.ok(events(task).includes('REPLANNING'))

  // 쓰기로 재계획되는 경우: 재계획 회차와 사유가 결재 요청에 보인다.
  await send('쓰기 테스트')
  const second = lastTask()
  await handleUpdate(click(`r:${second.id}`))
  assert.equal(await send('제목을 바꿔서 다시', { replyTo: fake.sent.at(-1).message_id }), 'pending')
  assert.equal(second.status, 'PENDING')
  assert.match(fake.sent.at(-1).text, /재계획 1회차 · 반려 사유: 제목을 바꿔서 다시/)
})

test('9. 반려 → "취소" 답장 → FAILED(CANCELLED)', async () => {
  await send('회의')
  const task = lastTask()
  await handleUpdate(click(`r:${task.id}`))
  assert.equal(await send('취소', { replyTo: fake.sent.at(-1).message_id }), 'cancelled')
  assert.equal(task.status, 'FAILED')
  assert.equal(task.event_logs.at(-1).event, 'CANCELLED')
  assert.equal(fake.tasks.length, 1)
})

test('10. 반려 4번째 → FAILED, 더 이상 재계획하지 않음', async () => {
  await send('회의')
  const task = lastTask()
  for (let i = 1; i <= 3; i++) {
    assert.equal(await handleUpdate(click(`r:${task.id}`)), 'rejected')
    assert.equal(await send(`다시 ${i}`, { replyTo: fake.sent.at(-1).message_id }), 'pending')
  }
  assert.equal(await handleUpdate(click(`r:${task.id}`)), 'reject-limit')
  assert.equal(task.status, 'FAILED')
  assert.equal(task.reject_count, 4)
  assert.equal(task.event_logs.at(-1).event, 'REJECT_LIMIT')
})

test('12. 2분 넘게 멈춘 EXECUTING 작업 → 새 메시지가 올 때 FAILED(INTERRUPTED) + 알림', async () => {
  const old = new Date(Date.now() - 3 * 60 * 1000).toISOString()
  const stuck = await createTask({ query: '멈춘 작업', sourceUpdateId: updateId++, status: 'EXECUTING', log: { event: 'X' } })
  const row = fake.tasks.find((t) => t.id === stuck.id)
  row.event_logs = [{ at: old, event: 'STEP_START', step: 1 }]
  const fresh = await createTask({ query: '방금 시작', sourceUpdateId: updateId++, status: 'EXECUTING', log: { event: 'STEP_START', step: 1 } })

  await send('오늘 일정 조회')
  assert.equal(row.status, 'FAILED')
  assert.equal(row.event_logs.at(-1).event, 'INTERRUPTED')
  assert.equal(fake.tasks.find((t) => t.id === fresh.id).status, 'EXECUTING', '최근 작업은 건드리지 않는다')
  assert.match(fake.sent[0].text, /끊긴 작업을 정리[\s\S]*마지막 기록: 1단계 시작[\s\S]*자동으로 되돌리지 않았어요/)
})

test('12-2. 만료된 결재 대기·30분 넘은 반려 사유 대기도 정리된다', async () => {
  await send('회의')
  const pending = lastTask()
  pending.expires_at = new Date(Date.now() - 1000).toISOString()
  await send('회의 2')
  const rejected = lastTask()
  await handleUpdate(click(`r:${rejected.id}`))
  rejected.event_logs.at(-1).at = new Date(Date.now() - 31 * 60 * 1000).toISOString()

  await send('조회')
  assert.equal(pending.event_logs.at(-1).event, 'EXPIRED')
  assert.equal(rejected.event_logs.at(-1).event, 'REASON_TIMEOUT')
})

test('13. 같은 승인 버튼을 동시에 두 번 → 실행은 정확히 한 번', async () => {
  await send('회의')
  const task = lastTask()
  const results = await Promise.all([handleUpdate(click(`a:${task.id}`)), handleUpdate(click(`a:${task.id}`))])
  assert.deepEqual(results.sort(), ['already', 'approved'])
  assert.equal(events(task).filter((e) => e === 'EXECUTE_START').length, 1)
  assert.equal(sandbox.size, 1)
})

test('답장이지만 반려 사유 메시지가 아닌 경우 → 새 지시로 처리', async () => {
  assert.equal(await send('회의', { replyTo: 12345 }), 'pending')
  assert.equal(fake.tasks.length, 1)
})
