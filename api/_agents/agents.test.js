// 5단계: 에이전트 프로그램 매칭을 결재로 바꾸기 (에이전트 설정 부서, DB 저장, Anthropic 크로스체크). 실제 서버·AI 호출 없음.

import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { roleConfig } from './agents.config.js'
import { handleUpdate } from './approval.js'
import { handleCommand, helpText } from './commands.js'
import { anthropicReview, buildReviewSystemPrompt, CROSSCHECK_PROGRAMS } from './crosscheck.js'
import { setMatching } from './depts/agents/tools.js'
import { resetOwnerCache } from './owner.js'
import { setAnthropicClient } from './planner.js'
import { loadRules } from './rules.js'
import { ALLOWED_MODELS, loadSettings, toSettings } from './settings.js'
import { click, installFakes, message } from './testkit.js'
import { validatePlan } from './validator.js'

let fake
let updateId = 9000
beforeEach(() => {
  fake = installFakes()
  process.env.ANTHROPIC_API_KEY = 'test-key'
  delete process.env.AGENT_PROGRAM_MAIN
  delete process.env.AGENT_MODEL_MAIN
  delete process.env.AGENT_PROGRAM_CROSSCHECK
  delete process.env.AGENT_MODEL_CROSSCHECK
  resetOwnerCache()
})

const send = (text) => handleUpdate(message(text, { updateId: updateId++ }))
const lastTask = () => fake.tasks.at(-1)
const events = (task) => task.event_logs.map((e) => e.event)
const stored = () => fake.tables.agent_settings[0]
const step = (args) => ({ tool: 'agents.set_matching', args })

// 가짜 Anthropic: 메인(submit_plan)과 크로스체크(submit_opinion) 호출을 도구 이름으로 구분해 답한다
function useAi({ plan, opinions = [{ verdict: 'agree', comments: [] }] }) {
  const calls = []
  const options = []
  let opinionIndex = 0
  const client = {
    calls,
    options,
    messages: {
      create: async (params, requestOptions) => {
        calls.push(params)
        options.push(requestOptions)
        if (params.tools[0].name === 'submit_opinion') {
          const next = opinions[Math.min(opinionIndex++, opinions.length - 1)]
          if (next instanceof Error) throw next
          if (next === null) return { stop_reason: 'end_turn', content: [{ type: 'text', text: '의견 없음' }] }
          return { stop_reason: 'tool_use', usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: 'tool_use', name: 'submit_opinion', id: 'o1', input: next }] }
        }
        const input = typeof plan === 'function' ? plan(params, calls.length) : plan
        return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_plan', id: 'p1', input }] }
      },
    },
  }
  setAnthropicClient(client)
  return client
}

test('1. 인자 검사: 허용 목록 안의 값만 통과, 엉뚱한 프로그램·모델·인자는 결재 요청 전에 거부', () => {
  const ok = (args) => assert.equal(setMatching.check(args), null, JSON.stringify(args))
  const bad = (args, pattern) => assert.match(setMatching.check(args), pattern, JSON.stringify(args))

  ok({ role: 'main', program: 'anthropic', model: 'claude-opus-5-5' })
  ok({ role: 'main', program: 'test' })
  ok({ role: 'crosscheck', program: 'off' })
  ok({ role: 'crosscheck', program: 'test', model: null })
  ok({ role: 'crosscheck', program: 'anthropic', model: 'claude-haiku-5-5' })
  for (const model of ALLOWED_MODELS) ok({ role: 'main', program: 'anthropic', model })

  bad({ role: 'boss', program: 'anthropic', model: 'claude-opus-5-5' }, /role은/)
  bad({ role: 'main', program: 'off' }, /프로그램은 anthropic, test/)
  bad({ role: 'main', program: 'gpt', model: 'gpt-5' }, /프로그램은/)
  bad({ role: 'crosscheck', program: 'gemini' }, /프로그램은 off, test, anthropic/)
  bad({ role: 'main', program: 'anthropic' }, /model이 필요/)
  bad({ role: 'main', program: 'anthropic', model: 'claude-opus-9' }, /model이 필요/)
  bad({ role: 'crosscheck', program: 'off', model: 'claude-opus-5-5' }, /model을 정하지 않습니다/)
  bad({ role: 'main', program: 'test', extra: 1 }, /모르는 인자/)
  bad(null, /객체가 아닙니다/)
  bad([], /객체가 아닙니다/)
})

test('2. 매칭 변경은 항상 결재: 쓰기 위험도, 승인 전에는 저장하지 않고 승인하면 저장', async () => {
  const plan = { version: 3, main: { program: 'anthropic', model: 'x' }, summary: 'x', steps: [{ ...step({ role: 'main', program: 'anthropic', model: 'claude-opus-5-5' }), risk: 'write', dept: 'agents' }] }
  const verdict = validatePlan(plan)
  assert.equal(verdict.ok, true)
  assert.equal(verdict.needsApproval, true)

  useAi({ plan: { summary: '메인 에이전트 모델을 claude-sonnet-5-5에서 claude-opus-5-5로 바꿉니다.', steps: [step({ role: 'main', program: 'anthropic', model: 'claude-opus-5-5' })] } })
  assert.equal(await send('메인을 Opus 5.5로 바꿔줘'), 'pending')
  const task = lastTask()
  assert.equal(task.status, 'PENDING')
  assert.equal(fake.tables.agent_settings.length, 0, '승인 전에는 저장되지 않는다')
  const text = fake.sent.at(-1).text
  assert.match(text, /1\. 에이전트 매칭 변경: 메인 에이전트 → anthropic · claude-opus-5-5 \[쓰기·원복 가능\]/)
  assert.match(text, /👥 맡는 부서: 에이전트 설정 부서/)
  assert.match(text, /📚 규칙서: 전사 공통 ✓ · 일정 부서 ✓ · 에이전트 설정 부서 ✓/)
  assert.match(text, /⚠️ 실제 대시보드 데이터가 바뀝니다/)

  await handleUpdate(click(`a:${task.id}`))
  assert.equal(task.status, 'COMPLETED')
  assert.equal(stored().main_program, 'anthropic')
  assert.equal(stored().main_model, 'claude-opus-5-5')
  assert.match(fake.sent.at(-1).text, /메인 에이전트 매칭 변경: anthropic · claude-opus-5-5 \(다음 작업부터 적용\)/)
})

test('3. 바뀐 매칭은 다음 작업부터 적용: 메인이 새 모델로 호출되고, 현재 매칭이 AI에게 참고로 전달된다', async () => {
  fake.tables.agent_settings.push({ id: 1, main_program: 'anthropic', main_model: 'claude-opus-5-5', crosscheck_program: null, crosscheck_model: null })
  const client = useAi({ plan: { summary: '조회', steps: [{ tool: 'schedule.list', args: { from: '2026-10-31', to: '2026-10-31' } }] } })
  await send('오늘 일정 알려줘')
  const mainCall = client.calls.find((c) => c.tools[0].name === 'submit_plan')
  assert.equal(mainCall.model, 'claude-opus-5-5')
  assert.match(mainCall.messages[0].content, /\(참고\) 지금 에이전트 매칭: 메인 anthropic \(claude-opus-5-5\) · 크로스체크 꺼짐 \(코드 검사만\)/)
  assert.equal(lastTask().plan_payload.main.model, 'claude-opus-5-5')
  assert.match(fake.sent.at(-1).text, /🤖 메인: Anthropic \(claude-opus-5-5\)/)
})

test('4. 두 역할을 바꾸는 2단계 계획에서 두 번째가 실패하면 첫 번째도 바꾸기 전 값으로 원복', async () => {
  fake.tables.agent_settings.push({ id: 1, main_program: 'anthropic', main_model: 'claude-sonnet-5-5', crosscheck_program: null, crosscheck_model: null })
  useAi({
    plan: {
      summary: '메인과 크로스체크를 바꿉니다',
      steps: [step({ role: 'main', program: 'anthropic', model: 'claude-opus-5-5' }), { tool: 'test.fail_write', args: { text: '롤백 확인' } }],
    },
  })
  await send('메인을 Opus로 바꾸고 실패 테스트도 해줘')
  await handleUpdate(click(`a:${lastTask().id}`))
  assert.equal(lastTask().status, 'FAILED')
  assert.equal(lastTask().event_logs.at(-1).event, 'ROLLED_BACK')
  assert.equal(stored().main_model, 'claude-sonnet-5-5', '바꾸기 전 저장값으로 돌아간다')
  assert.match(fake.sent.at(-1).text, /↩️ 실패 → 원복 완료[\s\S]*메인 에이전트 매칭 원복: anthropic · claude-sonnet-5-5/)
})

test('5. 원래 저장값이 없던 칸은 원복하면 비워져서 환경변수 기본값으로 돌아간다', async () => {
  const args = { role: 'crosscheck', program: 'anthropic', model: 'claude-opus-5-5' }
  const output = await setMatching.run(args)
  assert.deepEqual(output.previous, { program: null, model: null })
  assert.equal(stored().crosscheck_program, 'anthropic')
  await setMatching.undo(args, output)
  assert.equal(stored().crosscheck_program, null)
  assert.equal(stored().crosscheck_model, null)
  assert.equal(roleConfig('crosscheck', {}, toSettings(stored())).program, 'off')
})

test('6. 저장 실패 → 실패 보고, 아무것도 저장되지 않음', async () => {
  useAi({ plan: { summary: '바꿉니다', steps: [step({ role: 'main', program: 'anthropic', model: 'claude-opus-5-5' })] } })
  await send('메인을 Opus로')
  fake.failSettingsWrite = true
  await handleUpdate(click(`a:${lastTask().id}`))
  assert.equal(lastTask().status, 'FAILED')
  assert.equal(fake.tables.agent_settings.length, 0)
  assert.match(fake.sent.at(-1).text, /실패한 단계: 1\. 에이전트 매칭 변경/)
})

test('7. 순서: 저장값 → 환경변수 → 기본값. 저장값을 못 읽으면 환경변수로 동작', async () => {
  const env = { ANTHROPIC_API_KEY: 'k', AGENT_PROGRAM_MAIN: 'anthropic', AGENT_MODEL_MAIN: 'claude-haiku-5-5', AGENT_PROGRAM_CROSSCHECK: 'test' }
  assert.equal(roleConfig('main', env, {}).model, 'claude-haiku-5-5')
  const settings = toSettings({ main_program: 'anthropic', main_model: 'claude-opus-5-5', crosscheck_program: 'anthropic', crosscheck_model: null })
  assert.equal(roleConfig('main', env, settings).model, 'claude-opus-5-5')
  assert.equal(roleConfig('crosscheck', env, settings).program, 'anthropic')
  assert.equal(roleConfig('crosscheck', env, settings).model, 'claude-sonnet-5-5', '모델을 안 정한 anthropic 크로스체크의 기본 모델')
  assert.equal(roleConfig('crosscheck', env, toSettings(null)).program, 'test')

  fake.failDb = true
  const original = console.error
  console.error = () => {}
  try {
    assert.deepEqual(await loadSettings(), toSettings(null))
  } finally {
    console.error = original
  }
})

test('8. /help에 저장된 매칭이 보인다', async () => {
  fake.tables.agent_settings.push({ id: 1, main_program: 'anthropic', main_model: 'claude-opus-5-5', crosscheck_program: 'anthropic', crosscheck_model: 'claude-sonnet-5-5' })
  await handleCommand('help', 42)
  assert.match(fake.sent.at(-1).text, /지금 설정: 메인 anthropic \(claude-opus-5-5\) · 크로스체크 anthropic \(claude-sonnet-5-5\)/)
  assert.match(fake.sent.at(-1).text, /에이전트 설정 부서 — /)
  assert.match(helpText(), /지금 설정: 메인 anthropic \(claude-sonnet-5-5\) · 크로스체크 꺼짐/)
})

test('9. Anthropic 크로스체크: 동의 → 결재 요청에 "동의", 선택한 모델로 호출, 재시도 끔, 사용량 기록', async () => {
  fake.tables.agent_settings.push({ id: 1, main_program: null, main_model: null, crosscheck_program: 'anthropic', crosscheck_model: 'claude-opus-5-5' })
  const client = useAi({ plan: { summary: '메인을 Haiku로', steps: [step({ role: 'main', program: 'anthropic', model: 'claude-haiku-5-5' })] } })
  assert.equal(await send('메인을 하이쿠로'), 'pending')
  const reviewCall = client.calls.find((c) => c.tools[0].name === 'submit_opinion')
  assert.equal(reviewCall.model, 'claude-opus-5-5')
  assert.match(reviewCall.messages[0].content, /캡틴의 지시:\n메인을 하이쿠로[\s\S]*1\. agents\.set_matching \(에이전트 설정 부서, 위험도 write\)/)
  const reviewOptions = client.options[client.calls.indexOf(reviewCall)]
  assert.equal(reviewOptions.maxRetries, 0)
  assert.ok(reviewOptions.timeout > 0)
  assert.deepEqual(events(lastTask()), ['CREATED', 'PLANNED', 'CROSSCHECK_AGREED', 'VALIDATED'])
  assert.deepEqual(lastTask().event_logs[2].usage, { model: 'claude-opus-5-5', input_tokens: 10, output_tokens: 5 })
  assert.match(fake.sent.at(-1).text, /🔍 크로스체크: 동의 \(바로\)/)
})

test('10. Anthropic 크로스체크: 이의 → 메인이 고침 → 동의, 이의 내용이 메인에게 전달됨', async () => {
  fake.tables.agent_settings.push({ id: 1, crosscheck_program: 'anthropic', crosscheck_model: 'claude-sonnet-5-5' })
  const client = useAi({
    plan: (params) =>
      /크로스체크 에이전트의 의견/.test(params.messages[0].content)
        ? { summary: '의견 반영: 모델을 Opus로', steps: [step({ role: 'main', program: 'anthropic', model: 'claude-opus-5-5' })] }
        : { summary: '메인을 Haiku로', steps: [step({ role: 'main', program: 'anthropic', model: 'claude-haiku-5-5' })] },
    opinions: [{ verdict: 'object', comments: ['지시는 Opus인데 Haiku로 잡았어요'] }, { verdict: 'agree', comments: [] }],
  })
  assert.equal(await send('메인을 Opus로 바꿔줘'), 'pending')
  assert.deepEqual(events(lastTask()), ['CREATED', 'PLANNED', 'CROSSCHECK_OBJECTION', 'PLAN_REVISED', 'CROSSCHECK_AGREED', 'VALIDATED'])
  assert.ok(client.calls.some((c) => /지시는 Opus인데 Haiku로 잡았어요/.test(c.messages[0].content)))
  assert.equal(lastTask().plan_payload.steps[0].args.model, 'claude-opus-5-5')
  assert.match(fake.sent.at(-1).text, /🔍 크로스체크: 동의 \(상의 1회\)/)
})

test('11. Anthropic 크로스체크 오류(의견 없음·API 오류) → 결재 요청에 오류 표시, 캡틴이 판단', async () => {
  for (const failure of [null, new Error('boom')]) {
    fake.tasks.length = 0
    fake.sent.length = 0
    fake.tables.agent_settings.length = 0
    fake.tables.agent_settings.push({ id: 1, crosscheck_program: 'anthropic', crosscheck_model: 'claude-sonnet-5-5' })
    useAi({ plan: { summary: '조회', steps: [{ tool: 'schedule.list', args: { from: '2026-10-31', to: '2026-10-31' } }] }, opinions: [failure] })
    const original = console.error
    console.error = () => {}
    try {
      assert.equal(await send('오늘 일정 알려줘'), 'pending', '읽기 전용이어도 크로스체크 오류면 자동 실행하지 않는다')
    } finally {
      console.error = original
    }
    assert.ok(events(lastTask()).includes('CROSSCHECK_ERROR'))
    assert.match(fake.sent.at(-1).text, /⚠️ 크로스체크 에이전트 오류/)
  }
})

test('12. 크로스체크 프롬프트에 전사 공통 규칙이 들어가고, anthropic 프로그램이 등록돼 있다', async () => {
  const prompt = buildReviewSystemPrompt(loadRules())
  assert.match(prompt, /크로스체크 에이전트\(검토 담당\)/)
  assert.match(prompt, /G-1\. 결재 최우선/)
  assert.equal(CROSSCHECK_PROGRAMS.anthropic, anthropicReview)
  // 의견 도구를 부르지 않는 응답은 오류 (조용히 동의로 보지 않는다)
  const silent = { messages: { create: async () => ({ stop_reason: 'end_turn', content: [] }) } }
  await assert.rejects(() => anthropicReview({ query: 'x', plan: { steps: [] }, rules: loadRules(), model: 'm', client: silent }), /의견을 제출하지 않았습니다/)
})

test('13. 규칙서에 적힌 허용 모델이 코드의 허용 목록과 같다', () => {
  const rules = readFileSync(new URL('./depts/agents/rules.md', import.meta.url), 'utf8')
  for (const model of ALLOWED_MODELS) assert.ok(rules.includes(model), `규칙서에 ${model}이 없음`)
  assert.deepEqual(Object.keys(toSettings(null)), ['main', 'crosscheck'])
})
