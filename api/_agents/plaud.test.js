// 업무 탭 + Plaud 연동: 요약에서 할 일 뽑기, 입구(/api/plaud-hook) 보안, 받은함 → 결재 → 실행·반려·만료·원복.
// 가짜 데이터만 쓴다 (실제 Plaud·Zapier·Supabase·텔레그램 호출 없음).

import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import cronHandler from '../agent-cron.js'
import hookHandler, { inboxRow } from '../plaud-hook.js'
import { handleUpdate } from './approval.js'
import { workImportMeeting } from './depts/work/tools.js'
import { resetOwnerCache } from './owner.js'
import { MAX_TODOS, PLAUD_APPROVAL_TTL_MS, parseTodos, plaudKey, plaudTimeToIso, whenLabel } from './plaud.js'
import { aiTools } from './planner.js'
import { OWNER_UID, callWebhook, click, installFakes } from './testkit.js'

const CRON_SECRET = 'cron-secret-0123456789-abcdefghijklmn'
const HOOK_SECRET = 'plaud-hook-secret-0123456789-abcdefgh'
let fake
beforeEach(() => {
  fake = installFakes()
  process.env.CRON_SECRET = CRON_SECRET
  process.env.PLAUD_HOOK_SECRET = HOOK_SECRET
  resetOwnerCache()
})

const SUMMARY = [
  '## 1. 촬영 일정 정리',
  '이번 주 촬영 순서를 정했다.',
  '### 작업 계획',
  '- [ ] **씬 목록** 정리해서 공유 -- *가람* *나래* 2026-11-14',
  '- [ ] 장비 점검 -- 2026-11-15',
  '## 2. 기타',
  '### 실행 항목',
  '- [ ] 참고 영상 모으기',
  '- [x] 이미 끝난 일',
  '> **AI 제안**',
  '> 1. 정해지지 않은 것: 예산',
].join('\n')

const BODY = { title: '11-12 회의: 촬영 일정', summary: SUMMARY, created_at: '2026-11-12T17:42:32Z', transcript: '녹취록 전문 (저장하면 안 됨)' }

const hook = (body = BODY, headers = { 'x-plaud-secret': HOOK_SECRET }, method = 'POST') => callWebhook(hookHandler, { method, body, headers })
const cron = () => callWebhook(cronHandler, { body: {}, headers: { 'x-cron-secret': CRON_SECRET } })
const approvals = () => fake.sent.filter((m) => m.reply_markup?.inline_keyboard)
const press = (action, task) => handleUpdate(click(`${action}:${task.id}`))

// 녹음 하나가 들어와 결재 요청까지 간 상태
async function receiveOne(body = BODY) {
  assert.equal((await hook(body)).status, 200)
  const result = await cron()
  assert.equal(result.status, 200)
  return fake.tasks.at(-1)
}

test('할 일 뽑기: "- [ ]" 줄만, 담당자 여럿·마감일·굵은 글씨 정리, 제목줄과 상관없이', () => {
  const { todos, skipped } = parseTodos(SUMMARY)
  assert.deepEqual(todos, [
    { title: '씬 목록 정리해서 공유', assignee: '가람, 나래', due_date: '2026-11-14' },
    { title: '장비 점검', assignee: null, due_date: '2026-11-15' },
    { title: '참고 영상 모으기', assignee: null, due_date: null },
  ])
  assert.equal(skipped, 0)
  assert.deepEqual(parseTodos('할 일 없음'), { todos: [], skipped: 0 })
  assert.equal(parseTodos('- [ ] 날짜 이상 -- 2026-02-30').todos[0].due_date, null, '없는 날짜는 버린다')

  const many = Array.from({ length: MAX_TODOS + 3 }, (_, i) => `- [ ] 할 일 ${i + 1}`).join('\n')
  const capped = parseTodos(many)
  assert.equal(capped.todos.length, MAX_TODOS)
  assert.equal(capped.skipped, 3)
})

test('시각과 중복 키: Create Time은 한국 시각으로 읽고, 같은 녹음이면 같은 키', () => {
  assert.equal(plaudTimeToIso('2026-11-12T17:42:32Z'), '2026-11-12T08:42:32.000Z')
  assert.equal(plaudTimeToIso('2026-11-12 09:05'), '2026-11-12T00:05:00.000Z')
  assert.equal(plaudTimeToIso('어제'), null)
  assert.equal(plaudTimeToIso(undefined), null)
  assert.equal(whenLabel('2026-11-12T08:42:32.000Z'), '11/12(목) 17:42')

  const key = plaudKey(BODY.created_at, BODY.title)
  assert.match(key, /^plaud:[0-9a-f]{16}$/)
  assert.equal(plaudKey(BODY.created_at, `  ${BODY.title}  `), key, '앞뒤 공백은 같은 녹음')
  assert.notEqual(plaudKey(BODY.created_at, '다른 회의'), key)
  assert.notEqual(plaudKey('2026-11-12T17:43:00Z', BODY.title), key)
})

test('입구 보안: 시크릿이 맞는 POST만 받고, 거부할 때는 DB에 닿지 않는다', async () => {
  const rejected = [
    [{}, 'POST', 401],
    [{ 'x-plaud-secret': 'wrong' }, 'POST', 401],
    [{ 'x-plaud-secret': 'x'.repeat(HOOK_SECRET.length) }, 'POST', 401],
    [{ 'x-plaud-secret': [HOOK_SECRET, HOOK_SECRET] }, 'POST', 401],
    [{ 'x-cron-secret': HOOK_SECRET }, 'POST', 401],
    [{ 'x-plaud-secret': HOOK_SECRET }, 'GET', 405],
  ]
  for (const [headers, method, status] of rejected) {
    const result = await hook(BODY, headers, method)
    assert.equal(result.status, status, JSON.stringify(headers))
    assert.equal(JSON.stringify(result.body).includes(HOOK_SECRET), false)
  }
  assert.equal(fake.dbCalls, 0)

  delete process.env.PLAUD_HOOK_SECRET
  assert.equal((await hook()).status, 503)
  process.env.PLAUD_HOOK_SECRET = 'short'
  assert.equal((await hook()).status, 503)
  process.env.PLAUD_HOOK_SECRET = ` ${HOOK_SECRET}`
  assert.equal((await hook(BODY, { 'x-plaud-secret': ` ${HOOK_SECRET}` })).status, 503, '앞뒤 공백이 있는 시크릿은 열지 않는다')
  assert.equal(fake.dbCalls, 0)
})

test('입구: 요약만 받은함에 넣고(녹취록 버림), 같은 녹음은 한 번만, 잘못된 본문은 400', async () => {
  const first = await hook()
  assert.deepEqual([first.status, first.body], [200, { status: 'queued' }])
  const again = await hook()
  assert.deepEqual([again.status, again.body], [200, { status: 'duplicate' }])
  assert.equal(fake.tables.plaud_inbox.length, 1)

  const row = fake.tables.plaud_inbox[0]
  assert.equal(row.source_key, plaudKey(BODY.created_at, BODY.title))
  assert.equal(row.title, BODY.title)
  assert.equal(row.recorded_at, '2026-11-12T08:42:32.000Z')
  assert.equal(JSON.stringify(row).includes('녹취록'), false, '녹취록은 저장하지 않는다')

  assert.equal((await hook({ title: 'x' })).status, 400)
  assert.equal((await hook([BODY])).status, 400)
  assert.equal(inboxRow({ summary: '', created_at: null }).title, '제목 없는 녹음')

  fake.failDb = true
  assert.deepEqual((await hook({ ...BODY, title: '다른 회의' })).body, { error: 'store-failed' })
})

test('받은함 → 결재 요청: 코드가 만든 계획, Plaud 머리말, 할 일 목록, 24시간 만료, AI 호출 없음', async () => {
  const before = Date.now()
  const task = await receiveOne()

  assert.equal(task.status, 'PENDING')
  assert.equal(task.source_key, plaudKey(BODY.created_at, BODY.title))
  assert.equal(task.plan_payload.main.program, 'code')
  assert.equal(task.plan_payload.steps[0].tool, 'work.import_meeting')
  const ttl = Date.parse(task.expires_at) - before
  assert.ok(ttl >= PLAUD_APPROVAL_TTL_MS - 1000 && ttl <= PLAUD_APPROVAL_TTL_MS + 5000, '24시간 뒤 만료')
  assert.deepEqual(task.event_logs.map((e) => [e.agent, e.event]), [
    ['intake', 'CREATED'],
    ['orchestrator', 'VALIDATED'],
  ])
  assert.equal(fake.tables.plaud_inbox.length, 0, '작업으로 옮긴 뒤 받은함은 비운다')

  const [msg] = approvals()
  assert.match(msg.text, /🎙 \[Plaud 회의 녹음\] '11-12 회의: 촬영 일정' \(11\/12\(목\) 17:42\)/)
  assert.match(msg.text, /회의 기록 등록: "11-12 회의: 촬영 일정" \(11\/12\(목\) 17:42\) · 할 일 카드 3장 \[쓰기·원복 가능\]\n/)
  assert.match(msg.text, /- 씬 목록 정리해서 공유 \(가람, 나래, 11\/14\)/)
  assert.match(msg.text, /- 참고 영상 모으기\n/)
  assert.match(msg.text, /⚙️ 계획: 코드가 자동으로 작성 \(AI 미사용\)/)
  assert.match(msg.text, /24시간 뒤 만료/)
  assert.match(msg.text, /실제 대시보드 데이터가 바뀝니다/)
  assert.equal(msg.text.includes('녹취록'), false)
  assert.deepEqual(msg.reply_markup.inline_keyboard[0].map((b) => b.callback_data), [`a:${task.id}`, `r:${task.id}`])
})

test('승인 → 회의 기록 1건 + 할 일 카드 3장 (주인 user_id, 회의 연결, 담당·마감)', async () => {
  const task = await receiveOne()
  assert.equal(await press('a', task), 'approved')

  assert.equal(fake.tasks[0].status, 'COMPLETED')
  const [meeting] = fake.tables.work_meetings
  assert.equal(meeting.user_id, OWNER_UID)
  assert.equal(meeting.title, BODY.title)
  assert.equal(meeting.summary_md, SUMMARY)
  assert.equal(meeting.todo_count, 3)
  assert.equal(meeting.recorded_at, '2026-11-12T08:42:32.000Z')

  assert.deepEqual(
    fake.tables.work.map((c) => [c.title, c.status, c.progress, c.assignee, c.due_date, c.meeting_id, c.user_id]),
    [
      ['씬 목록 정리해서 공유', 'Todo', 0, '가람, 나래', '2026-11-14', meeting.id, OWNER_UID],
      ['장비 점검', 'Todo', 0, null, '2026-11-15', meeting.id, OWNER_UID],
      ['참고 영상 모으기', 'Todo', 0, null, null, meeting.id, OWNER_UID],
    ],
  )
  assert.match(fake.sent.at(-1).text, /✅ 완료[\s\S]*회의 기록 1건 \+ 할 일 카드 3장 등록/)
})

test('반려 → 버리기: 아무것도 넣지 않고, 사유도 묻지 않는다', async () => {
  const task = await receiveOne()
  const sentBefore = fake.sent.length
  assert.equal(await press('r', task), 'discarded')

  assert.equal(fake.tasks[0].status, 'FAILED')
  assert.equal(fake.tasks[0].event_logs.at(-1).event, 'DISCARDED')
  assert.equal(fake.tables.work_meetings.length, 0)
  assert.equal(fake.tables.work.length, 0)
  assert.equal(fake.sent.length, sentBefore, '반려 사유를 묻는 메시지를 보내지 않는다')
  assert.match(fake.edits.at(-1).text, /업무 탭에 넣지 않았어요/)
  assert.equal(await press('a', task), 'already', '반려 뒤 승인 버튼은 먹지 않는다')
})

test('중복: Zapier가 다시 보내도, 받은함에 같은 녹음이 다시 들어와도 결재는 한 번', async () => {
  await receiveOne()
  await hook() // 받은함은 비었으니 다시 들어간다
  assert.equal(fake.tables.plaud_inbox.length, 1)
  await cron()
  assert.equal(approvals().length, 1)
  assert.equal(fake.tasks.length, 1)
  assert.equal(fake.tables.plaud_inbox.length, 0, '이미 있는 녹음이면 받은함에서 지우기만 한다')
})

test('만료: 24시간이 지나면 승인 버튼이 먹지 않는다', async () => {
  const task = await receiveOne()
  fake.tasks[0].expires_at = new Date(Date.now() - 1000).toISOString()
  assert.equal(await press('a', task), 'expired')
  assert.match(fake.edits.at(-1).text, /24시간 안에 결정하지 않아/)
  assert.equal(fake.tables.work_meetings.length, 0)
})

test('실패 → 원복: 카드 저장이 실패하면 회의 기록도 남지 않는다', async () => {
  const task = await receiveOne()
  fake.failWorkInsert = true
  await press('a', task)
  assert.equal(fake.tables.work_meetings.length, 0)
  assert.equal(fake.tables.work.length, 0)
  assert.equal(fake.tasks[0].status, 'FAILED')
  assert.match(fake.sent.at(-1).text, /실패/)
})

test('같은 녹음이 이미 회의 기록에 있으면 실행이 실패하고 아무것도 더 넣지 않는다', async () => {
  const task = await receiveOne()
  fake.tables.work_meetings.push({ id: crypto.randomUUID(), user_id: OWNER_UID, plaud_key: task.source_key, title: '이전 등록' })
  await press('a', task)
  assert.equal(fake.tables.work_meetings.length, 1)
  assert.equal(fake.tables.work.length, 0)
  assert.equal(fake.tasks[0].status, 'FAILED')
})

test('원복 도구: 이 회의에 붙은 내 카드와 회의 기록만 지운다', async () => {
  const task = await receiveOne()
  await press('a', task)
  const meeting = fake.tables.work_meetings[0]
  const other = { id: crypto.randomUUID(), user_id: 'someone-else', title: '남의 카드', meeting_id: meeting.id }
  const unrelated = { id: crypto.randomUUID(), user_id: OWNER_UID, title: '손으로 만든 카드', meeting_id: null }
  fake.tables.work.push(other, unrelated)

  const result = await workImportMeeting.undo({ title: meeting.title }, { meetingId: meeting.id })
  assert.match(result.summary, /회의 기록 삭제 \+ 카드 3장 삭제/)
  assert.deepEqual(fake.tables.work.map((c) => c.title), ['남의 카드', '손으로 만든 카드'])
  assert.equal(fake.tables.work_meetings.length, 0)
  assert.match((await workImportMeeting.undo({ title: 'x' }, { meetingId: meeting.id })).summary, /이미 지워진/)
})

test('원복 도구: 대시보드에서 고친 회의는 지우지 않고 실패로 알린다', async () => {
  const task = await receiveOne()
  await press('a', task)
  const meeting = fake.tables.work_meetings[0]
  meeting.edited_at = new Date().toISOString()
  await assert.rejects(workImportMeeting.undo({ title: meeting.title }, { meetingId: meeting.id }), /대시보드에서 수정된 회의라 원복하지 않았어요/)
  assert.equal(fake.tables.work_meetings.length, 1)
  assert.equal(fake.tables.work.length, 3)
})

test('원복 도구: edited_at 칸이 아직 없으면(SQL 실행 전) 고친 적 없는 회의로 보고 지운다', async () => {
  const task = await receiveOne()
  await press('a', task)
  const meeting = fake.tables.work_meetings[0]
  fake.noEditedAtColumn = true
  assert.match((await workImportMeeting.undo({ title: meeting.title }, { meetingId: meeting.id })).summary, /회의 기록 삭제/)
  assert.equal(fake.tables.work_meetings.length, 0)
  assert.equal(fake.tables.work.length, 0)
})

test('인자 검사: 형식이 틀리면 결재 전에 거부', () => {
  const good = {
    plaud_key: plaudKey('t', 'x'),
    title: '회의',
    recorded_at: null,
    summary_md: '',
    todos: [{ title: '할 일', assignee: null, due_date: null }],
    skipped: 0,
  }
  assert.equal(workImportMeeting.check(good), null)
  const bad = [
    [{ ...good, plaud_key: 'plaud:xyz' }, /plaud_key/],
    [{ ...good, title: '' }, /title/],
    [{ ...good, recorded_at: '어제' }, /recorded_at/],
    [{ ...good, summary_md: 'x'.repeat(20001) }, /summary_md/],
    [{ ...good, todos: Array(MAX_TODOS + 1).fill(good.todos[0]) }, /todos/],
    [{ ...good, todos: [{ title: 'x'.repeat(201), assignee: null, due_date: null }] }, /할 일 1: 제목/],
    [{ ...good, todos: [{ title: 'x', assignee: '', due_date: null }] }, /담당자/],
    [{ ...good, todos: [{ title: 'x', assignee: null, due_date: '2026-13-01' }] }, /마감일/],
    [{ ...good, todos: [{ title: 'x', assignee: null, due_date: null, extra: 1 }] }, /모르는 인자/],
    [{ ...good, skipped: -1 }, /skipped/],
    [{ ...good, user_id: OWNER_UID }, /모르는 인자/],
  ]
  for (const [args, pattern] of bad) assert.match(workImportMeeting.check(args), pattern)
})

test('AI 메인 에이전트에게는 업무 등록 도구가 보이지 않는다', () => {
  assert.equal(aiTools().some(([name]) => name === 'work.import_meeting'), false)
})

test('AGENT_MODE가 꺼져 있으면 받은함을 건드리지 않는다 (켜면 그때 결재 요청)', async () => {
  await hook()
  process.env.AGENT_MODE = 'off'
  assert.deepEqual((await cron()).body, { status: 'off' })
  assert.equal(fake.tables.plaud_inbox.length, 1)
  assert.equal(approvals().length, 0)
})
