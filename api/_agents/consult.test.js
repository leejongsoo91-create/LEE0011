// 메인 ↔ 크로스체크 상의 구조와 시간 예산

import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { handleUpdate } from './approval.js'
import { planAndRoute } from './orchestrator.js'
import { buildTestPlan } from './plan.js'
import { createTask } from './tasks.js'
import { click, installFakes, message } from './testkit.js'

let fake
let updateId = 30000
beforeEach(() => {
  fake = installFakes()
  process.env.AGENT_PROGRAM_CROSSCHECK = 'test'
  delete process.env.AGENT_PLANNING_BUDGET_MS
})
const send = (text) => handleUpdate(message(text, { updateId: updateId++ }))
const lastTask = () => fake.tasks.at(-1)
const events = (task) => task.event_logs.map((e) => e.event)
const newTask = (query = '회의') => createTask({ query, sourceUpdateId: updateId++, status: 'PLANNING', log: { agent: 'intake', event: 'CREATED' } })

test('크로스체크가 바로 동의 → 결재 요청에 "동의 (바로)"', async () => {
  assert.equal(await send('회의'), 'pending')
  assert.deepEqual(events(lastTask()), ['CREATED', 'PLANNED', 'CROSSCHECK_AGREED', 'VALIDATED'])
  assert.equal(lastTask().plan_payload.review.verdict, 'agreed')
  assert.match(fake.sent.at(-1).text, /🔍 크로스체크: 동의 \(바로\)/)
})

test('"이의 테스트": 이의 1회 → 메인이 고침 → 동의 → 결재 요청에 "동의 (상의 1회)"', async () => {
  assert.equal(await send('회의 이의 테스트'), 'pending')
  const task = lastTask()
  assert.deepEqual(events(task), ['CREATED', 'PLANNED', 'CROSSCHECK_OBJECTION', 'PLAN_REVISED', 'CROSSCHECK_AGREED', 'VALIDATED'])
  assert.equal(task.plan_payload.revision, 1)
  assert.deepEqual(task.plan_payload.review, { program: 'test', verdict: 'agreed', rounds: 1, comments: ['테스트 이의: 계획을 한 번 고쳐서 다시 보여 주세요'] })
  const text = fake.sent.at(-1).text
  assert.match(text, /요약: 크로스체크 의견 반영 \(1회\)/)
  assert.match(text, /🔍 크로스체크: 동의 \(상의 1회\)/)
  // 결재는 상의 결과까지 포함한 최종 계획에 묶인다
  await handleUpdate(click(`a:${task.id}`))
  assert.equal(task.status, 'COMPLETED')
})

test('"이의 유지 테스트": 2회 고쳐도 이견 → 결재 요청에 이견 표시, 읽기 전용이어도 자동 실행하지 않음', async () => {
  assert.equal(await send('일정 조회 이의 유지 테스트'), 'pending')
  const task = lastTask()
  assert.equal(events(task).filter((e) => e === 'CROSSCHECK_OBJECTION').length, 3)
  assert.equal(events(task).filter((e) => e === 'PLAN_REVISED').length, 2)
  assert.equal(task.plan_payload.review.verdict, 'unresolved')
  assert.ok(!events(task).includes('AUTO_APPROVED'))
  assert.match(fake.sent.at(-1).text, /⚠️ 크로스체크 이견 \(상의 2회 후에도\): 테스트 이의\(유지\)/)
  assert.ok(fake.sent.at(-1).reply_markup.inline_keyboard)
})

test('크로스체크 꺼짐 → 상의 없이 지금과 같음 (코드 검사만)', async () => {
  process.env.AGENT_PROGRAM_CROSSCHECK = 'off'
  assert.equal(await send('회의 이의 테스트'), 'pending')
  assert.deepEqual(events(lastTask()), ['CREATED', 'PLANNED', 'VALIDATED'])
  assert.match(fake.sent.at(-1).text, /🔍 크로스체크: 코드 검사만/)
  assert.equal(await send('일정 조회'), 'completed', '읽기 전용은 그대로 자동 실행')
})

test('코드 검사 위반은 상의하지 않고 바로 거부', async () => {
  let reviewed = 0
  const task = await newTask()
  const result = await planAndRoute(task, 42, {
    planner: () => ({ steps: [{ tool: 'evil.tool', args: {}, risk: 'read' }] }),
    reviewer: async () => (reviewed++, { verdict: 'agree' }),
  })
  assert.equal(result, 'invalid')
  assert.equal(reviewed, 0)
  assert.equal(lastTask().event_logs.at(-1).agent, 'crosscheck')
})

test('메인이 고친 계획이 코드 검사에 걸리면 거부', async () => {
  const task = await newTask()
  const result = await planAndRoute(task, 42, {
    planner: (query, options) => (options.round === 0 ? buildTestPlan(query) : { steps: [{ tool: 'test.write', args: { text: 'x' }, risk: 'read' }] }),
    reviewer: async ({ round }) => (round === 0 ? { verdict: 'object', comments: ['고쳐 주세요'] } : { verdict: 'agree' }),
  })
  assert.equal(result, 'invalid')
  assert.deepEqual(events(lastTask()).slice(-3), ['CROSSCHECK_OBJECTION', 'PLAN_REVISED', 'VALIDATION_FAILED'])
})

test('크로스체크 오류 → 상의 없이 결재로, 오류를 표시 (읽기 전용도 결재 필요)', async () => {
  const task = await newTask('일정 조회')
  const result = await planAndRoute(task, 42, { reviewer: async () => { throw new Error('supabase-500') } })
  assert.equal(result, 'pending')
  assert.equal(lastTask().plan_payload.review.verdict, 'error')
  assert.match(fake.sent.at(-1).text, /⚠️ 크로스체크 에이전트 오류: 데이터베이스 오류 \(500\)/)
})

test('크로스체크가 이상한 답을 하면 이의로 본다', async () => {
  const task = await newTask('일정 조회')
  await planAndRoute(task, 42, { reviewer: async () => ({ verdict: 'maybe' }) })
  assert.equal(lastTask().plan_payload.review.verdict, 'unresolved')
  assert.match(fake.sent.at(-1).text, /이유 없이 동의하지 않았어요/)
})

test('메인이 고치다가 되묻기 → NEEDS_INFO로 닫음', async () => {
  const task = await newTask()
  const result = await planAndRoute(task, 42, {
    planner: (query, options) => (options.round === 0 ? buildTestPlan(query) : { clarification: '어느 날짜인가요?' }),
    reviewer: async () => ({ verdict: 'object', comments: ['날짜가 애매해요'] }),
  })
  assert.equal(result, 'needs-info')
  assert.equal(lastTask().status, 'FAILED')
  assert.match(fake.sent.at(-1).text, /어느 날짜인가요/)
})

test('시간 예산: 크로스체크를 부를 시간이 없으면 상의를 멈추고 결재로 (읽기 전용도)', async () => {
  process.env.AGENT_PLANNING_BUDGET_MS = '6000'
  assert.equal(await send('일정 조회'), 'pending')
  assert.equal(lastTask().plan_payload.review.verdict, 'timeout')
  assert.match(fake.sent.at(-1).text, /⏱️ 시간 부족으로 상의 중단 \(상의 0회\)/)
})

test('시간 예산: 이의 뒤 메인이 고칠 시간이 없으면 그때까지의 계획으로 결재', async () => {
  let now = 0
  const task = await newTask()
  const result = await planAndRoute(task, 42, {
    clock: () => now,
    planner: (query, options) => {
      assert.ok(options.timeoutMs <= 30000)
      return buildTestPlan(query, options)
    },
    reviewer: async ({ timeoutMs }) => {
      assert.ok(timeoutMs <= 15000)
      now += 44000 // 검토가 오래 걸림 → 남은 시간 6초 - 여유 3초 < 5초
      return { verdict: 'object', comments: ['다시'] }
    },
  })
  assert.equal(result, 'pending')
  assert.equal(lastTask().plan_payload.review.verdict, 'timeout')
  assert.equal(lastTask().plan_payload.review.rounds, 0)
  assert.ok(!events(lastTask()).includes('PLAN_REVISED'))
})

test('메인·크로스체크에게 남은 시간 안에서만 시간 한도를 준다', async () => {
  process.env.AGENT_PLANNING_BUDGET_MS = '20000'
  const seen = []
  const task = await newTask()
  await planAndRoute(task, 42, {
    planner: (query, options) => (seen.push(['main', options.timeoutMs]), buildTestPlan(query, options)),
    reviewer: async ({ timeoutMs }) => (seen.push(['crosscheck', timeoutMs]), { verdict: 'agree' }),
  })
  assert.equal(seen[0][0], 'main')
  assert.ok(seen[0][1] <= 17000 && seen[0][1] > 16000, `main ${seen[0][1]}`)
  assert.ok(seen[1][1] <= 15000)
})
