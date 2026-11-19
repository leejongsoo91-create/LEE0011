import test from 'node:test'
import assert from 'node:assert/strict'
import {
  changeLines,
  cleanQuery,
  commitUrl,
  currentStep,
  fileTotals,
  fileUrl,
  filterByAgent,
  groupWorks,
  mondayOf,
  parseAgent,
  parseAnchor,
  parsePeriod,
  periodRange,
  rangeToTimes,
  stepLine,
} from './devWork.js'

test('주소 값 검사: 모르는 값은 기본값', () => {
  assert.equal(parsePeriod('month'), 'month')
  assert.equal(parsePeriod('day'), 'week')
  assert.equal(parseAgent('qa'), 'qa')
  assert.equal(parseAgent('boss'), 'all')
  assert.equal(parseAnchor('2026-02-03', '2026-11-20'), '2026-02-03')
  for (const bad of [null, '2026-2-3', 'x', '2026-13-45', '2026-02-30', '2026-04-31']) assert.equal(parseAnchor(bad, '2026-11-20'), '2026-11-20', String(bad))
})

test('주는 월요일 시작, 해·달 넘김', () => {
  assert.equal(mondayOf('2026-11-20'), '2026-11-16') // 금
  assert.equal(mondayOf('2026-11-22'), '2026-11-16') // 일
  assert.equal(mondayOf('2026-11-16'), '2026-11-16') // 월
  assert.deepEqual(periodRange('week', '2027-01-01'), { from: '2026-12-28', to: '2027-01-03', label: '12/28(월) ~ 1/3(일)', prev: '2026-12-21', next: '2027-01-04' })
})

test('달·해 기간: 말일(윤년 포함)과 옆 기간', () => {
  assert.deepEqual(periodRange('month', '2028-02-10'), { from: '2028-02-01', to: '2028-02-29', label: '2028년 2월', prev: '2028-01-31', next: '2028-03-01' })
  assert.equal(periodRange('month', '2026-12-31').next, '2027-01-01')
  assert.deepEqual(periodRange('year', '2026-11-20'), { from: '2026-01-01', to: '2026-12-31', label: '2026년', prev: '2025-01-01', next: '2027-01-01' })
  assert.deepEqual(rangeToTimes({ from: '2026-11-16', to: '2026-11-22' }), { start: '2026-11-16T00:00:00+09:00', end: '2026-11-23T00:00:00+09:00' })
})

const works = [
  { id: 1, work_key: '보고서12-1', started_at: '2026-11-19T16:30:00Z', status: '완료' }, // 한국 11-20 01:30 (금)
  { id: 2, work_key: '보고서11-2', started_at: '2026-11-18T23:00:00Z', status: '완료' }, // 11-19 (목)
  { id: 3, work_key: '수정-20261110-1', started_at: '2026-11-10T03:00:00Z', status: '되돌림' }, // 11-10 (화)
  { id: 4, work_key: '수정-20261015-1', started_at: '2026-10-15T03:00:00Z', status: '완료' },
]

test('묶기: 주간은 한국 날짜별, 월간은 주별, 연간은 달별 (최신이 위)', () => {
  assert.deepEqual(groupWorks(works.slice(0, 2), 'week').map((g) => [g.label, g.items.map((w) => w.id)]), [
    ['11월 20일 (금)', [1]],
    ['11월 19일 (목)', [2]],
  ])
  assert.deepEqual(groupWorks(works.slice(0, 3), 'month').map((g) => [g.key, g.label, g.items.length]), [
    ['2026-11-16', '11/16 ~ 11/22', 2],
    ['2026-11-09', '11/9 ~ 11/15', 1],
  ])
  assert.deepEqual(groupWorks(works, 'year').map((g) => [g.key, g.label, g.items.length]), [
    ['2026-11-01', '11월', 3],
    ['2026-10-01', '10월', 1],
  ])
  assert.deepEqual(groupWorks(null, 'week'), [])
  assert.deepEqual(groupWorks(works.slice(2), 'year', { withYear: true }).map((g) => g.label), ['2026년 11월', '2026년 10월'], '검색 결과는 연도를 붙인다')
})

const logs = [
  { id: 'a', agent: 'lead', kind: 'plan', status: 'pass', work_key: '보고서12-1', created_at: '2026-11-20T01:00:00Z' },
  { id: 'b', agent: 'qa', kind: 'test', status: 'fail', work_key: '보고서12-1', created_at: '2026-11-20T02:00:00Z' },
  { id: 'c', agent: 'qa', kind: 'test', status: 'pass', work_key: '보고서12-1', created_at: '2026-11-20T03:00:00Z' },
  { id: 'd', agent: 'lead', kind: 'commit', status: 'pass', work_key: '보고서12-1', created_at: '2026-11-20T04:00:00Z' },
  { id: 'e', agent: 'devops', kind: 'check', status: 'pass', work_key: null, created_at: '2026-11-20T05:00:00Z' },
]

test('에이전트 거르기: Lead·전체는 모두, QA·DevOps는 자기 기록이 있는 작업만', () => {
  assert.equal(filterByAgent(works, logs, 'all').length, 4)
  assert.equal(filterByAgent(works, logs, 'lead').length, 4)
  assert.deepEqual(filterByAgent(works, logs, 'qa').map((w) => w.id), [1])
  assert.deepEqual(filterByAgent(works, logs, 'devops'), [], '작업 번호 없는 기록은 묶이지 않는다')
})

test('진행 줄: 단계 순서대로 단계별 마지막 기록, 지금 단계', () => {
  assert.deepEqual(stepLine(logs.slice(0, 4)).map((row) => row.id), ['a', 'c', 'd'])
  assert.equal(currentStep({ status: '진행 중' }, logs.slice(0, 4)), '커밋 통과')
  assert.equal(currentStep({ status: '진행 중' }, logs.slice(0, 2)), '테스트 실패')
  assert.equal(currentStep({ status: '진행 중' }, []), '진행 중')
  assert.equal(currentStep({ status: '완료' }, logs), '완료')
})

test('바꾼 내용 줄, 파일 합계, GitHub 링크', () => {
  assert.deepEqual(changeLines('- 하나\n\n* 둘\n셋 '), ['하나', '둘', '셋'])
  assert.deepEqual(changeLines(null), [])
  assert.deepEqual(fileTotals([{ added: 3, removed: 1 }, { added: 2, removed: 0 }]), { added: 5, removed: 1 })
  assert.equal(commitUrl('130d878'), 'https://github.com/leejongsoo91-create/LEE0011/commit/130d878')
  assert.equal(commitUrl('javascript:x'), null)
  assert.equal(fileUrl('130d878', 'src/a.js'), 'https://github.com/leejongsoo91-create/LEE0011/blob/130d878/src/a.js')
  assert.equal(fileUrl(undefined, 'src/a.js'), null)
})

test('검색어 정리: 조회식을 깨는 글자 제거, 40자', () => {
  assert.equal(cleanQuery('  보고서 11, (2단계)*  '), '보고서 11 2단계')
  assert.equal(cleanQuery('a%b\\c"d'), 'a b c d')
  assert.equal(cleanQuery('가'.repeat(50)).length, 40)
  assert.equal(cleanQuery(null), '')
})
