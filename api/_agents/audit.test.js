// 프롬프트·설정 점검 수정: 계획 단계에서 멈춘 작업 정리(STALLED), 시간 한도 호출의 재시도 끄기, 규칙서 문장

import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { handleUpdate } from './approval.js'
import { aiPlan, buildSystemPrompt, submitPlanTool } from './planner.js'
import { loadRules } from './rules.js'
import { createTask } from './tasks.js'
import { fakeAnthropic, installFakes, message } from './testkit.js'

let fake
let updateId = 7000
beforeEach(() => {
  fake = installFakes()
})
const send = (text) => handleUpdate(message(text, { updateId: updateId++ }))

// 마지막 기록 시각을 minutesAgo분 전으로 맞춘 작업을 만든다
async function taskAt(status, minutesAgo, query = '멈춘 지시') {
  const task = await createTask({ query, sourceUpdateId: updateId++, status, log: { agent: 'intake', event: 'CREATED' } })
  const row = fake.tasks.find((t) => t.id === task.id)
  row.event_logs.at(-1).at = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString()
  return row
}

test('1. 6분 멈춘 PLANNING → 새 메시지가 오면 FAILED(STALLED) + 텔레그램 알림, 방금 시작한 PLANNING은 그대로', async () => {
  const stuck = await taskAt('PLANNING', 6, '내일 3시 회의')
  const fresh = await taskAt('PLANNING', 0.5, '방금 들어온 지시')

  await send('오늘 일정 조회')

  assert.equal(stuck.status, 'FAILED')
  const last = stuck.event_logs.at(-1)
  assert.equal(last.event, 'STALLED')
  assert.equal(last.agent, 'orchestrator')
  assert.match(last.note, /PLANNING 단계에서 5분 넘게/)
  assert.equal(fresh.status, 'PLANNING', '진행 중일 수 있는 작업은 건드리지 않는다')

  const notice = fake.sent[0]
  assert.equal(notice.text, '⚠️ 계획을 세우다 멈춘 작업을 정리했어요\n지시: 내일 3시 회의\n실행된 것은 없어요. 필요하면 지시를 다시 보내 주세요.')
  assert.equal(notice.reply_markup, undefined)
  assert.equal(fake.sent.filter((m) => m.text.includes('멈춘 작업')).length, 1, '알림은 멈춘 작업 하나에만')
})

test('2. 멈춘 VALIDATING도 같은 방식으로 정리, 한 번 정리한 작업은 다시 알리지 않음', async () => {
  const stuck = await taskAt('VALIDATING', 10)
  await send('조회')
  assert.equal(stuck.event_logs.at(-1).event, 'STALLED')
  const notices = () => fake.sent.filter((m) => m.text.startsWith('⚠️ 계획을 세우다 멈춘')).length
  assert.equal(notices(), 1)
  await send('조회 2')
  assert.equal(notices(), 1)
})

test('3. 시간 한도를 주면 AI 호출의 자동 재시도를 끄고, 한도가 없으면 기본 설정 그대로', async () => {
  const client = fakeAnthropic({ summary: '조회', steps: [{ tool: 'schedule.list', args: { from: '2026-10-30', to: '2026-10-30' } }] })
  await aiPlan('오늘 일정', { client, timeoutMs: 30_000 })
  assert.deepEqual(client.options[0], { timeout: 30_000, maxRetries: 0 })
  await aiPlan('오늘 일정', { client })
  assert.equal(client.options[1], undefined)
})

test('4. 메인 프롬프트: 강한 강조·박힌 날짜 없음, G-2 해석 규칙과 G-7·G-8 순서', async () => {
  const rules = await loadRules()
  const prompt = buildSystemPrompt(rules, new Date('2026-11-20T03:00:00Z'))
  for (const word of ['예외 없이', '절대', '반드시', '10/28']) assert.ok(!prompt.includes(word), `프롬프트에 "${word}"가 남아 있음`)
  assert.ok(!submitPlanTool().description.includes('반드시'))
  assert.match(prompt, /부서 규칙서에 정해 둔 해석 방법.*추측이 아니라 정해진 규칙/)
  assert.match(prompt, /현재 시각\(한국 시간, KST\): 2026-11-20\(금\) 12:00/)
  assert.ok(rules.global.indexOf('## G-7.') < rules.global.indexOf('## G-8.'))
})
