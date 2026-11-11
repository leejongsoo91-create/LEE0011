// 중앙관제 요약: /api/control-summary 의 문지기(로그인·주인 확인)와 요약 숫자

import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import handler from '../control-summary.js'
import { attentionReason, kstDayStart, summarizeTasks } from './control.js'
import { resetOwnerCache } from './owner.js'
import { callWebhook, installFakes, OWNER_UID } from './testkit.js'

const OTHER_UID = '22222222-2222-4222-8222-222222222222'
const TOKENS = { 'Bearer owner-token': OWNER_UID, 'Bearer other-token': OTHER_UID }

let fake
beforeEach(() => {
  fake = installFakes()
  resetOwnerCache()
  // 가짜 Supabase Auth: 로그인 토큰 → 사용자
  const base = globalThis.fetch
  fake.authCalls = 0
  globalThis.fetch = async (url, options = {}) => {
    if (new URL(url).pathname === '/auth/v1/user') {
      fake.authCalls += 1
      const id = TOKENS[options.headers?.Authorization]
      return id ? new Response(JSON.stringify({ id })) : new Response('{}', { status: 401 })
    }
    return base(url, options)
  }
})

const call = (headers = {}, method = 'GET') => callWebhook(handler, { method, headers })
const iso = (ms) => new Date(ms).toISOString()

const task = (fields) => ({
  id: crypto.randomUUID(),
  task_query: '할 일',
  status: 'COMPLETED',
  plan_payload: { steps: [{ tool: 'schedule.list', args: { secret: 'x' }, risk: 'read', dept: 'schedule' }] },
  event_logs: [],
  source_key: null,
  created_at: new Date().toISOString(),
  ...fields,
})

test('문지기: GET 외 405, 토큰 없음·틀림 401, 주인이 아니면 403 (DB는 읽지 않음)', async () => {
  const post = await call({ authorization: 'Bearer owner-token' }, 'POST')
  assert.equal(post.status, 405)
  assert.equal(post.headers.Allow, 'GET')
  assert.equal((await call()).status, 401)
  assert.equal((await call({ authorization: 'Bearer wrong' })).status, 401)
  assert.equal((await call({ authorization: 'owner-token' })).status, 401, 'Bearer가 없으면 Auth에 묻지도 않는다')
  assert.equal((await call({ authorization: 'Bearer other-token' })).status, 403)
  assert.equal(fake.dbCalls, 0)
})

test('주인이면 요약을 주고, 계획 원문·인자는 응답에 없다', async () => {
  fake.tasks.push(task({ task_query: '내일 일정 알려줘', plan_payload: { steps: [{ tool: 'schedule.list', args: { token: 'SECRET-ARG' }, dept: 'schedule' }] } }))
  fake.tasks.push(task({ status: 'PENDING' }))
  const result = await call({ authorization: 'Bearer owner-token' })
  assert.equal(result.status, 200)
  assert.equal(result.body.agent.waiting, 1)
  assert.equal(result.body.recent.length, 2)
  assert.deepEqual(result.body.recent.find((row) => row.query === '내일 일정 알려줘').depts, ['schedule'])
  const text = JSON.stringify(result.body)
  assert.doesNotMatch(text, /SECRET-ARG|plan_payload|event_logs|args/)
  assert.equal(result.body.recent[0].id.length, 8, 'id는 앞 8자리만')
})

test('DB 오류면 500, 원인 문구는 응답에 담지 않는다', async () => {
  fake.failDb = true
  const result = await call({ authorization: 'Bearer owner-token' })
  assert.equal(result.status, 500)
  assert.deepEqual(result.body, { error: 'summary-failed' })
})

test('오늘 경계는 한국 시간 0시', () => {
  const now = Date.parse('2026-11-06T00:30:00+09:00') // UTC로는 11/5 15:30
  assert.equal(kstDayStart(now), Date.parse('2026-11-06T00:00:00+09:00'))
  const tasks = [
    task({ status: 'COMPLETED', event_logs: [{ at: '2026-11-06T00:10:00+09:00', to: 'COMPLETED' }] }),
    task({ status: 'COMPLETED', event_logs: [{ at: '2026-11-05T23:50:00+09:00', to: 'COMPLETED' }] }),
  ]
  assert.equal(summarizeTasks(tasks, now).agent.doneToday, 1)
})

test('상태별 개수, 확인 필요 분류, 일정 자동 작업·투자 조회 집계', () => {
  const now = Date.now()
  const log = (event, extra = {}) => [{ at: iso(now - 60000), agent: 'orchestrator', event, ...extra }]
  const invest = { steps: [{ tool: 'invest.quote', dept: 'invest' }] }
  const tasks = [
    task({ status: 'PLANNING' }),
    task({ status: 'EXECUTING' }),
    task({ status: 'APPROVED' }),
    task({ status: 'PENDING', source_key: 'schedule:abc:2026-11-06T10:00' }),
    task({ status: 'PENDING' }),
    task({ status: 'FAILED', event_logs: log('INTERRUPTED') }),
    task({ status: 'FAILED', event_logs: log('STALLED'), source_key: 'schedule:def:2026-11-06T11:00' }),
    task({ status: 'COMPLETED', event_logs: log('STEP_UNCERTAIN') }),
    task({ status: 'COMPLETED', plan_payload: invest }),
    task({ status: 'FAILED', plan_payload: invest, event_logs: log('STEP_FAILED') }),
    task({ status: 'REJECTED' }),
  ]
  const summary = summarizeTasks(tasks, now)
  assert.deepEqual(summary.agent, { running: 3, waiting: 2, doneToday: 2, attention: 4 })
  assert.deepEqual(summary.schedule, { waiting: 1, attention: 1 })
  assert.deepEqual(summary.invest, { lookupsToday: 2, failedToday: 1 })
  assert.deepEqual(summary.attention.map((item) => item.reason).sort(), ['계획 단계에서 멈춤', '실패', '실행이 중간에 멈춤', '저장됐는지 확인 필요'].sort())
  assert.deepEqual(summary.attention.map((item) => item.area).sort(), ['agent', 'agent', 'invest', 'schedule'])
  assert.equal(summary.recent.length, 10, '최근 작업은 10건까지')
  assert.ok(summary.updatedAt)
})

test('확인 필요 이유: 성공·대기·반려는 해당 없음', () => {
  assert.equal(attentionReason(task({ status: 'COMPLETED' })), null)
  assert.equal(attentionReason(task({ status: 'PENDING' })), null)
  assert.equal(attentionReason(task({ status: 'REJECTED' })), null)
  assert.equal(attentionReason(task({ status: 'FAILED' })), '실패')
  const discarded = task({ status: 'FAILED' })
  discarded.event_logs = [...(discarded.event_logs ?? []), { agent: 'captain', event: 'DISCARDED' }]
  assert.equal(attentionReason(discarded), null, 'Plaud 녹음을 반려해 버린 것은 확인 필요가 아니다')
})

test('작업이 없으면 0과 빈 목록', () => {
  const summary = summarizeTasks([])
  assert.deepEqual(summary.agent, { running: 0, waiting: 0, doneToday: 0, attention: 0 })
  assert.deepEqual(summary.attention, [])
  assert.deepEqual(summary.recent, [])
  assert.equal(summary.updatedAt, null)
})
