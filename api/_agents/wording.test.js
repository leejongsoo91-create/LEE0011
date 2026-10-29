// 4단계 마무리: 자동 작업 안내 문구 (되묻기 안내, 규칙 번호 풀어쓰기, 데이터 변경 경고)

import test from 'node:test'
import assert from 'node:assert/strict'
import { approvalText, clarificationText } from './report.js'
import { buildSystemPrompt } from './planner.js'
import { loadRules } from './rules.js'

const origin = { kind: 'schedule', schedule_id: 'abc', title: '주간 회고', when: '10/30(금) 03:07' }
const scheduleTask = {
  task_query: '테스트 (일정 \'주간 회고\' 10/30(금) 03:07에 맞춘 자동 작업)',
  event_logs: [{ agent: 'intake', event: 'CREATED', origin }],
}
const directTask = { task_query: '회의 등록', event_logs: [{ agent: 'intake', event: 'CREATED' }] }

const listStep = { tool: 'schedule.list', args: { from: '2026-10-30', to: '2026-10-30' } }
const createStep = { tool: 'schedule.create', args: { title: '회의', date: '2026-10-30', time: '15:00', remind_before_min: 0 } }
const plan = (steps) => ({ summary: '요약', steps, main: { program: 'anthropic', model: 'claude-sonnet-5-5' } })
const approval = (steps) =>
  approvalText({ ...directTask, plan_payload: plan(steps), reject_count: 0, expires_at: '2026-10-30T10:00:00Z' }, null)

const OLD_TAIL = '내용을 보태서 지시를 다시 보내 주세요.'

test('1. 일정 자동 작업의 되묻기: 일정 문장을 고치라고 안내하고, 옛 안내는 나오지 않는다', () => {
  const text = clarificationText(scheduleTask, '어떤 작업을 할까요?')
  assert.match(text, /^🔔 \[스케줄 자동 알림\] '주간 회고' 일정\(10\/30\(금\) 03:07\)이 다가와요\./)
  assert.match(text, /대시보드 일정에 적은 문장이 짧아서 무엇을 할지 알 수 없어요/)
  assert.match(text, /'주간 회고' 일정의 🤖 에이전트 작업 문장을 구체적으로 고쳐 주세요/)
  assert.match(text, /텔레그램으로 지시를 직접 보내 주세요/)
  assert.ok(!text.includes(OLD_TAIL))
})

test('2. 텔레그램 직접 지시의 되묻기는 예전 문구 그대로', () => {
  const text = clarificationText(directTask, '날짜를 알려 주세요')
  assert.equal(text, ['❓ 계획을 세우기 전에 확인이 필요해요', '지시: 회의 등록', '', '날짜를 알려 주세요', '', OLD_TAIL].join('\n'))
})

test('3. 데이터 변경 경고: 조회만 → 바뀌지 않음, 쓰기 포함 → 바뀜 경고, 알 수 없는 도구 → 쓰기로 간주', () => {
  const readOnly = approval([listStep])
  assert.ok(readOnly.endsWith('ℹ️ 조회만 하는 계획이라 대시보드 데이터는 바뀌지 않습니다.'))
  assert.ok(!readOnly.includes('데이터가 바뀝니다'))

  const writes = approval([createStep])
  assert.ok(writes.endsWith('⚠️ 실제 대시보드 데이터가 바뀝니다. (실패하면 역순으로 원복)'))

  const mixed = approval([listStep, createStep])
  assert.match(mixed, /데이터가 바뀝니다/)

  const unknown = approval([{ tool: 'nothing.unknown', args: {} }])
  assert.match(unknown, /데이터가 바뀝니다/)
})

test('4. 규칙서: 규칙 번호는 로그에서만 쓰고 요약에는 풀어쓴다는 문장이 AI 지시문에 들어간다', async () => {
  const rules = await loadRules()
  const prompt = buildSystemPrompt(rules, new Date('2026-10-30T03:00:00Z'))
  assert.match(prompt, /규칙 번호\(G-n\)는 로그에서 어느 규칙 때문인지 가리키는 데만 쓴다\. 결재 요약과 보고에는 번호를 쓰지 않고, 풀어쓴 말로 적는다/)
  assert.match(prompt, /일정에 맞춘 자동 작업이라 읽기 전용이어도 결재를 받습니다/)
  assert.ok(!prompt.includes('로그와 결재 요약에서 어느 규칙'))
})
