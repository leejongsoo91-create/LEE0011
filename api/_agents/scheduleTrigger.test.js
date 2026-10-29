// 4단계: 일정 자동 작업 크론(/api/agent-cron). 크론 호출 보안, 때 판단, 중복 방지, 항상 결재, 놓친 작업, 남은 작업 정리.

import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import handler, { MIN_SECRET_LENGTH, checkCronRequest } from '../agent-cron.js'
import { handleUpdate } from './approval.js'
import { resetOwnerCache } from './owner.js'
import { triggerKey } from './scheduleTrigger.js'
import { OWNER_UID, callWebhook, click, installFakes } from './testkit.js'

const SECRET = 'cron-secret-0123456789-abcdefghijklmn' // 32자 이상
let fake
beforeEach(() => {
  fake = installFakes()
  process.env.CRON_SECRET = SECRET
  resetOwnerCache()
})

const cron = (headers = { 'x-cron-secret': SECRET }, method = 'POST') => callWebhook(handler, { method, body: {}, headers })

// 지금부터 minutes분 뒤(한국 시간)의 날짜·시각
function kstAfter(minutes) {
  const iso = new Date(Date.now() + minutes * 60 * 1000 + 9 * 60 * 60 * 1000).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}
function addSchedule({ inMinutes, title = '주간 회고', agentTask = '오늘 일정 조회', before = 10, userId = OWNER_UID, time } = {}) {
  const at = kstAfter(inMinutes)
  const row = {
    id: crypto.randomUUID(),
    user_id: userId,
    title,
    date: at.date,
    time: time === undefined ? at.time : time,
    agent_task: agentTask,
    agent_before_min: before,
  }
  fake.schedule.push(row)
  return row
}
const approvals = () => fake.sent.filter((m) => m.reply_markup?.inline_keyboard)

test('보안: 시크릿이 맞는 POST만 통과하고, 거부할 때는 DB·텔레그램에 한 번도 닿지 않는다', async () => {
  addSchedule({ inMinutes: 5 })
  const sameLength = 'x'.repeat(SECRET.length)
  const rejected = [
    [{}, 'POST', 401],
    [{ 'x-cron-secret': 'wrong' }, 'POST', 401],
    [{ 'x-cron-secret': sameLength }, 'POST', 401],
    [{ 'x-cron-secret': ` ${SECRET}` }, 'POST', 401],
    [{ 'x-cron-secret': `${SECRET} ` }, 'POST', 401],
    [{ 'x-cron-secret': [SECRET, SECRET] }, 'POST', 401],
    [{ 'x-cron-secret': '' }, 'POST', 401],
    [{ authorization: `Bearer ${SECRET}` }, 'POST', 401],
    [{ 'x-cron-secret': SECRET }, 'GET', 405],
  ]
  for (const [headers, method, status] of rejected) {
    const result = await cron(headers, method)
    assert.equal(result.status, status, JSON.stringify(headers))
    assert.equal(JSON.stringify(result.body).includes(SECRET), false)
  }
  // 주소에 담은 시크릿은 보지 않는다
  assert.equal(checkCronRequest({ method: 'POST', headers: {}, query: { secret: SECRET }, url: `/api/agent-cron?secret=${SECRET}` }).status, 401)
  assert.equal(fake.dbCalls, 0)
  assert.equal(fake.sent.length, 0)
  assert.equal(fake.tasks.length, 0)

  const ok = await cron()
  assert.equal(ok.status, 200)
  assert.equal(ok.body.status, 'ok')
})

test('보안: CRON_SECRET이 없거나 32자보다 짧거나 앞뒤 공백이면 503, 아무것도 하지 않음', async () => {
  addSchedule({ inMinutes: 5 })
  for (const value of [undefined, '', 'short-secret', 'a'.repeat(MIN_SECRET_LENGTH - 1), ` ${SECRET}`]) {
    if (value === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = value
    const result = await cron({ 'x-cron-secret': value ?? '' })
    assert.equal(result.status, 503)
    assert.deepEqual(result.body, { error: 'not-configured' })
  }
  assert.equal(fake.dbCalls, 0)
  assert.equal(fake.sent.length, 0)
})

test('에이전트 꺼짐 → 시크릿이 맞아도 아무것도 하지 않음', async () => {
  fake = installFakes({ mode: null })
  process.env.CRON_SECRET = SECRET
  addSchedule({ inMinutes: 5 })
  assert.deepEqual((await cron()).body, { status: 'off' })
  assert.equal(fake.dbCalls, 0)
})

test('10분 전 설정, 일정 9분 뒤 → 작업 생성 + 🔔 알림 줄이 붙은 결재 요청 (읽기 전용이어도 결재)', async () => {
  const row = addSchedule({ inMinutes: 9 })
  const result = await cron()
  assert.equal(result.body.due, 1)
  assert.deepEqual(result.body.started, ['pending'])

  const task = fake.tasks[0]
  assert.equal(task.status, 'PENDING', '조회만 하는 계획이지만 자동 작업이라 결재 대기')
  assert.equal(task.source_key, triggerKey(row))
  assert.match(task.task_query, /^오늘 일정 조회 \(일정 '주간 회고' \d+\/\d+\(.\) \d\d:\d\d에 맞춘 자동 작업\)$/)
  assert.deepEqual(task.event_logs[0].origin.kind, 'schedule')
  assert.ok(!task.event_logs.some((e) => e.event === 'AUTO_APPROVED'))

  assert.equal(approvals().length, 1)
  const text = approvals()[0].text
  assert.match(text, /^🔔 \[스케줄 자동 알림\] '주간 회고' 일정\(\d+\/\d+\(.\) \d\d:\d\d\)이 다가와요\.\n계획된 작업을 실행할까요\?\n\n📝 \[결재 요청\]/)

  // 승인하면 지금과 같은 흐름으로 실행된다
  assert.equal(await handleUpdate(click(`a:${task.id}`)), 'approved')
  assert.equal(task.status, 'COMPLETED')
})

test('일정 11분 뒤(10분 전 설정) → 아직 아무것도 하지 않음', async () => {
  addSchedule({ inMinutes: 11 })
  const result = await cron()
  assert.equal(result.body.due, 0)
  assert.equal(fake.tasks.length, 0)
  assert.equal(fake.sent.length, 0)
})

test('크론이 동시에 두 번 → 작업 1개·메시지 1개, 다음 분에도 다시 만들지 않음', async () => {
  addSchedule({ inMinutes: 5 })
  await Promise.all([cron(), cron()])
  assert.equal(fake.tasks.length, 1)
  assert.equal(approvals().length, 1)
  const later = await cron()
  assert.equal(later.body.due, 0)
  assert.equal(fake.tasks.length, 1)
})

test('때가 된 일정 3개 → 호출마다 가장 이른 것 1개씩', async () => {
  const third = addSchedule({ inMinutes: 8, title: '셋째' })
  const first = addSchedule({ inMinutes: 2, title: '첫째' })
  const second = addSchedule({ inMinutes: 5, title: '둘째' })
  for (const row of [first, second, third]) {
    const result = await cron()
    assert.equal(result.body.started.length, 1)
    assert.equal(fake.tasks.at(-1).source_key, triggerKey(row))
  }
  assert.equal((await cron()).body.due, 0)
})

test('30분 넘게 늦게 발견 → 계획하지 않고 MISSED 알림 한 번', async () => {
  addSchedule({ inMinutes: -40, title: '늦은 회의' })
  const result = await cron()
  assert.equal(result.body.missed, 1)
  assert.deepEqual(result.body.started, [])
  const task = fake.tasks[0]
  assert.equal(task.status, 'FAILED')
  assert.equal(task.event_logs[0].event, 'MISSED')
  assert.equal(fake.sent.length, 1)
  assert.match(fake.sent[0].text, /^⏭️ 놓친 자동 작업이 있어요: '늦은 회의' 일정/)
  await cron()
  assert.equal(fake.sent.length, 1, '다시 알리지 않는다')
})

test('다른 사용자 일정·종일 일정·빈 에이전트 작업 → 대상 아님', async () => {
  addSchedule({ inMinutes: 5, userId: '22222222-2222-4222-8222-222222222222' })
  addSchedule({ inMinutes: 5, time: null })
  addSchedule({ inMinutes: 5, agentTask: '   ' })
  addSchedule({ inMinutes: 5, agentTask: null })
  const result = await cron()
  assert.equal(result.body.due, 0)
  assert.equal(fake.tasks.length, 0)
})

test('크론이 남은 작업도 정리한다 (만료된 결재 → EXPIRED)', async () => {
  addSchedule({ inMinutes: 5 })
  await cron()
  const task = fake.tasks[0]
  task.expires_at = new Date(Date.now() - 1000).toISOString()
  const result = await cron()
  assert.equal(result.body.swept, 1)
  assert.equal(task.event_logs.at(-1).event, 'EXPIRED')
})
