import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { resetOwnerCache, ownerUserId } from './owner.js'
import { scheduleCreate, scheduleList } from './tools/schedule.js'
import { OWNER_UID, installFakes } from './testkit.js'

let fake
beforeEach(() => {
  fake = installFakes()
  resetOwnerCache()
})

const create = (extra = {}) => ({ title: '회의', date: '2026-10-28', time: '15:00', remind_before_min: 10, ...extra })

test('등록 인자 검사: 실제 날짜·시간 형식·알림 값·종일 일정 알림 금지·모르는 인자', () => {
  assert.equal(scheduleCreate.check(create()), null)
  assert.equal(scheduleCreate.check({ title: '휴가', date: '2026-11-02' }), null)
  assert.equal(scheduleCreate.check({ title: '종일', date: '2026-11-02', time: null, remind_before_min: null }), null)
  assert.match(scheduleCreate.check(create({ date: '2026-02-30' })), /실제 있는 날짜/)
  assert.match(scheduleCreate.check(create({ time: '3시' })), /HH:MM/)
  assert.match(scheduleCreate.check(create({ time: '24:00' })), /HH:MM/)
  assert.match(scheduleCreate.check(create({ remind_before_min: 15 })), /0, 10, 30, 60/)
  assert.match(scheduleCreate.check({ title: 'x', date: '2026-11-02', remind_before_min: 0 }), /종일 일정/)
  assert.match(scheduleCreate.check(create({ user_id: 'someone' })), /모르는 인자: user_id/)
  assert.match(scheduleCreate.check(create({ title: '' })), /title/)
})

test('등록 → 주인 user_id로 1행 생성, 원복 → 그 행만 삭제', async () => {
  fake.schedule.push({ id: 'keep', user_id: OWNER_UID, title: '원래 있던 일정', date: '2026-10-28' })
  const output = await scheduleCreate.run(create())
  assert.equal(fake.schedule.length, 2)
  const row = fake.schedule.find((r) => r.id === output.recordId)
  assert.deepEqual(
    { user_id: row.user_id, title: row.title, date: row.date, time: row.time, remind: row.remind_before_min },
    { user_id: OWNER_UID, title: '회의', date: '2026-10-28', time: '15:00', remind: 10 },
  )
  assert.match(output.summary, /10\/28\(수\) 15:00 · "회의" · 10분 전 알림/)

  const undone = await scheduleCreate.undo(create(), output)
  assert.match(undone.summary, /일정 삭제/)
  assert.deepEqual(fake.schedule.map((r) => r.id), ['keep'])
  assert.equal((await scheduleCreate.undo(create(), output)).summary, '이미 지워진 일정')
})

test('종일 일정은 시간·알림 없이 저장', async () => {
  await scheduleCreate.run({ title: '휴가', date: '2026-11-02' })
  assert.equal(fake.schedule[0].time, null)
  assert.equal(fake.schedule[0].remind_before_min, null)
})

test('조회 → 기간 안의 내 일정만 (다른 사용자 행 제외)', async () => {
  fake.schedule.push(
    { id: '1', user_id: OWNER_UID, title: '회의', date: '2026-10-28', time: '15:00' },
    { id: '2', user_id: OWNER_UID, title: '휴가', date: '2026-11-20', time: null },
    { id: '3', user_id: 'other-user', title: '남의 일정', date: '2026-10-29', time: '10:00' },
  )
  assert.equal(scheduleList.check({ from: '2026-10-26', to: '2026-11-01' }), null)
  assert.match(scheduleList.check({ from: '2026-11-01', to: '2026-10-26' }), /앞설 수 없/)
  assert.match(scheduleList.check({ from: '2026-01-01', to: '2026-06-01' }), /최대 62일/)
  const result = await scheduleList.run({ from: '2026-10-26', to: '2026-11-01' })
  assert.equal(result.count, 1)
  assert.match(result.summary, /일정 1건\n  · 10\/28\(수\) 15:00 회의/)
  assert.doesNotMatch(result.summary, /남의 일정/)
})

test('주인 찾기: 사용자 1명이면 자동, 2명이면 거부, AGENT_USER_ID가 있으면 그 값', async () => {
  assert.equal(await ownerUserId(), OWNER_UID)
  resetOwnerCache()
  fake.users.push({ id: '22222222-2222-4222-8222-222222222222' })
  await assert.rejects(ownerUserId(), /AGENT_USER_ID/)
  resetOwnerCache()
  process.env.AGENT_USER_ID = '33333333-3333-4333-8333-333333333333'
  assert.equal(await ownerUserId(), '33333333-3333-4333-8333-333333333333')
  resetOwnerCache()
  process.env.AGENT_USER_ID = 'not-a-uuid'
  await assert.rejects(ownerUserId(), /형식/)
})
