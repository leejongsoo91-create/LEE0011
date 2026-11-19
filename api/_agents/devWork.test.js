// 개발 팀 작업 단위 기록(보고서 12): /api/dev-log의 type:'work' 요청, 한 줄 기록의 작업 번호, 검사·합치기.
// 가짜 Supabase만 쓴다.

import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import handler, { devLogRow, looksSecret } from '../dev-log.js'
import { devWorkFields, mergeFiles, mergeWork } from '../_lib/devWork.js'
import { resetOwnerCache } from './owner.js'
import { OWNER_UID, callWebhook, installFakes } from './testkit.js'

const SECRET = 'dev-log-secret-0123456789-abcdefghijk'
let fake
beforeEach(() => {
  fake = installFakes()
  process.env.DEV_LOG_SECRET = SECRET
  resetOwnerCache()
})

const send = (body, headers = { 'x-dev-log-secret': SECRET }) => callWebhook(handler, { body, headers })
const START = { type: 'work', work_key: '보고서12-1', title: '작업 기록 정리', reason: '나중에 왜 바꿨는지 찾으려고', report_url: 'https://claude.ai/artifact/LCaYcg5FjjqbdKyGt9rfpB' }
const COMMIT = {
  type: 'work',
  work_key: '보고서12-1',
  commits: ['abc1234'],
  files: [
    { path: 'api/dev-log.js', added: 10, removed: 2 },
    { path: 'supabase/migrations/20261120000000_dev_work.sql', added: 60, removed: 0 },
  ],
  areas: ['에이전트', 'DB'],
  changes: '- 작업 단위 표\n- 기록 입구',
}

test('작업 단위: 시크릿 없으면 401, DB에 닿지 않음', async () => {
  assert.equal((await send(START, { 'x-dev-log-secret': 'wrong' })).status, 401)
  assert.equal(fake.dbCalls, 0)
})

test('작업 단위: 시작 → 커밋 → 같은 커밋 다시 → 완료. 줄 수는 한 번만 더한다', async () => {
  assert.deepEqual((await send(START)).body, { status: 'created' })
  assert.equal(fake.tables.dev_work.length, 1)
  const row = fake.tables.dev_work[0]
  assert.equal(row.user_id, OWNER_UID)
  assert.equal(row.title, '작업 기록 정리')

  assert.deepEqual((await send(COMMIT)).body, { status: 'updated' })
  assert.deepEqual((await send(COMMIT)).body, { status: 'updated' })
  assert.deepEqual(row.commits, ['abc1234'])
  assert.deepEqual(row.files.find((file) => file.path === 'api/dev-log.js'), { path: 'api/dev-log.js', added: 10, removed: 2 })
  assert.deepEqual(row.areas, ['에이전트', 'DB'])
  assert.equal(row.reason, '나중에 왜 바꿨는지 찾으려고', '준 칸만 고치고 이유는 그대로')

  await send({ type: 'work', work_key: '보고서12-1', title: '커밋 제목', reason: '커밋 메시지의 왜', changes: '- 둘째 커밋', commits: ['def5678'], files: [{ path: 'api/dev-log.js', added: 1, removed: 1 }] })
  assert.deepEqual(row.commits, ['abc1234', 'def5678'])
  assert.deepEqual(row.files.find((file) => file.path === 'api/dev-log.js'), { path: 'api/dev-log.js', added: 11, removed: 3 })
  assert.equal(row.changes, '- 작업 단위 표\n- 기록 입구\n- 둘째 커밋', '새 커밋의 바꾼 내용은 뒤에 이어 붙는다')
  assert.equal(row.title, '작업 기록 정리', 'start로 정한 제목은 커밋 제목이 덮지 않는다')
  assert.equal(row.reason, '나중에 왜 바꿨는지 찾으려고', 'start로 적은 이유도 그대로')
  await send({ type: 'work', work_key: '보고서12-1', changes: '- 둘째 커밋', commits: ['def5678'], files: [{ path: 'api/dev-log.js', added: 1, removed: 1 }] })
  assert.equal(row.changes, '- 작업 단위 표\n- 기록 입구\n- 둘째 커밋', '같은 커밋을 다시 보내도 내용이 늘지 않는다')

  await send({ type: 'work', work_key: '보고서12-1', status: '완료', finished_at: '2026-11-20T10:00:00+09:00' })
  assert.equal(row.status, '완료')
  assert.equal(row.finished_at, '2026-11-20T01:00:00.000Z')
  assert.equal(fake.tables.dev_work.length, 1)
})

test('작업 단위: start 없이 commit부터 와도 커밋 제목으로 만든다', async () => {
  const result = await send({ ...COMMIT, work_key: '수정-20261120-1', title: '작은 수정' })
  assert.deepEqual(result.body, { status: 'created' })
  assert.equal(fake.tables.dev_work[0].title, '작은 수정')
})

test('작업 단위: 파일 줄 수는 커밋 하나씩만 받는다 (섞어 보내면 두 번 더해질 수 있어서)', () => {
  const result = devWorkFields({ work_key: '보고서12', commits: ['abc1234', 'def5678'], files: [{ path: 'a.js', added: 1, removed: 0 }] }, looksSecret)
  assert.equal(result.error, 'one-commit-per-files')
  assert.equal(devWorkFields({ work_key: '보고서12', files: [{ path: 'a.js', added: 1, removed: 0 }] }, looksSecret).error, 'one-commit-per-files')
})

test('작업 단위: 긴 마이그레이션 파일 이름은 비밀 값으로 보지 않고, 경로 속 토큰 머리글은 거른다', () => {
  const file = (path) => devWorkFields({ work_key: '보고서12', commits: ['abc1234'], files: [{ path, added: 1, removed: 0 }] }, looksSecret)
  assert.ok(file('supabase/migrations/20261021010000_add_user_id_and_auth_policies.sql').fields)
  assert.equal(file('notes/sk-ant-api03-abcdefghijk.txt').error, 'looks-secret')
})

test('작업 단위: 처음인데 제목이 없으면 400 need-title', async () => {
  const result = await send(COMMIT)
  assert.equal(result.status, 400)
  assert.equal(result.body.error, 'need-title')
  assert.equal(fake.tables.dev_work.length, 0)
})

test('작업 단위 검사: 한글 작업 번호·분야·상태만, 주소·파일·커밋 모양', () => {
  const check = (extra) => devWorkFields({ work_key: '보고서12', title: 'x', ...extra }, looksSecret)
  for (const key of ['보고서12', '보고서12-1', '수정-20261120-1', '수정-20261120-12']) assert.ok(devWorkFields({ work_key: key }, looksSecret).fields, key)
  for (const key of ['R12-1', 'F-20261120-1', '보고서', '수정-2026112-1', '보고서12-1; drop', '', null]) {
    assert.equal(devWorkFields({ work_key: key }, looksSecret).error, 'bad-work-key', String(key))
  }
  assert.equal(check({ areas: ['UI'] }).error, 'bad-areas')
  assert.equal(check({ status: 'done' }).error, 'bad-status')
  assert.equal(check({ report_url: 'https://evil.example/claude.ai' }).error, 'bad-report-url')
  assert.equal(check({ commits: ['xyz'] }).error, 'bad-commits')
  assert.equal(check({ commits: ['abc1234'], files: [{ path: '../etc/passwd', added: 1, removed: 0 }] }).error, 'bad-files')
  assert.equal(check({ commits: ['abc1234'], files: [{ path: 'a.js', added: -1, removed: 0 }] }).error, 'bad-files')
  assert.equal(check({ commits: ['abc1234'], files: [{ path: 'a.js', added: 1 }] }).error, 'bad-files')
  assert.equal(check({ title: '' }).error, 'bad-request')
  assert.equal(check({ started_at: 'yesterday' }).error, 'bad-time')
  assert.ok(check({ commits: ['abc1234'], files: [{ path: 'src/pages/홈.jsx', added: 1, removed: 0 }] }).fields)
})

test('작업 단위 검사: 비밀 값처럼 보이면 저장하지 않고, 긴 글은 자르고 줄은 남긴다', async () => {
  for (const extra of [{ reason: '키 sk-ant-api03-abcdefghijk' }, { changes: `값 ${'A1b2'.repeat(11)}` }, { title: 'eyJhbGciOiJIUzI1NiIsInR5cCI6' }]) {
    const result = await send({ ...START, ...extra })
    assert.equal(result.body.error, 'looks-secret')
  }
  assert.equal(fake.tables.dev_work.length, 0)
  const { fields } = devWorkFields({ work_key: '보고서12', title: ' 여러\n줄 제목 ', changes: `- 하나  \n\n\n\n- 둘\n${'가'.repeat(3000)}` }, looksSecret)
  assert.equal(fields.title, '여러 줄 제목')
  assert.ok(fields.changes.startsWith('- 하나\n\n- 둘\n'))
  assert.equal(fields.changes.length, 2000)
})

test('합치기: 같은 파일은 더하고, 이미 받은 커밋만 오면 아무것도 더하지 않는다, 50개 넘는 커밋은 줄 수도 안 더함', () => {
  assert.deepEqual(mergeFiles([{ path: 'a', added: 1, removed: 0 }], [{ path: 'a', added: 2, removed: 1 }, { path: 'b', added: 1, removed: 0 }]), [
    { path: 'a', added: 3, removed: 1 },
    { path: 'b', added: 1, removed: 0 },
  ])
  const existing = { title: '제목', commits: ['abc1234'], files: [{ path: 'a', added: 1, removed: 0 }], areas: ['화면'], changes: '- 하나' }
  const again = mergeWork(existing, { work_key: '보고서1', title: '다른 제목', commits: ['abc1234'], files: [{ path: 'a', added: 1, removed: 0 }], areas: ['DB'], changes: '- 하나' })
  assert.deepEqual(again, { commits: ['abc1234'], areas: ['화면', 'DB'] })
  const full = { commits: Array.from({ length: 50 }, (_, i) => i.toString(16).padStart(7, '0')), files: [{ path: 'a', added: 1, removed: 0 }] }
  const over = mergeWork(full, { work_key: '보고서1', commits: ['fffffff'], files: [{ path: 'a', added: 5, removed: 0 }] })
  assert.equal(over.commits.length, 50)
  assert.equal(over.files, undefined)
  // 지난 커밋 채우기를 다시 돌려도(이미 받은 커밋 + 상태·시각) 상태·시각이 바뀌지 않는다
  const doing = { title: '제목', status: '진행 중', started_at: '2026-11-20T00:00:00.000Z', commits: ['abc1234'], files: [] }
  const rerun = mergeWork(doing, { work_key: '보고서1', title: '제목', commits: ['abc1234'], files: [], status: '완료', started_at: '2026-11-19T00:00:00.000Z', finished_at: '2026-11-19T01:00:00.000Z' })
  assert.deepEqual(rerun, { commits: ['abc1234'] })
  // start·done처럼 커밋이 없는 요청은 준 칸을 그대로 바꾼다
  assert.deepEqual(mergeWork(existing, { work_key: '보고서1', title: '새 제목', status: '완료' }), { title: '새 제목', status: '완료' })
})

test('한 줄 기록: 작업 번호를 같이 남기고, 모양이 틀리면 400', async () => {
  const LINE = { agent: 'lead', kind: 'edit', status: 'pass', summary: '수정 끝', work: '보고서12-1' }
  assert.equal((await send(LINE)).status, 200)
  assert.equal(fake.tables.dev_log[0].work_key, '보고서12-1')
  assert.equal((await send({ ...LINE, work: 'R12' })).body.error, 'bad-work-key')
  assert.equal(devLogRow({ ...LINE, work: undefined }).row.work_key, undefined, '작업 번호 없이도 된다')
})

test('한 줄 기록: SQL 실행 전(work_key 칸 없음)이면 작업 번호만 빼고 남긴다', async () => {
  fake.noWorkKeyColumn = true
  const result = await send({ agent: 'lead', kind: 'edit', status: 'pass', summary: '수정 끝', work: '보고서12-1' })
  assert.equal(result.status, 200)
  assert.equal(fake.tables.dev_log.length, 1)
  assert.equal(fake.tables.dev_log[0].work_key, undefined)
})
