import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { executePlan } from './executor.js'
import { buildTestPlan, hashPlan } from './plan.js'
import { sandbox } from './registry.js'
import { createTask } from './tasks.js'
import { installFakes } from './testkit.js'

let fake
let updateId = 1
beforeEach(() => {
  fake = installFakes()
  sandbox.clear()
})

async function approvedTask(query) {
  const plan = buildTestPlan(query)
  const task = await createTask({ query, sourceUpdateId: updateId++, status: 'APPROVED', plan, planHash: hashPlan(plan), log: { event: 'TEST' } })
  return fake.tasks.find((row) => row.id === task.id) && task
}
const events = (task) => task.event_logs.map((e) => e.event)

test('쓰기 성공 → COMPLETED, 단계 시작·끝 기록, 기록이 남는다', async () => {
  const outcome = await executePlan(await approvedTask('회의'))
  assert.equal(outcome.status, 'completed')
  assert.equal(outcome.task.status, 'COMPLETED')
  assert.deepEqual(events(outcome.task), ['TEST', 'EXECUTE_START', 'STEP_START', 'STEP_DONE', 'COMPLETED'])
  assert.equal(sandbox.size, 1)
})

test('3. 두 번째 단계 실패 → 첫 단계를 원복하고 FAILED', async () => {
  const outcome = await executePlan(await approvedTask('실패'))
  assert.equal(outcome.status, 'rolled-back')
  assert.equal(outcome.task.status, 'FAILED')
  assert.equal(outcome.failure.step, 2)
  assert.deepEqual(outcome.undo.map((u) => [u.step, u.ok]), [[1, true]])
  assert.deepEqual(events(outcome.task).slice(1), [
    'EXECUTE_START', 'STEP_START', 'STEP_DONE', 'STEP_START', 'STEP_FAILED', 'UNDO_DONE', 'ROLLED_BACK',
  ])
  assert.equal(sandbox.size, 0, '원복으로 기록이 지워져야 한다')
})

test('4. 원복도 실패 → UNDO_FAILED 기록', async () => {
  const outcome = await executePlan(await approvedTask('원복실패'))
  assert.equal(outcome.status, 'undo-failed')
  assert.equal(outcome.task.status, 'FAILED')
  assert.equal(outcome.task.event_logs.at(-1).event, 'UNDO_FAILED')
  assert.ok(events(outcome.task).includes('UNDO_STEP_FAILED'))
  assert.equal(sandbox.size, 1, '원복에 실패했으니 기록이 남아 있다')
})

test('읽기 전용 → 실행만, 원복할 것 없음', async () => {
  const outcome = await executePlan(await approvedTask('조회'))
  assert.equal(outcome.status, 'completed')
  assert.match(outcome.results[0].summary, /가짜 데이터 3건/)
})

test('승인 뒤 계획이 바뀜 → 실행하지 않고 FAILED', async () => {
  const task = await approvedTask('회의')
  task.plan_payload.steps.push({ tool: 'test.write', args: { text: 'y' }, risk: 'write' })
  const outcome = await executePlan(task)
  assert.equal(outcome.status, 'hash-mismatch')
  assert.equal(fake.tasks[0].status, 'FAILED')
  assert.equal(sandbox.size, 0)
})

test('실행 도중 다른 요청이 작업을 정리하면 즉시 멈춘다', async () => {
  const task = await approvedTask('실패')
  // EXECUTE_START 직후 누군가 FAILED로 바꾼 상황을 흉내 낸다.
  const original = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    const response = await original(url, options)
    if (options?.method === 'PATCH' && fake.tasks[0].status === 'EXECUTING') fake.tasks[0].status = 'FAILED'
    return response
  }
  const outcome = await executePlan(task)
  assert.equal(outcome.status, 'aborted')
  assert.equal(sandbox.size, 0, '단계를 하나도 실행하지 않는다')
})
