// AI 계획 작성기와, 그것을 쓰는 3단계 전체 흐름(일정 부서) 테스트. Anthropic API는 가짜 클라이언트로 대신한다.

import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { handleUpdate } from './approval.js'
import { resetOwnerCache } from './owner.js'
import { buildTestPlan } from './plan.js'
import { aiPlan, buildSystemPrompt, choosePlanner, nowKst, setAnthropicClient } from './planner.js'
import { loadRules } from './rules.js'
import { OWNER_UID, click, fakeAnthropic, installFakes, message } from './testkit.js'

let fake
let updateId = 5000
beforeEach(() => {
  fake = installFakes()
  process.env.ANTHROPIC_API_KEY = 'test-key'
  resetOwnerCache()
})

const send = (text, options = {}) => handleUpdate(message(text, { updateId: updateId++, ...options }))
const lastTask = () => fake.tasks.at(-1)
const createStep = (extra = {}) => ({
  tool: 'schedule.create',
  args: { title: '회의', date: '2026-10-28', time: '15:00', remind_before_min: 0, ...extra },
})
const useAi = (reply) => {
  const client = fakeAnthropic(reply)
  setAnthropicClient(client)
  return client
}

test('시스템 프롬프트: 현재 한국 시간, 규칙서 2개, AI에게 보이는 도구만', () => {
  const prompt = buildSystemPrompt(loadRules(), new Date('2026-10-26T15:40:00Z'))
  assert.match(prompt, /현재 시각\(한국 시간, KST\): 2026-10-27\(화\) 00:40/)
  assert.match(prompt, /G-1\. 결재 최우선/)
  assert.match(prompt, /일정 부서 규칙/)
  assert.match(prompt, /- schedule\.create \(위험도 write, 일정 부서\)/)
  assert.match(prompt, /- schedule\.list \(위험도 read, 일정 부서\)/)
  assert.match(prompt, /- test\.fail_write/)
  assert.doesNotMatch(prompt, /- test\.write|- test\.lookup/)
  assert.equal(nowKst(new Date('2026-10-27T14:59:00Z')), '2026-10-27(화) 23:59')
})

test('submit_plan 도구(auto), 위험도는 AI가 아니라 레지스트리 값', async () => {
  const client = fakeAnthropic({ summary: '내일 3시 → 10/28(수) 15:00', steps: [{ ...createStep(), risk: 'read' }, { tool: 'evil.tool', args: {} }] })
  const plan = await aiPlan('내일 3시 회의', { client, rules: loadRules() })
  const params = client.calls[0]
  // claude-sonnet-5-5는 특정 도구 강제(type tool/any)를 거부한다 → auto
  assert.deepEqual(params.tool_choice, { type: 'auto' })
  assert.equal(params.model, 'claude-sonnet-5-5')
  assert.deepEqual(params.tools[0].input_schema.properties.steps.items.properties.tool.enum, ['schedule.list', 'schedule.create', 'test.fail_write'])
  assert.deepEqual(plan.steps.map((s) => s.risk), ['write', 'unknown'])
  assert.deepEqual(plan.main, { program: 'anthropic', model: 'claude-sonnet-5-5' })
  assert.deepEqual(plan.steps.map((s) => s.dept), ['schedule', 'unknown'])
})

test('AGENT_MODEL로 모델을 바꿀 수 있고, 반려 사유와 이전 계획이 AI에게 전달된다', async () => {
  process.env.AGENT_MODEL = 'claude-haiku-5-5'
  const client = fakeAnthropic({ summary: '제목 변경', steps: [createStep({ title: '팀 회의' })] })
  const plan = await aiPlan('내일 3시 회의', { client, feedback: '제목을 팀 회의로', previousPlan: { summary: '이전', steps: [createStep()] } })
  delete process.env.AGENT_MODEL
  assert.equal(client.calls[0].model, 'claude-haiku-5-5')
  assert.match(client.calls[0].messages[0].content, /이전 계획\(반려됨\): .*"title":"회의"[\s\S]*반려 사유: 제목을 팀 회의로/)
  assert.equal(plan.feedback, '제목을 팀 회의로')
})

test('계획 작성기 선택: 키가 없거나 AGENT_PLANNER=test면 테스트 계획 작성기', () => {
  assert.equal(choosePlanner(), aiPlan)
  process.env.AGENT_PLANNER = 'test'
  assert.equal(choosePlanner(), buildTestPlan)
  delete process.env.AGENT_PLANNER
  delete process.env.ANTHROPIC_API_KEY
  assert.equal(choosePlanner(), buildTestPlan)
})

test('A. "내일 오후 3시 회의 등록" → 결재 요청(일정 내용·AI·실제 데이터 경고) → 승인 → 일정 1건 등록', async () => {
  useAi({ summary: '내일 오후 3시 → 10/28(수) 15:00, 정시 알림', steps: [createStep()] })
  assert.equal(await send('내일 오후 3시 회의 등록해 줘'), 'pending')
  const approval = fake.sent.at(-1).text
  assert.match(approval, /요약: 내일 오후 3시 → 10\/28\(수\) 15:00/)
  assert.match(approval, /1\. 일정 등록: 10\/28\(수\) 15:00 · "회의" · 정시 알림 \[쓰기·원복 가능\]/)
  assert.match(approval, /👥 맡는 부서: 일정 부서\n🤖 메인: Anthropic \(claude-sonnet-5-5\)\n🔍 크로스체크: 코드 검사만/)
  assert.match(approval, /⚠️ 실제 대시보드 데이터가 바뀝니다/)
  assert.equal(fake.schedule.length, 0, '승인 전에는 등록되지 않는다')

  await handleUpdate(click(`a:${lastTask().id}`))
  assert.equal(lastTask().status, 'COMPLETED')
  assert.equal(fake.schedule.length, 1)
  assert.equal(fake.schedule[0].user_id, OWNER_UID)
  assert.match(fake.sent.at(-1).text, /✅ 완료[\s\S]*일정 등록: 10\/28\(수\) 15:00 · "회의"/)
})

test('B. "회의 등록하고 실패 테스트" → 승인 → 2단계 실패 → 등록한 일정 삭제(원복)', async () => {
  useAi({ summary: '등록 후 롤백 테스트', steps: [createStep(), { tool: 'test.fail_write', args: { text: '롤백 확인' } }] })
  await send('내일 3시 회의 등록하고 실패 테스트도 해 줘')
  await handleUpdate(click(`a:${lastTask().id}`))
  const task = lastTask()
  assert.equal(task.status, 'FAILED')
  assert.equal(task.event_logs.at(-1).event, 'ROLLED_BACK')
  assert.equal(fake.schedule.length, 0, '원복으로 일정이 지워져야 한다')
  assert.match(fake.sent.at(-1).text, /↩️ 실패 → 원복 완료[\s\S]*1\. 일정 등록 — 원복 완료 \(일정 삭제: "회의"\)/)
})

test('C. "이번 주 일정" → 조회는 결재 없이 바로 실행, 내 일정만 보고', async () => {
  fake.schedule.push(
    { id: '1', user_id: OWNER_UID, title: '회의', date: '2026-10-28', time: '15:00' },
    { id: '2', user_id: 'other', title: '남의 일정', date: '2026-10-28', time: '16:00' },
  )
  useAi({ summary: '이번 주 = 10/26(월)~11/1(일)', steps: [{ tool: 'schedule.list', args: { from: '2026-10-26', to: '2026-11-01' } }] })
  assert.equal(await send('이번 주 일정 알려 줘'), 'completed')
  const report = fake.sent.at(-1).text
  assert.equal(fake.sent.at(-1).reply_markup, undefined)
  assert.match(report, /결재 없이 실행[\s\S]*🤖 메인: Anthropic[\s\S]*일정 1건\n  · 10\/28\(수\) 15:00 회의/)
  assert.doesNotMatch(report, /남의 일정/)
})

test('D. 모호한 지시 → AI가 되물음 → 결재 없이 질문 전송, 작업 FAILED(NEEDS_INFO)', async () => {
  useAi({ summary: '', clarification: '어느 날짜인가요? (예: 10월 30일)', steps: [] })
  assert.equal(await send('다음주쯤 회의 잡아 줘'), 'needs-info')
  assert.equal(lastTask().status, 'FAILED')
  assert.equal(lastTask().event_logs.at(-1).event, 'NEEDS_INFO')
  assert.match(fake.sent.at(-1).text, /❓[\s\S]*어느 날짜인가요/)
  assert.equal(fake.schedule.length, 0)
})

test('D-2. AI가 도구 없이 글로만 답함 → 그 글을 질문으로 전송', async () => {
  useAi('일정 수정은 아직 지원하지 않아요. 새로 등록할까요?')
  assert.equal(await send('회의 시간 바꿔 줘'), 'needs-info')
  assert.match(fake.sent.at(-1).text, /❓[\s\S]*일정 수정은 아직 지원하지 않아요/)
})

test('E. AI 호출 실패 → PLAN_FAILED 안내', async () => {
  useAi(new Error('overloaded'))
  assert.equal(await send('내일 회의'), 'plan-failed')
  assert.equal(lastTask().event_logs.at(-1).event, 'PLAN_FAILED')
  assert.match(fake.sent.at(-1).text, /계획을 만들지 못했어요\n원인: AI 서버가 바빠요/)
})

test('F. AI가 등록을 읽기라고 적어도 결재를 거치고, 잘못된 인자·없는 도구는 검증에서 막힌다', async () => {
  useAi({ summary: 'x', steps: [{ ...createStep(), risk: 'read' }] })
  assert.equal(await send('회의 등록'), 'pending')

  useAi({ summary: 'x', steps: [createStep({ date: '2026-02-30' })] })
  assert.equal(await send('2월 30일 회의'), 'invalid')
  assert.match(fake.sent.at(-1).text, /계획 검증 실패[\s\S]*실제 있는 날짜/)

  useAi({ summary: 'x', steps: [{ tool: 'schedule.delete_all', args: {} }] })
  assert.equal(await send('일정 다 지워'), 'invalid')
  assert.equal(fake.schedule.length, 0)
})

test('G. 반려 → 사유 답장 → AI가 사유를 반영해 재계획 → 새 결재 요청', async () => {
  const client = useAi((params) =>
    /반려 사유: 4시로/.test(params.messages[0].content)
      ? { summary: '4시로 변경', steps: [createStep({ time: '16:00' })] }
      : { summary: '3시', steps: [createStep()] },
  )
  await send('내일 3시 회의')
  const task = lastTask()
  await handleUpdate(click(`r:${task.id}`))
  assert.equal(await send('4시로 바꿔 줘', { replyTo: fake.sent.at(-1).message_id }), 'pending')
  assert.equal(client.calls.length, 2)
  assert.match(fake.sent.at(-1).text, /재계획 1회차[\s\S]*10\/28\(수\) 16:00/)
  assert.equal(task.plan_payload.steps[0].args.time, '16:00')
})

test('H. 일정 저장 자체가 실패 → 되돌릴 것 없이 FAILED 보고', async () => {
  useAi({ summary: 'x', steps: [createStep()] })
  await send('내일 3시 회의')
  fake.failScheduleInsert = true
  await handleUpdate(click(`a:${lastTask().id}`))
  assert.equal(lastTask().status, 'FAILED')
  assert.match(fake.sent.at(-1).text, /실패한 단계: 1\. 일정 등록[\s\S]*되돌릴 단계 없음/)
})

test('상의: 크로스체크 의견과 방금 낸 계획이 AI에게 전달되고, 고친 횟수가 revision에 남는다', async () => {
  const client = fakeAnthropic({ summary: '의견 반영: 제목 구체화', steps: [createStep({ title: '팀 주간 회의' })] })
  const plan = await aiPlan('내일 3시 회의', {
    client,
    round: 1,
    previousPlan: { summary: '처음', steps: [createStep()] },
    review: { verdict: 'object', comments: ['제목이 너무 짧아요'] },
    timeoutMs: 12000,
  })
  const content = client.calls[0].messages[0].content
  assert.match(content, /내가 방금 낸 계획: .*"title":"회의"/)
  assert.match(content, /크로스체크 에이전트의 의견: 제목이 너무 짧아요/)
  assert.doesNotMatch(content, /반려 사유/)
  assert.equal(plan.revision, 1)
  assert.match(buildSystemPrompt(loadRules()), /크로스체크 에이전트의 의견이 주어지면/)
})
