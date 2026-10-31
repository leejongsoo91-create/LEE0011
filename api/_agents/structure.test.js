// 뼈대 정리: 부서 플러그인 구조, 역할별 설정, 작업 기록의 "누가"

import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { roleConfig, planningBudgetMs } from './agents.config.js'
import { handleUpdate } from './approval.js'
import { DEPARTMENTS } from './depts/index.js'
import { buildRegistry, departments, tools } from './registry.js'
import { loadRules, rulesStatus } from './rules.js'
import { click, installFakes, message } from './testkit.js'

let fake
let updateId = 20000
beforeEach(() => {
  fake = installFakes()
})
const send = (text) => handleUpdate(message(text, { updateId: updateId++ }))

test('부서 플러그인: depts/index.js 목록으로 부서·도구가 만들어지고, 도구마다 dept가 붙는다', () => {
  assert.deepEqual(DEPARTMENTS.map((d) => d.id), ['schedule', 'invest', 'agents', 'test'])
  assert.deepEqual(departments.schedule.tools, ['schedule.list', 'schedule.create'])
  assert.equal(tools['schedule.create'].dept, 'schedule')
  assert.equal(tools['test.fail_write'].dept, 'test')
  assert.equal(departments.schedule.name, '일정 부서')
})

test('부서 플러그인: 새 부서는 등록 정보만으로 붙고, 잘못된 등록은 막힌다', () => {
  const extra = { id: 'work', name: '업무 부서', tools: { 'work.list': { label: '업무 조회', risk: 'read', check: () => null, run: async () => ({}) } } }
  const built = buildRegistry([...DEPARTMENTS, extra])
  assert.equal(built.tools['work.list'].dept, 'work')
  assert.throws(() => buildRegistry([{ id: 'work', tools: { 'list': {} } }]), /"work\."로 시작/)
  assert.throws(() => buildRegistry([extra, extra]), /부서 id 중복/)
  assert.throws(() => buildRegistry([{ id: 'Work!', tools: {} }]), /부서 id가 잘못됨/)
  assert.throws(() => buildRegistry([extra, { id: 'work2', tools: { 'work.list': {} } }]), /"work2\."로 시작/)
})

test('부서 규칙서: 부서 폴더의 rules.md를 읽고, 상태도 부서 목록을 따른다', () => {
  const rules = loadRules()
  assert.match(rules.depts.schedule, /# 일정 부서 규칙/)
  assert.equal(rules.depts.test, undefined, '규칙서가 없는 부서는 빠진다')
  assert.deepEqual(rulesStatus(rules), { global: true, deptTemplate: true, depts: { schedule: true, invest: true, agents: true } })
  const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
  assert.equal(vercel.functions['api/webhook.js'].includeFiles, 'api/_agents/**/*.md')
})

test('역할 설정: 기본값과 환경변수, 예전 이름(AGENT_MODEL·AGENT_PLANNER)도 동작', () => {
  assert.deepEqual(roleConfig('main', {}), { role: 'main', label: '메인 에이전트', program: 'test', model: 'claude-sonnet-5-5', timeoutMs: 30000 })
  assert.equal(roleConfig('main', { ANTHROPIC_API_KEY: 'k' }).program, 'anthropic')
  assert.equal(roleConfig('main', { ANTHROPIC_API_KEY: 'k', AGENT_PLANNER: 'test' }).program, 'test')
  assert.equal(roleConfig('main', { AGENT_PROGRAM_MAIN: 'anthropic' }).program, 'anthropic')
  assert.equal(roleConfig('main', { AGENT_MODEL: 'claude-haiku-5-5' }).model, 'claude-haiku-5-5')
  assert.equal(roleConfig('main', { AGENT_MODEL: 'a', AGENT_MODEL_MAIN: 'b' }).model, 'b')
  assert.equal(roleConfig('crosscheck', {}).program, 'off')
  assert.equal(roleConfig('crosscheck', { AGENT_PROGRAM_CROSSCHECK: 'test' }).program, 'test')
  assert.equal(planningBudgetMs({}), 50000)
  assert.equal(planningBudgetMs({ AGENT_PLANNING_BUDGET_MS: 'x' }), 50000)
  assert.throws(() => roleConfig('cook'), /모르는 역할/)
})

test('등록 안 된 프로그램 이름 → 작업을 닫고 설정 오류 안내', async () => {
  process.env.AGENT_PROGRAM_CROSSCHECK = 'gpt-x'
  assert.equal(await send('회의'), 'config-error')
  delete process.env.AGENT_PROGRAM_CROSSCHECK
  assert.equal(fake.tasks.at(-1).status, 'FAILED')
  assert.match(fake.sent.at(-1).text, /에이전트 설정 오류: 크로스체크 프로그램이 등록되지 않음: gpt-x/)
})

test('작업 기록의 모든 줄에 agent(누가), 단계 기록에 dept(어느 부서)', async () => {
  await send('실패 테스트')
  const task = fake.tasks.at(-1)
  await handleUpdate(click(`a:${task.id}`))
  await send('회의')
  const rejected = fake.tasks.at(-1)
  await handleUpdate(click(`r:${rejected.id}`))
  await send('취소')
  for (const row of fake.tasks) {
    for (const entry of row.event_logs) assert.ok(entry.agent, `agent 없음: ${row.task_query} ${entry.event}`)
  }
  const byEvent = (row, event) => row.event_logs.find((e) => e.event === event)
  assert.equal(byEvent(task, 'CREATED').agent, 'intake')
  assert.equal(byEvent(task, 'PLANNED').agent, 'main')
  assert.equal(byEvent(task, 'VALIDATED').agent, 'orchestrator')
  assert.equal(byEvent(task, 'APPROVED').agent, 'captain')
  assert.equal(byEvent(task, 'STEP_START').agent, 'executor')
  assert.equal(byEvent(task, 'STEP_START').dept, 'test')
  assert.equal(byEvent(task, 'ROLLED_BACK').agent, 'executor')
  assert.equal(byEvent(rejected, 'REJECTED').agent, 'captain')
  assert.equal(byEvent(rejected, 'REASON_REQUESTED').agent, 'intake')
  assert.deepEqual(task.plan_payload.steps.map((s) => s.dept), ['test', 'test'])
})

test('검증기: 계획의 부서 표기가 도구의 부서와 다르면 거부', async () => {
  const { validatePlan } = await import('./validator.js')
  const step = { tool: 'schedule.list', args: { from: '2026-10-26', to: '2026-10-27' }, risk: 'read' }
  assert.equal(validatePlan({ steps: [{ ...step, dept: 'schedule' }] }).ok, true)
  assert.match(validatePlan({ steps: [{ ...step, dept: 'test' }] }).errors[0], /부서 표기/)
})
