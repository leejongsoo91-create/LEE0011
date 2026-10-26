// 뼈대 마무리: 웹훅 위조 방지, 중간 오류 알림·원인 한 줄, 저장 여부를 알 수 없는 단계의 "확인 필요" 표시

import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import handler from '../webhook.js'
import { handleUpdate } from './approval.js'
import { friendlyReason } from './errors.js'
import { resetOwnerCache } from './owner.js'
import { setAnthropicClient } from './planner.js'
import { TEST_SECRET, callWebhook, click, fakeAnthropic, installFakes, message } from './testkit.js'

let fake
let updateId = 9000
beforeEach(() => {
  fake = installFakes()
  resetOwnerCache()
})
const send = (text) => handleUpdate(message(text, { updateId: updateId++ }))
const lastTask = () => fake.tasks.at(-1)

// 특정 요청만 실패시키는 도우미
function failWhen(predicate, makeResponse) {
  const original = globalThis.fetch
  globalThis.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : undefined
    if (predicate(new URL(url), options.method ?? 'GET', body)) return makeResponse()
    return original(url, options)
  }
}

test('1. 에이전트 켜짐 + 시크릿 미설정 → 주인인 척하는 승인 클릭도 처리하지 않음', async () => {
  assert.equal(await send('회의'), 'pending')
  const task = lastTask()
  const calls = fake.dbCalls
  const sent = fake.sent.length
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  const result = await callWebhook(handler, { body: click(`a:${task.id}`), headers: {} })
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { status: 'ignored' })
  assert.equal(task.status, 'PENDING')
  assert.equal(fake.dbCalls, calls)
  assert.equal(fake.sent.length, sent)
  assert.equal(fake.answers.length, 0)
})

test('2·3. 시크릿 설정됨: 헤더 없음·틀림·길이만 같음 → 401, 일치 → 처리', async () => {
  const wrongSameLength = 'x'.repeat(TEST_SECRET.length)
  for (const headers of [{}, { 'x-telegram-bot-api-secret-token': 'bad' }, { 'x-telegram-bot-api-secret-token': wrongSameLength }]) {
    assert.equal((await callWebhook(handler, { body: message('x', { updateId: updateId++ }), headers })).status, 401)
  }
  assert.equal(fake.tasks.length, 0)
  const ok = await callWebhook(handler, { body: message('회의', { updateId: updateId++ }) })
  assert.equal(ok.status, 200)
  assert.equal(lastTask().status, 'PENDING')
})

test('4. 에이전트 꺼짐 + 시크릿 미설정 → 기존 echo 그대로', async () => {
  fake = installFakes({ mode: null })
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  const result = await callWebhook(handler, { body: message('안녕'), headers: {} })
  assert.equal(result.status, 200)
  assert.match(fake.sent[0].text, /봇이 메시지를 수신했습니다/)
})

test('5. 계획 중 DB 오류 → "처리 중 문제" + 원인 한 줄', async () => {
  failWhen((url, method) => url.pathname.endsWith('/agent_tasks') && method === 'PATCH', () => new Response('{}', { status: 500 }))
  assert.equal(await send('회의'), 'error')
  assert.match(fake.sent.at(-1).text, /⚠️ 처리 중 문제가 생겼어요\n원인: 데이터베이스 오류 \(500\)$/)
})

test('6. 승인 뒤 실행 중 DB 오류 → 오류 알림 + 2분 뒤 자동 정리 안내', async () => {
  assert.equal(await send('회의'), 'pending')
  failWhen((url, method, body) => method === 'PATCH' && body?.status === 'EXECUTING', () => new Response('{}', { status: 503 }))
  assert.equal(await handleUpdate(click(`a:${lastTask().id}`)), 'error')
  assert.match(fake.sent.at(-1).text, /처리 중 문제[\s\S]*데이터베이스 오류 \(503\)[\s\S]*2분 뒤 자동으로 정리/)
})

test('7. 원인 한 줄: AI 오류 종류별 문장, 비밀 값 없음', () => {
  class APIConnectionTimeoutError extends Error {}
  class APIConnectionError extends Error {}
  const api = (status, message) => Object.assign(new Error(`${status} ${message}`), { status, error: { error: { message } } })
  assert.match(friendlyReason(api(401, 'invalid x-api-key')), /AI 키가 맞지 않아요/)
  assert.match(friendlyReason(api(400, 'Your credit balance is too low')), /크레딧이 부족/)
  assert.match(friendlyReason(api(404, 'model: claude-x')), /쓸 수 없는 모델/)
  assert.match(friendlyReason(api(529, 'Overloaded')), /AI 서버가 바빠요/)
  assert.match(friendlyReason(api(429, 'rate limit')), /AI 서버가 바빠요/)
  assert.match(friendlyReason(new APIConnectionTimeoutError('Request timed out.')), /너무 늦었어요/)
  assert.match(friendlyReason(new APIConnectionError('Connection error.')), /연결하지 못했어요/)
  assert.equal(
    friendlyReason(api(400, 'tool_choice: type "tool" and "any" are not supported for this model.')),
    'AI 요청 오류 (400): tool_choice: type "tool" and "any" are not supported for this model.',
  )
  assert.match(friendlyReason(new Error('supabase-not-configured')), /데이터베이스 설정이 없어요/)
  assert.equal(friendlyReason(new Error('supabase-network')), '데이터베이스 오류 (network)')
  assert.ok(friendlyReason(new Error('x'.repeat(500))).length <= 121)
  process.env.ANTHROPIC_API_KEY = 'sk-ant-secret-value'
  assert.doesNotMatch(friendlyReason(api(401, 'invalid x-api-key')), /sk-ant/)
})

test('7-2. AI 401 → 텔레그램 실패 메시지에 원인 한 줄', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key'
  setAnthropicClient(fakeAnthropic(Object.assign(new Error('401'), { status: 401, error: { error: { message: 'invalid x-api-key' } } })))
  assert.equal(await send('회의'), 'plan-failed')
  assert.match(fake.sent.at(-1).text, /계획을 만들지 못했어요\n원인: AI 키가 맞지 않아요/)
})

test('8. 일정 등록이 연결 끊김·500으로 실패 → "확인 필요" 표시, STEP_UNCERTAIN 기록', async () => {
  for (const make of [() => Promise.reject(new TypeError('fetch failed')), () => new Response('{}', { status: 500 })]) {
    fake = installFakes()
    resetOwnerCache()
    process.env.ANTHROPIC_API_KEY = 'test-key'
    setAnthropicClient(fakeAnthropic({ summary: 'x', steps: [{ tool: 'schedule.create', args: { title: '회의', date: '2026-10-28', time: '15:00', remind_before_min: 0 } }] }))
    assert.equal(await send('내일 3시 회의'), 'pending')
    failWhen((url, method) => url.pathname.endsWith('/schedule') && method === 'POST', make)
    await handleUpdate(click(`a:${lastTask().id}`))
    assert.equal(lastTask().status, 'FAILED')
    assert.ok(lastTask().event_logs.some((e) => e.event === 'STEP_UNCERTAIN'))
    assert.match(fake.sent.at(-1).text, /⚠️ 확인 필요: 1\. 일정 등록 \(10\/28\(수\) 15:00 · "회의" · 정시 알림\) — 저장됐는지 알 수 없어요/)
  }
})

test('9. 일정 등록이 400(확실히 안 됨)으로 실패 → "확인 필요" 없음', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key'
  setAnthropicClient(fakeAnthropic({ summary: 'x', steps: [{ tool: 'schedule.create', args: { title: '회의', date: '2026-10-28' } }] }))
  await send('회의')
  failWhen((url, method) => url.pathname.endsWith('/schedule') && method === 'POST', () => new Response('{}', { status: 400 }))
  await handleUpdate(click(`a:${lastTask().id}`))
  assert.ok(lastTask().event_logs.some((e) => e.event === 'STEP_FAILED'))
  assert.doesNotMatch(fake.sent.at(-1).text, /확인 필요/)
  assert.match(fake.sent.at(-1).text, /실패한 단계: 1\. 일정 등록 — 데이터베이스 오류 \(400\)/)
})
