import test from 'node:test'
import assert from 'node:assert/strict'
import { agoLabel, filterLog, lastLogAt, refLink, teamStatus, workSummary } from './teamStatus.js'

const NOW = Date.parse('2026-11-12T10:00:00Z')
const at = (minutesAgo) => new Date(NOW - minutesAgo * 60000).toISOString()

test('팀 상태: 에이전트별 최신 기록, 기록 없으면 none', () => {
  const rows = [
    { agent: 'lead', status: 'pass', created_at: at(20) },
    { agent: 'lead', status: 'running', created_at: at(5) },
    { agent: 'qa', status: 'pass', created_at: at(3) },
  ]
  const [lead, qa, devops] = teamStatus(rows, NOW)
  assert.equal(lead.state, 'running')
  assert.equal(lead.last.created_at, at(5))
  assert.equal(qa.state, 'pass')
  assert.equal(devops.state, 'none')
  assert.equal(devops.last, null)
})

test('팀 상태: 30분 넘으면 대기, 단 마지막이 실패면 실패 유지', () => {
  const [lead, qa] = teamStatus(
    [
      { agent: 'lead', status: 'running', created_at: at(31) },
      { agent: 'qa', status: 'fail', created_at: at(120) },
    ],
    NOW,
  )
  assert.equal(lead.state, 'idle')
  assert.equal(qa.state, 'fail')
  // 실패 뒤 새 통과 기록이 오면 통과
  const [, qa2] = teamStatus([{ agent: 'qa', status: 'fail', created_at: at(10) }, { agent: 'qa', status: 'pass', created_at: at(2) }], NOW)
  assert.equal(qa2.state, 'pass')
})

test('몇 분 전 표시', () => {
  assert.equal(agoLabel(at(0.5), NOW), '방금')
  assert.equal(agoLabel(at(3), NOW), '3분 전')
  assert.equal(agoLabel(at(125), NOW), '2시간 전')
  assert.equal(agoLabel(at(60 * 50), NOW), '2일 전')
  assert.equal(agoLabel(null, NOW), '')
})

test('로그 필터·최신 시각', () => {
  const rows = [
    { agent: 'qa', created_at: at(10) },
    { agent: 'lead', created_at: at(1) },
    { agent: 'qa', created_at: at(2) },
  ]
  assert.deepEqual(filterLog(rows).map((row) => row.agent), ['lead', 'qa', 'qa'])
  assert.deepEqual(filterLog(rows, 'qa').map((row) => row.created_at), [at(2), at(10)])
  assert.equal(lastLogAt(rows), at(1))
  assert.equal(lastLogAt([]), null)
})

test('ref 링크: 커밋 해시·https만', () => {
  assert.deepEqual(refLink('d2adaa0'), { href: 'https://github.com/leejongsoo91-create/LEE0011/commit/d2adaa0', label: 'd2adaa0' })
  assert.equal(refLink('https://claude.ai/artifact/x').label, '링크')
  assert.equal(refLink('javascript:alert(1)'), null)
  assert.equal(refLink(null), null)
})

test('업무 요약 띠', () => {
  const work = [
    { status: 'Todo', due_date: '2026-11-12' },
    { status: 'Todo' },
    { status: 'In Progress', due_date: '2026-11-12' },
    { status: 'Done', due_date: '2026-11-12' },
  ]
  const meetings = [{ created_at: at(60) }, { created_at: at(60 * 24 * 8) }]
  assert.deepEqual(workSummary(work, meetings, '2026-11-12', NOW), { todo: 2, doing: 1, dueToday: 2, recentMeetings: 1 })
})
