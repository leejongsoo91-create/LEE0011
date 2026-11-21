// 개발 창 데이터 관리 입구(/api/dev-admin, 보고서 12 3단계): 주인만, 묶기·풀기·숨기기·고치기·합치기, 정리 기록.
// 가짜 Supabase(로그인 확인 포함)만 쓴다.

import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import handler, { mergedWork, parseAdmin } from '../dev-admin.js'
import { resetOwnerCache } from './owner.js'
import { OWNER_UID, callWebhook, installFakes } from './testkit.js'

const OTHER_UID = '22222222-2222-4222-8222-222222222222'
const TOKENS = { 'Bearer owner-token': OWNER_UID, 'Bearer other-token': OTHER_UID }
const L1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const L2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const L3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const W1 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const W2 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

let fake
beforeEach(() => {
  fake = installFakes()
  resetOwnerCache()
  process.env.SUPABASE_ANON_KEY = 'anon-key'
  const base = globalThis.fetch
  globalThis.fetch = async (url, options = {}) => {
    if (new URL(url).pathname === '/auth/v1/user') {
      const id = TOKENS[options.headers?.Authorization]
      return id ? new Response(JSON.stringify({ id })) : new Response('{}', { status: 401 })
    }
    return base(url, options)
  }
  fake.tables.dev_log.push(
    { id: L1, user_id: OWNER_UID, agent: 'lead', kind: 'edit', status: 'pass', summary: '수정', work_key: null, project: '대시보드', hidden: false },
    { id: L2, user_id: OWNER_UID, agent: 'qa', kind: 'test', status: 'pass', summary: '테스트', work_key: '보고서12-1', project: '대시보드', hidden: false },
    { id: L3, user_id: OTHER_UID, agent: 'lead', kind: 'edit', status: 'pass', summary: '남의 것', work_key: null, project: '대시보드', hidden: false },
  )
  fake.tables.dev_work.push(
    { id: W1, user_id: OWNER_UID, project: '대시보드', work_key: '보고서12-1', title: '하나', reason: null, changes: '- 가', areas: ['DB'], files: [{ path: 'a.js', added: 1, removed: 0 }], commits: ['aaaaaaa'], status: '완료', started_at: '2026-11-20T01:00:00.000Z', finished_at: '2026-11-20T02:00:00.000Z', hidden: false },
    { id: W2, user_id: OWNER_UID, project: '대시보드', work_key: '보고서12-2', title: '둘', reason: '왜 둘', changes: '- 나', areas: ['화면'], files: [{ path: 'a.js', added: 2, removed: 1 }], commits: ['bbbbbbb'], status: '진행 중', started_at: '2026-11-19T01:00:00.000Z', finished_at: null, hidden: false },
  )
})

const call = (body, authorization = 'Bearer owner-token') => callWebhook(handler, { body, headers: authorization ? { authorization } : {} })
const audits = () => fake.tables.dev_log.filter((row) => row.agent === 'devops')

test('문지기: 로그인 없음 401, 주인 아님 403, POST 아님 405, 아무것도 안 바뀜', async () => {
  const body = { action: 'hide', target: 'log', ids: [L1], hidden: true }
  assert.equal((await call(body, null)).status, 401)
  assert.equal((await call(body, 'Bearer wrong')).status, 401)
  assert.equal((await call(body, 'Bearer other-token')).status, 403)
  assert.equal((await callWebhook(handler, { method: 'GET', body, headers: { authorization: 'Bearer owner-token' } })).status, 405)
  assert.equal(fake.tables.dev_log[0].hidden, false)
  assert.equal(audits().length, 0)
})

test('묶기·풀기: 주인 기록만 바뀌고 정리 기록이 남는다, 없는 작업이면 404', async () => {
  const result = await call({ action: 'assign', log_ids: [L1, L3], work_key: '보고서12-2' })
  assert.deepEqual(result.body, { ok: true, changed: 1 })
  assert.equal(fake.tables.dev_log.find((row) => row.id === L1).work_key, '보고서12-2')
  assert.equal(fake.tables.dev_log.find((row) => row.id === L3).work_key, null, '남의 기록은 그대로')
  assert.equal(audits()[0].summary, '데이터 정리: 기록 1줄을 보고서12-2에 묶음')
  assert.equal(audits()[0].work_key, undefined, '정리 기록은 작업에 묶지 않는다 (진행 줄에 섞이지 않게)')

  assert.equal((await call({ action: 'assign', log_ids: [L1], work_key: '보고서99' })).status, 404)
  await call({ action: 'unassign', log_ids: [L1] })
  assert.equal(fake.tables.dev_log.find((row) => row.id === L1).work_key, null)
})

test('숨기기·되살리기', async () => {
  await call({ action: 'hide', target: 'work', ids: [W1], hidden: true })
  assert.equal(fake.tables.dev_work[0].hidden, true)
  await call({ action: 'hide', target: 'work', ids: [W1], hidden: false })
  assert.equal(fake.tables.dev_work[0].hidden, false)
  assert.match(audits().at(-1).summary, /작업 1개 되살림/)
})

test('고치기: 준 칸만, 검사 통과한 값만, 보고서 링크 비우기', async () => {
  const ok = await call({ action: 'edit', work_key: '보고서12-1', fields: { reason: '이유를 나중에 채움', areas: ['화면', '보안'], status: '되돌림' } })
  assert.equal(ok.status, 200)
  const row = fake.tables.dev_work[0]
  assert.equal(row.reason, '이유를 나중에 채움')
  assert.deepEqual(row.areas, ['화면', '보안'], '분야는 고른 것으로 바꾼다')
  assert.equal(row.status, '되돌림')
  assert.equal(row.title, '하나')
  assert.match(audits().at(-1).summary, /보고서12-1 고침 \(이유·분야·상태\)/)

  row.report_url = 'https://claude.ai/artifact/x'
  await call({ action: 'edit', work_key: '보고서12-1', fields: { report_url: '' } })
  assert.equal(row.report_url, null)

  for (const fields of [{ status: 'done' }, { areas: ['UI'] }, { commits: ['abc1234'] }, { title: '' }, {}, { reason: '키 sk-ant-api03-abcdefghijk' }]) {
    assert.equal((await call({ action: 'edit', work_key: '보고서12-1', fields })).status, 400, JSON.stringify(fields))
  }
  assert.equal((await call({ action: 'edit', work_key: '보고서99', fields: { title: 'x' } })).status, 404)
})

test('합치기: 커밋·파일·분야·내용·기록을 옮기고 빈 쪽은 숨김', async () => {
  const result = await call({ action: 'merge', from: '보고서12-2', into: '보고서12-1' })
  assert.equal(result.status, 200)
  const [into, from] = fake.tables.dev_work
  assert.deepEqual(into.commits, ['aaaaaaa', 'bbbbbbb'])
  assert.deepEqual(into.files, [{ path: 'a.js', added: 3, removed: 1 }])
  assert.deepEqual(into.areas, ['DB', '화면'])
  assert.equal(into.changes, '- 가\n- 나')
  assert.equal(into.reason, '왜 둘', 'into에 이유가 없으면 from 것')
  assert.equal(into.started_at, '2026-11-19T01:00:00.000Z')
  assert.equal(from.hidden, true)
  assert.match(audits().at(-1).summary, /보고서12-2을 보고서12-1에 합침/)
  assert.equal((await call({ action: 'merge', from: '보고서12-1', into: '보고서12-1' })).status, 400)
  // 같은 합치기를 다시 하면 숨긴 작업이라 막히고 줄 수가 두 번 더해지지 않는다
  const again = await call({ action: 'merge', from: '보고서12-2', into: '보고서12-1' })
  assert.deepEqual([again.status, again.body.error], [400, 'work-hidden'])
  assert.deepEqual(into.files, [{ path: 'a.js', added: 3, removed: 1 }])
})

test('숨긴 작업에는 묶기·고치기를 하지 않고, 작업 번호 모양이 틀리면 bad-work-key', async () => {
  fake.tables.dev_work[1].hidden = true
  assert.equal((await call({ action: 'assign', log_ids: [L1], work_key: '보고서12-2' })).body.error, 'work-hidden')
  assert.equal((await call({ action: 'edit', work_key: '보고서12-2', fields: { title: 'x' } })).body.error, 'work-hidden')
  assert.equal(fake.tables.dev_log[0].work_key, null)
  assert.equal((await call({ action: 'assign', log_ids: [L1], work_key: 'R12' })).body.error, 'bad-work-key')
  assert.equal((await call({ action: 'merge', from: 'R1', into: '보고서12-1' })).body.error, 'bad-work-key')
})

test('본문 검사: 모르는 동작, id 모양, 개수 한도', () => {
  assert.equal(parseAdmin({ action: 'delete', ids: [L1] }).error, 'bad-request')
  assert.equal(parseAdmin({ action: 'unassign', log_ids: ['1 or 1=1'] }).error, 'bad-request')
  assert.equal(parseAdmin({ action: 'unassign', log_ids: Array(201).fill(L1) }).error, 'bad-request')
  assert.equal(parseAdmin({ action: 'hide', target: 'log', ids: [L1], hidden: 'yes' }).error, 'bad-request')
  assert.equal(parseAdmin({ action: 'assign', log_ids: [L1], work_key: 'R12' }).error, 'bad-work-key')
  assert.equal(mergedWork({ finished_at: null }, { finished_at: '2026-11-20T00:00:00Z' }).finished_at, '2026-11-20T00:00:00Z')
})

test('프로젝트: 작업은 그 프로젝트 안에서만 찾고, 묶으면 기록의 프로젝트도 맞춘다 (보고서 13)', async () => {
  const W3 = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  fake.tables.dev_work.push({ id: W3, user_id: OWNER_UID, project: '주식', work_key: '수정-20261120-1', title: '주식 작업', commits: [], files: [], areas: [], hidden: false })
  assert.equal((await call({ action: 'assign', log_ids: [L1], work_key: '수정-20261120-1' })).status, 404, '대시보드에는 그 번호가 없다')
  assert.equal((await call({ action: 'assign', log_ids: [L1], work_key: '수정-20261120-1', project: '주식' })).status, 200)
  const log = fake.tables.dev_log.find((row) => row.id === L1)
  assert.deepEqual([log.work_key, log.project], ['수정-20261120-1', '주식'])
  assert.equal(audits().at(-1).summary, '데이터 정리: [주식] 기록 1줄을 수정-20261120-1에 묶음')
  assert.equal((await call({ action: 'edit', work_key: '보고서12-1', project: '주식', fields: { title: 'x' } })).status, 404)
  assert.equal(parseAdmin({ action: 'unassign', log_ids: [L1], project: 'finviz' }).error, 'bad-project')
})
