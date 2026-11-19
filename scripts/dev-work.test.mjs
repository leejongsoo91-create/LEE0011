import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitWorkArg } from './dev-log.mjs'
import { execFileSync } from 'node:child_process'
import { parseOptions } from './dev-work.mjs'
import { devWorkFields } from '../api/_lib/devWork.js'
import { looksSecret } from '../api/dev-log.js'
import { areasFor, commitBody, groupCommits, kstDay, parseCommitMessage, parseGitLog, parseNumstat, reportKey } from './dev-work-lib.mjs'

test('--work 인자: 어디에 있어도 빼내고 나머지 순서는 그대로', () => {
  assert.deepEqual(splitWorkArg(['lead', 'edit', 'pass', '요약', '--work', '보고서12-1', 'abc1234']), { rest: ['lead', 'edit', 'pass', '요약', 'abc1234'], work: '보고서12-1' })
  assert.deepEqual(splitWorkArg(['lead', 'edit']), { rest: ['lead', 'edit'], work: null })
  assert.deepEqual(parseOptions(['start', '보고서12-1', '제목', '--reason', '왜', '--report', 'https://claude.ai/x']), {
    rest: ['start', '보고서12-1', '제목'],
    options: { reason: '왜', report: 'https://claude.ai/x' },
  })
})

test('numstat: 줄 수, 바이너리 0, 이름 바꾸기는 새 이름, 이상한 경로는 뺀다', () => {
  const text = ['3\t1\tsrc/a.js', '-\t-\tpublic/icon.png', '0\t0\tsrc/{old => new}/b.js', '2\t0\told.md => docs/new.md', '1\t1\tbad name.js', '1\t0\t../x.js'].join('\n')
  assert.deepEqual(parseNumstat(text), [
    { path: 'src/a.js', added: 3, removed: 1 },
    { path: 'public/icon.png', added: 0, removed: 0 },
    { path: 'src/new/b.js', added: 0, removed: 0 },
    { path: 'docs/new.md', added: 2, removed: 0 },
  ])
})

test('분야: 경로별 한글 분야, 보안 낱말이 있으면 보안', () => {
  assert.deepEqual(areasFor(['src/a.jsx', 'api/b.js', 'supabase/migrations/x.sql', 'scripts/c.mjs', '.claude/rules/d.md', 'README.md', 'vercel.json']), ['화면', '에이전트', 'DB', '개발도구', '문서', '설정'])
  assert.deepEqual(areasFor(['vercel.json'], '보안 헤더 추가'), ['설정', '보안'])
  assert.deepEqual(areasFor([]), [])
})

test('커밋 메시지: 제목·왜·작업·바꾼 내용, 공동 작성자 줄은 뺀다', () => {
  const message = '업무 탭 걸러 보기 (보고서 11 2단계)\n\n왜: 할 일이 회의마다 흩어져서\n작업: 보고서11-2\n- 숫자 눌러 걸러 보기\n* 남은 할 일 목록\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n'
  assert.deepEqual(parseCommitMessage(message), {
    subject: '업무 탭 걸러 보기 (보고서 11 2단계)',
    reason: '할 일이 회의마다 흩어져서',
    workKey: '보고서11-2',
    changes: ['- 숫자 눌러 걸러 보기', '- 남은 할 일 목록'],
  })
})

test('보고서 번호: 단계 있으면 N-M, 없으면 N', () => {
  assert.equal(reportKey('홈 오늘 칸 (보고서 11 1단계)'), '보고서11-1')
  assert.equal(reportKey('보안 보완 (보고서 10)'), '보고서10')
  assert.equal(reportKey('멀티 에이전트 2단계: 뼈대'), null)
})

test('한국 날짜: UTC 밤은 다음 날', () => {
  assert.equal(kstDay('2026-11-19T16:00:00Z'), '20261120')
  assert.equal(kstDay('2026-11-20T08:31:31+09:00'), '20261120')
})

const LOG = [
  ['a'.repeat(40), '2026-11-18T01:00:00+09:00', '고치기 하나\n\n- 첫째', '1\t0\tsrc/a.js'],
  ['b'.repeat(40), '2026-11-18T02:00:00+09:00', '홈 오늘 칸 (보고서 11 1단계)\n\n왜: 오늘 할 일을 바로 보려고', '5\t1\tsrc/b.jsx\n2\t0\tsrc/a.js'],
  ['c'.repeat(40), '2026-11-18T03:00:00+09:00', '홈 리뷰 반영 (보고서 11 1단계)', '1\t1\tsrc/b.jsx'],
  ['d'.repeat(40), '2026-11-18T23:30:00+09:00', '고치기 둘', '1\t0\tREADME.md'],
  ['e'.repeat(40), '2026-11-18T23:40:00+09:00', 'revert: 고치기 둘 되돌림', '0\t1\tREADME.md'],
]
  .map(([hash, at, message, numstat]) => `\x1e${hash}\x1f${at}\x1f${message}\x1d\n${numstat}\n`)
  .join('')

test('git log 해석과 지난 커밋 묶기: 보고서 번호끼리, 나머지는 날짜 순번, 커밋마다 본문 하나', () => {
  const commits = parseGitLog(LOG)
  assert.equal(commits.length, 5)
  assert.deepEqual(commits[1].files, [{ path: 'src/b.jsx', added: 5, removed: 1 }, { path: 'src/a.js', added: 2, removed: 0 }])
  const groups = groupCommits(commits)
  assert.deepEqual(groups.map((group) => group.work_key), ['수정-20261118-1', '보고서11-1', '수정-20261118-2', '수정-20261118-3'])
  const [head, second] = groups[1].requests
  assert.equal(groups[1].requests.length, 2)
  assert.equal(head.title, '홈 오늘 칸 (보고서 11 1단계)')
  assert.equal(head.reason, '오늘 할 일을 바로 보려고')
  assert.equal(head.changes, '- 홈 오늘 칸 (보고서 11 1단계)\n- 홈 리뷰 반영 (보고서 11 1단계)')
  assert.equal(head.started_at, '2026-11-18T02:00:00+09:00')
  assert.equal(head.finished_at, '2026-11-18T03:00:00+09:00')
  assert.deepEqual(head.commits, ['bbbbbbb'])
  assert.deepEqual(second, { type: 'work', work_key: '보고서11-1', commits: ['ccccccc'], files: [{ path: 'src/b.jsx', added: 1, removed: 1 }] })
  assert.equal(groups[0].requests[0].changes, '- 첫째')
  assert.equal(groups[0].requests[0].reason, undefined)
  assert.equal(groups[3].requests[0].status, '되돌림')
  assert.deepEqual(groups[3].requests[0].areas, ['문서'])
})

test('지난 커밋 묶기: 손으로 붙인 같은 날 번호는 건너뛰고, 모양이 틀린 작업: 줄은 무시', () => {
  const log = [
    ['a'.repeat(40), '2026-11-20T01:00:00+09:00', '자동 번호 받을 커밋'],
    ['b'.repeat(40), '2026-11-20T02:00:00+09:00', '손 번호\n\n작업: 수정-20261120-1'],
    ['c'.repeat(40), '2026-11-20T03:00:00+09:00', '틀린 번호\n\n작업: R12'],
  ]
    .map(([hash, at, message]) => `\x1e${hash}\x1f${at}\x1f${message}\x1d\n1\t0\tsrc/a.js\n`)
    .join('')
  assert.deepEqual(groupCommits(parseGitLog(log)).map((group) => group.work_key), ['수정-20261120-2', '수정-20261120-1', '수정-20261120-3'])
})

test('커밋 본문: 커밋 하나, 제목·분야·바꾼 내용·이유', () => {
  assert.deepEqual(commitBody('보고서11-1', parseGitLog(LOG)[1]), {
    type: 'work',
    work_key: '보고서11-1',
    title: '홈 오늘 칸 (보고서 11 1단계)',
    commits: ['bbbbbbb'],
    files: [{ path: 'src/b.jsx', added: 5, removed: 1 }, { path: 'src/a.js', added: 2, removed: 0 }],
    areas: ['화면'],
    reason: '오늘 할 일을 바로 보려고',
  })
})

test('이 저장소의 지난 커밋 전부가 서버 검사를 통과한다 (긴 마이그레이션 이름 포함)', () => {
  const log = execFileSync('git', ['-c', 'core.quotepath=off', 'log', '--reverse', '--no-merges', '--numstat', '--format=%x1e%H%x1f%aI%x1f%B%x1d'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const requests = groupCommits(parseGitLog(log)).flatMap((group) => group.requests)
  assert.ok(requests.length > 0)
  for (const request of requests) {
    const result = devWorkFields(request, looksSecret)
    assert.equal(result.error, undefined, `${request.work_key} ${request.commits[0]}: ${result.error}`)
  }
})
