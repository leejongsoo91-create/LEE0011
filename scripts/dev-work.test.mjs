import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitWorkArg } from './dev-log.mjs'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { parseOptions } from './dev-work.mjs'
import { devWorkFields } from '../api/_lib/devWork.js'
import { looksSecret } from '../api/dev-log.js'
import { areasFor, attachChangelog, checkProjectRepo, commitBody, recentGroups, groupCommits, koreanTitle, parseChangelog, kstDay, parseCommitMessage, parseGitLog, parseNumstat, reportKey } from './dev-work-lib.mjs'

test('--work 인자: 어디에 있어도 빼내고 나머지 순서는 그대로', () => {
  assert.deepEqual(splitWorkArg(['lead', 'edit', 'pass', '요약', '--work', '보고서12-1', 'abc1234']), { rest: ['lead', 'edit', 'pass', '요약', 'abc1234'], work: '보고서12-1', project: null })
  assert.deepEqual(splitWorkArg(['lead', 'edit', '--project', '주식']), { rest: ['lead', 'edit'], work: null, project: '주식' })
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

test('제목 머리글 한글로 (보고서 13)', () => {
  assert.equal(koreanTitle('feat: 시장 거래 창'), '기능: 시장 거래 창')
  assert.equal(koreanTitle('fix(ui): 버튼'), '수정: 버튼')
  assert.equal(koreanTitle('refactor+fix: 코드 정리'), '다듬기·수정: 코드 정리')
  assert.equal(koreanTitle('Initial commit: 처음'), 'Initial commit: 처음', '모르는 머리글은 그대로')
  assert.equal(koreanTitle('홈 오늘 칸 (보고서 11 1단계)'), '홈 오늘 칸 (보고서 11 1단계)')
})

test('주식 사이트 분야: 파일 모양으로', () => {
  assert.deepEqual(areasFor(['templates/index.html', 'static/js/app.js', 'app.py', 'screener_api.py', 'api/keys.py', 'data_fetcher.py', 'data/x.json', 'pe_eps_cache.json', 'scripts/team_up.py', 'docs/CHANGELOG.md', 'requirements.txt'], '', '주식'), ['화면', '에이전트', '데이터', '개발도구', '문서', '설정'])
})

test('변경 기록 읽기와 짝짓기: 해시 칸, 같은 날 낱말 겹침, 짝 없으면 그대로', () => {
  const text = ['## 2026-11', '- 11-21 | 버그 | **시간외 등락 기준** 수정 | (이번 커밋)', '- 11-21 | 데이터 | 거래대금 과거치 불러오기 | (이번 커밋)', '- 11-20 | 기능 | 해시로 이어진 줄 | abcdef1', '- 11-20 | 기능 | 같은 커밋 둘째 줄 | 1234567, abcdef1', '- 11-19 | 환경 | 짝 없는 줄 | (이번 커밋)', '## 2026-10', '- 10-30~31 | 문서 | 날짜 범위 | -', '- 이상한 줄'].join('\n')
  const entries = parseChangelog(text)
  assert.deepEqual(entries.map((e) => [e.day, e.kind, e.commits]), [['20261121', '버그', []], ['20261121', '데이터', []], ['20261120', '기능', ['abcdef1']], ['20261120', '기능', ['1234567', 'abcdef1']], ['20261119', '환경', []], ['20261030', '문서', []]])
  assert.equal(entries.skipped, 0, '"- 이상한 줄"은 날짜로 시작하지 않아 기록 줄이 아니다')
  assert.equal(entries[0].content, '시간외 등락 기준 수정')
  const log = [
    ['abcdef1' + '0'.repeat(33), '2026-11-20T10:00:00+09:00', 'feat: 아무 제목'],
    ['b'.repeat(40), '2026-11-21T09:00:00+09:00', 'feat: 국내 거래대금 과거치 불러오기'],
    ['c'.repeat(40), '2026-11-21T10:00:00+09:00', 'fix: 시간외 등락 기준 통일'],
  ].map(([hash, at, message]) => `\x1e${hash}\x1f${at}\x1f${message}\n\n- 커밋 본문 줄\x1d\n1\t0\tapp.py\n`).join('')
  const groups = groupCommits(parseGitLog(log), { project: '주식' })
  assert.equal(groups[0].requests[0].project, '주식')
  assert.equal(groups[1].requests[0].title, '기능: 국내 거래대금 과거치 불러오기')
  const result = attachChangelog(groups, entries)
  assert.equal(result.paired, 4)
  assert.deepEqual(result.unpaired.map((e) => e.kind), ['환경', '문서'])
  assert.equal(groups[0].requests[0].changes, '- [기능] 해시로 이어진 줄\n- [기능] 같은 커밋 둘째 줄\n- 커밋 본문 줄', '해시 짝은 여러 줄, 커밋 본문 줄은 뒤에 남는다')
  // 해시 2~3개 줄은 그 커밋들의 작업 모두에, 4개 이상(요약 줄)은 첫 작업에만
  const two = groupCommits(parseGitLog(log), { project: '주식' })
  attachChangelog(two, parseChangelog(['## 2026-11', `- 11-21 | 기능 | 두 커밋 줄 | ${'b'.repeat(7)}, ${'c'.repeat(7)}`].join('\n')))
  assert.deepEqual(two.map((group) => Boolean(group.requests[0].paired)), [false, true, true])
  const many = groupCommits(parseGitLog(log), { project: '주식' })
  attachChangelog(many, parseChangelog(['## 2026-11', `- 11-21 | 요약 | 여러 단계 | abcdef1, ${'b'.repeat(7)}, ${'c'.repeat(7)}, 1111111`].join('\n')))
  assert.deepEqual(many.map((group) => Boolean(group.requests[0].paired)), [true, false, false])
  assert.equal(groups[1].requests[0].changes, '- [데이터] 거래대금 과거치 불러오기\n- 커밋 본문 줄')
  assert.equal(groups[2].requests[0].changes, '- [버그] 시간외 등락 기준 수정\n- 커밋 본문 줄')
  assert.equal(groups[2].requests[0].paired, true)
})

test('주식 사이트 커밋 전부가 서버 검사를 통과한다 (저장소가 있을 때만)', { skip: !existsSync('/root/stockview/.git') }, () => {
  const log = execFileSync('git', ['-C', '/root/stockview', '-c', 'core.quotepath=off', 'log', '--reverse', '--no-merges', '--numstat', '--format=%x1e%H%x1f%aI%x1f%B%x1d'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const requests = groupCommits(parseGitLog(log), { project: '주식' }).flatMap((group) => group.requests)
  assert.ok(requests.length > 100)
  for (const request of requests) {
    const result = devWorkFields(request, looksSecret)
    assert.equal(result.error, undefined, `${request.work_key} ${request.commits[0]}: ${result.error}`)
    assert.equal(result.fields.project, '주식')
  }
})

test('프로젝트·저장소 확인: 엉뚱한 저장소의 커밋이 다른 프로젝트로 들어가지 않게', () => {
  const dash = 'https://github.com/leejongsoo91-create/LEE0011.git'
  const stock = 'https://github.com/leejongsoo91-create/stockview.git'
  assert.equal(checkProjectRepo('대시보드', undefined, dash), null)
  assert.equal(checkProjectRepo('주식', '/root/stockview', stock), null)
  assert.match(checkProjectRepo('주식', undefined, dash), /--repo/)
  assert.match(checkProjectRepo('대시보드', '/root/stockview', stock, { projectGiven: false }), /--project/)
  assert.match(checkProjectRepo('주식', '/root/stockview', dash), /저장소가 주식/)
  assert.match(checkProjectRepo('대시보드', undefined, stock), /저장소가 대시보드/)
  assert.match(checkProjectRepo('finviz', undefined, dash), /모르는 프로젝트/)
})

test('최근 며칠 안의 작업만 (자동 기록 장치용), 0이면 전부', () => {
  const now = Date.parse('2026-11-21T12:00:00Z')
  const group = (finished) => ({ requests: [{ finished_at: finished }] })
  const groups = [group('2026-11-21T01:00:00Z'), group('2026-11-19T13:00:00Z'), group('2026-11-19T11:00:00Z')]
  assert.equal(recentGroups(groups, 2, now).length, 2)
  assert.equal(recentGroups(groups, 0, now).length, 3)
  assert.equal(recentGroups([group('2026-11-19T12:00:00Z')], 2, now).length, 1, '정확히 2일 전은 포함')
})

test('--recent-days에 잘못된 값이면 이력 전체를 보내지 않고 멈춘다', () => {
  const run = (extra) => spawnSync(process.execPath, [fileURLToPath(new URL('./dev-work-backfill.mjs', import.meta.url)), ...extra], { encoding: 'utf8' })
  for (const bad of [['--recent-days', 'abc'], ['--recent-days'], ['--recent-days', '0']]) {
    const result = run(bad)
    assert.equal(result.status, 2, bad.join(' '))
    assert.match(result.stderr, /1 이상의 수/)
  }
})
