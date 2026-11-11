// 개발 팀 작업 기록 입구(/api/dev-log): 보안 문지기, 본문 검사(비밀 값 거부), 저장, 실패 알림.
// 가짜 Supabase·텔레그램만 쓴다.

import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import handler, { alertText, devLogRow } from '../dev-log.js'
import { resetOwnerCache } from './owner.js'
import { OWNER, OWNER_UID, callWebhook, installFakes } from './testkit.js'

const SECRET = 'dev-log-secret-0123456789-abcdefghijk'
let fake
beforeEach(() => {
  fake = installFakes()
  process.env.DEV_LOG_SECRET = SECRET
  resetOwnerCache()
})

const BODY = { agent: 'qa', kind: 'review', status: 'pass', summary: '재검토 통과: 커밋해도 됨', ref: 'd2adaa0' }
const send = (body = BODY, headers = { 'x-dev-log-secret': SECRET }, method = 'POST') => callWebhook(handler, { method, body, headers })

test('문지기: 시크릿 없음·짧음 503, POST 아님 405, 틀림·없음 401, DB에 닿지 않음', async () => {
  delete process.env.DEV_LOG_SECRET
  assert.equal((await send()).status, 503)
  process.env.DEV_LOG_SECRET = 'short'
  assert.equal((await send()).status, 503)
  process.env.DEV_LOG_SECRET = `${SECRET} `
  assert.equal((await send()).status, 503)
  process.env.DEV_LOG_SECRET = SECRET
  const get = await send(BODY, { 'x-dev-log-secret': SECRET }, 'GET')
  assert.equal(get.status, 405)
  assert.equal(get.headers.Allow, 'POST')
  assert.deepEqual((await send(BODY, { 'x-dev-log-secret': 'wrong' })).body, { error: 'unauthorized' })
  assert.equal((await send(BODY, {})).status, 401)
  assert.equal(fake.dbCalls, 0)
  assert.equal(fake.tables.dev_log.length, 0)
})

test('정상 기록: 주인 user_id로 한 줄 저장, 통과는 알림 없음', async () => {
  const result = await send()
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { status: 'saved', alerted: false })
  assert.equal(fake.tables.dev_log.length, 1)
  const row = fake.tables.dev_log[0]
  assert.equal(row.user_id, OWNER_UID)
  assert.equal(row.agent, 'qa')
  assert.equal(row.summary, '재검토 통과: 커밋해도 됨')
  assert.equal(row.ref, 'd2adaa0')
  assert.equal(fake.sent.length, 0)
})

test('본문 검사: 모르는 에이전트·종류·상태, 빈 요약은 400, 공백 정리와 300자 자르기', async () => {
  for (const bad of [{ ...BODY, agent: 'boss' }, { ...BODY, kind: 'sleep' }, { ...BODY, status: 'ok' }, { ...BODY, summary: '   ' }, { ...BODY, summary: 3 }, null, []]) {
    assert.equal((await send(bad)).status, 400)
  }
  assert.equal(fake.tables.dev_log.length, 0)
  const { row } = devLogRow({ ...BODY, summary: `  여러\n줄   요약 ${'가'.repeat(400)}` })
  assert.ok(row.summary.startsWith('여러 줄 요약 '))
  assert.equal(row.summary.length, 300)
})

test('비밀 값처럼 보이는 요약은 저장하지 않는다 (커밋 해시 40자는 통과)', async () => {
  for (const summary of ['키 sk-ant-api03-abcdefghijk', '토큰 eyJhbGciOiJIUzI1NiIsInR5cCI6', 'sb_secret_abc', `값 ${'A1b2'.repeat(11)}`]) {
    const result = await send({ ...BODY, summary })
    assert.equal(result.status, 400)
    assert.equal(result.body.error, 'looks-secret')
  }
  assert.equal(fake.tables.dev_log.length, 0)
  assert.ok(devLogRow({ ...BODY, summary: `커밋 ${'a'.repeat(40)}` }).row)
  // 파일 경로·주소는 길어도 통과, 알려진 토큰 모양은 거부
  for (const ok of ['api/_agents/depts/schedule/scheduleDepartmentTools.js 수정', `https://github.com/leejongsoo91-create/LEE0011/commit/${'a'.repeat(40)}`]) {
    assert.ok(devLogRow({ ...BODY, summary: ok }).row, ok)
  }
  for (const bad of [`봇 1234567890:AAH${'x'.repeat(33)}`, `ghp_${'a'.repeat(36)}`, 'xoxb-123', `AKIA${'A'.repeat(16)}`]) {
    assert.equal(devLogRow({ ...BODY, summary: bad }).error, 'looks-secret', bad)
  }
  // ref 주소에 토큰이 붙어 있어도 거부
  assert.equal(devLogRow({ ...BODY, ref: `https://a.b/?t=ghp_${'a'.repeat(36)}` }).error, 'looks-secret')
})

test('ref는 커밋 해시나 https 주소만', () => {
  assert.equal(devLogRow({ ...BODY, ref: 'https://claude.ai/artifact/abc' }).row.ref, 'https://claude.ai/artifact/abc')
  assert.equal(devLogRow({ ...BODY, ref: '' }).row.ref, null)
  assert.equal(devLogRow({ ...BODY, ref: 'javascript:alert(1)' }).error, 'bad-ref')
  assert.equal(devLogRow({ ...BODY, ref: 'http://x.y' }).error, 'bad-ref')
})

test('알림: QA 실패와 배포 실패만 텔레그램으로, 다른 실패는 기록만', async () => {
  assert.equal(alertText({ agent: 'lead', kind: 'edit', status: 'fail', summary: 'x' }), null)
  assert.equal(alertText({ agent: 'qa', kind: 'review', status: 'pass', summary: 'x' }), null)

  const qa = await send({ ...BODY, status: 'fail', summary: '테스트 2개 실패' })
  assert.deepEqual(qa.body, { status: 'saved', alerted: true })
  const deploy = await send({ agent: 'devops', kind: 'deploy', status: 'fail', summary: '배포 화면이 옛 버전' })
  assert.equal(deploy.body.alerted, true)
  const lead = await send({ agent: 'lead', kind: 'test', status: 'fail', summary: '빌드 실패' })
  assert.equal(lead.body.alerted, false)

  assert.equal(fake.sent.length, 2)
  assert.equal(fake.sent[0].chat_id, OWNER)
  assert.match(fake.sent[0].text, /QA 검토·테스트 실패\n테스트 2개 실패/)
  assert.match(fake.sent[1].text, /배포 실패/)
  assert.equal(fake.tables.dev_log.length, 3)
})

test('텔레그램이 실패해도 기록은 남고 200, DB 실패면 500', async () => {
  fake.failTelegram = true
  const result = await send({ ...BODY, status: 'fail' })
  assert.deepEqual(result.body, { status: 'saved', alerted: false })
  assert.equal(fake.tables.dev_log.length, 1)

  fake.failDb = true
  const failed = await send()
  assert.equal(failed.status, 500)
  assert.deepEqual(failed.body, { error: 'store-failed' })
})
