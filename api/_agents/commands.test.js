// 권장 항목: AI 사용량 기록, 운영 명령(/help /pending /cancel)

import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { handleUpdate } from './approval.js'
import { parseCommand } from './commands.js'
import { resetOwnerCache } from './owner.js'
import { planAndRoute } from './orchestrator.js'
import { buildTestPlan } from './plan.js'
import { setAnthropicClient } from './planner.js'
import { createTask } from './tasks.js'
import { click, installFakes, message } from './testkit.js'

let fake
let updateId = 40000
beforeEach(() => {
  fake = installFakes()
  resetOwnerCache()
})
const send = (text, options = {}) => handleUpdate(message(text, { updateId: updateId++, ...options }))
const lastTask = () => fake.tasks.at(-1)

// 사용량(usage)을 돌려주는 가짜 Anthropic 클라이언트
function usageClient(inputs) {
  let i = 0
  return {
    messages: {
      create: async () => {
        const input = inputs[Math.min(i++, inputs.length - 1)]
        return { usage: { input_tokens: 1200 + i, output_tokens: 80 + i }, content: [{ type: 'tool_use', name: 'submit_plan', input }] }
      },
    },
  }
}
const createStep = { tool: 'schedule.create', args: { title: '회의', date: '2026-10-28', time: '15:00', remind_before_min: 0 } }

test('사용량: AI 계획의 모델·입력/출력 토큰이 PLANNED 기록에 남고, 계획(해시 대상)에는 들어가지 않는다', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key'
  setAnthropicClient(usageClient([{ summary: 'x', steps: [createStep] }]))
  assert.equal(await send('내일 3시 회의'), 'pending')
  const planned = lastTask().event_logs.find((e) => e.event === 'PLANNED')
  assert.deepEqual(planned.usage, { model: 'claude-sonnet-5-5', input_tokens: 1201, output_tokens: 81 })
  assert.equal(lastTask().plan_payload.usage, undefined)
})

test('사용량: 되묻기(NEEDS_INFO)와 상의 중 고친 계획(PLAN_REVISED), 크로스체크 사용량도 남는다', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key'
  setAnthropicClient(usageClient([{ summary: '', clarification: '어느 날짜인가요?', steps: [] }]))
  assert.equal(await send('다음주쯤 회의'), 'needs-info')
  assert.equal(lastTask().event_logs.at(-1).usage.input_tokens, 1201)

  const task = await createTask({ query: '회의', sourceUpdateId: updateId++, status: 'PLANNING', log: { agent: 'intake', event: 'CREATED' } })
  await planAndRoute(task, 42, {
    planner: (query, options) => ({ ...buildTestPlan(query, options), usage: { model: 'm', input_tokens: options.round, output_tokens: 1 } }),
    reviewer: async ({ round }) =>
      round === 0
        ? { verdict: 'object', comments: ['고쳐요'], usage: { model: 'r', input_tokens: 10, output_tokens: 2 } }
        : { verdict: 'agree', usage: { model: 'r', input_tokens: 11, output_tokens: 3 } },
  })
  const logs = lastTask().event_logs
  assert.equal(logs.find((e) => e.event === 'PLAN_REVISED').usage.input_tokens, 1)
  assert.equal(logs.find((e) => e.event === 'CROSSCHECK_OBJECTION').usage.model, 'r')
  assert.equal(logs.find((e) => e.event === 'CROSSCHECK_AGREED').usage.output_tokens, 3)
})

test('명령 해석: /pending, /pending@봇이름, 대소문자, 뒤에 글자. 일반 글은 명령이 아님', () => {
  assert.equal(parseCommand('/pending'), 'pending')
  assert.equal(parseCommand('/Pending@lee0011_bot'), 'pending')
  assert.equal(parseCommand('/cancel 지금'), 'cancel')
  assert.equal(parseCommand('회의 /cancel'), null)
  assert.equal(parseCommand('/명령'), null)
  assert.equal(parseCommand('//x'), null)
})

test('/help: AI·작업 생성 없이 사용법(부서·예시·명령·지금 설정)', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key'
  let called = 0
  setAnthropicClient({ messages: { create: async () => (called++, {}) } })
  assert.equal(await send('/help'), 'help')
  assert.equal(await send('/start'), 'help')
  assert.equal(called, 0)
  assert.equal(fake.tasks.length, 0)
  const text = fake.sent.at(-1).text
  assert.match(text, /• 일정 부서 — 대시보드 일정 등록·조회\n  예\) 내일 오후 3시 회의 등록해줘/)
  assert.match(text, /\/pending — [\s\S]*\/cancel — [\s\S]*\/help — /)
  assert.match(text, /지금 설정: 메인 anthropic \(claude-sonnet-5-5\) · 크로스체크 꺼짐 \(코드 검사만\)/)
})

test('/pending: 없으면 안내, 있으면 결재 대기는 버튼을, 사유 대기는 답장 칸을 다시 보냄', async () => {
  assert.equal(await send('/pending'), 'pending-none')
  assert.match(fake.sent.at(-1).text, /대기 중인 작업이 없어요/)

  await send('회의 A')
  const pendingTask = lastTask()
  await send('회의 B')
  const rejectedTask = lastTask()
  await handleUpdate(click(`r:${rejectedTask.id}`))
  const before = fake.sent.length

  assert.equal(await send('/pending'), 'pending-listed')
  const out = fake.sent.slice(before)
  assert.match(out[0].text, /📋 대기 중인 작업 2건\n결재 대기 1 · 반려 사유 대기 1 · 실행 중 0/)
  assert.deepEqual(out[1].reply_markup.inline_keyboard[0].map((b) => b.callback_data), [`a:${pendingTask.id}`, `r:${pendingTask.id}`])
  assert.match(out[1].text, /\(다시 보냄 · 처음 요청/)
  assert.equal(out[2].reply_markup.force_reply, true)

  // 다시 보낸 답장 칸에 사유를 달아도 재계획된다
  assert.equal(await send('제목 바꿔서', { replyTo: out[2].message_id }), 'pending')
  assert.equal(rejectedTask.status, 'PENDING')
  // 다시 보낸 버튼으로 승인해도 동작한다
  await handleUpdate(click(`a:${pendingTask.id}`))
  assert.equal(pendingTask.status, 'COMPLETED')
})

test('/cancel: 결재·사유 대기 작업을 모두 취소, 실행 중은 그대로, 예전 버튼은 "이미 처리됨"', async () => {
  await send('회의 A')
  const a = lastTask()
  await send('회의 B')
  const b = lastTask()
  await handleUpdate(click(`r:${b.id}`))
  const running = await createTask({ query: '실행 중 작업', sourceUpdateId: updateId++, status: 'EXECUTING', log: { agent: 'executor', event: 'X' } })

  assert.equal(await send('/cancel'), 'cancelled-all')
  assert.equal(a.status, 'FAILED')
  assert.equal(b.status, 'FAILED')
  assert.equal(a.event_logs.at(-1).event, 'CANCELLED')
  assert.equal(a.event_logs.at(-1).agent, 'captain')
  assert.equal(fake.tasks.find((t) => t.id === running.id).status, 'EXECUTING')
  assert.match(fake.sent.at(-1).text, /🛑 대기 중이던 작업 2건을 취소했어요\.\n• 회의 A\n• 회의 B\n실행 중인 작업 1건은 멈출 수 없어/)
  assert.equal(await handleUpdate(click(`a:${a.id}`)), 'already')
  assert.equal(await send('/cancel'), 'cancelled-all')
  assert.match(fake.sent.at(-1).text, /취소할 대기 작업이 없어요/)
})

test('모르는 명령 → 안내만, AI·작업 없음', async () => {
  assert.equal(await send('/delete_all'), 'unknown-command')
  assert.equal(fake.tasks.length, 0)
  assert.match(fake.sent.at(-1).text, /모르는 명령이에요: \/delete_all/)
})

test('명령은 주인만', async () => {
  assert.equal(await handleUpdate(message('/cancel', { updateId: updateId++, chatId: 99 })), 'not-owner')
  assert.equal(fake.sent.length, 0)
})
