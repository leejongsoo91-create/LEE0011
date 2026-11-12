import test from 'node:test'
import assert from 'node:assert/strict'
import { dayLabel, groupByDay, isRowId, summaryToEditorBlocks, todoCounts, workLogEntries } from './workLog.js'

const meetings = [
  { id: 'm1', title: '아트센터 회의', recorded_at: '2026-11-11T08:42:00Z', created_at: '2026-11-11T09:00:00Z' },
  // 녹음 시각이 없으면 들어온 시각으로
  { id: 'm2', title: '시각 없는 회의', recorded_at: null, created_at: '2026-11-10T01:00:00Z' },
]
const work = [
  { id: 'w1', title: '가이드 작성', meeting_id: 'm1', status: 'Done', created_at: '2026-11-11T09:00:00Z' },
  { id: 'w2', title: '절차 합의', meeting_id: 'm1', status: 'Todo', created_at: '2026-11-11T09:00:00Z' },
  // 한국 시각으로는 11/11 00:30 (UTC로는 11/10)
  { id: 'w3', title: '직접 만든 업무', meeting_id: null, status: 'In Progress', created_at: '2026-11-10T15:30:00Z' },
]

test('할 일 수: 회의에 붙은 카드만, 완료 수 따로', () => {
  assert.deepEqual(todoCounts(work, 'm1'), { total: 2, done: 1 })
  assert.deepEqual(todoCounts(work, 'm2'), { total: 0, done: 0 })
  assert.deepEqual(todoCounts(null, 'm1'), { total: 0, done: 0 })
})

test('목록 항목: 회의 + 회의 없는 업무, 회의 카드는 따로 올리지 않는다', () => {
  const entries = workLogEntries(meetings, work)
  assert.deepEqual(
    entries.map((entry) => [entry.kind, entry.id, entry.at]),
    [
      ['meeting', 'm1', '2026-11-11T08:42:00Z'],
      ['meeting', 'm2', '2026-11-10T01:00:00Z'],
      ['task', 'w3', '2026-11-10T15:30:00Z'],
    ],
  )
  assert.deepEqual(entries[0].todos, { total: 2, done: 1 })
  assert.equal(entries[2].status, 'In Progress')
})

test('날짜별 묶기: 한국 날짜, 최신순, 시각 모름은 맨 아래', () => {
  const entries = [...workLogEntries(meetings, work), { kind: 'task', id: 'x', title: '시각 없음', at: null }]
  const groups = groupByDay(entries)
  assert.deepEqual(
    groups.map((group) => [group.day, group.label, group.items.map((item) => item.id)]),
    [
      ['2026-11-11', '11월 11일 (수)', ['m1', 'w3']],
      ['2026-11-10', '11월 10일 (화)', ['m2']],
      ['', '날짜 모름', ['x']],
    ],
  )
  assert.deepEqual(groupByDay([]), [])
})

test('날짜 이름과 id 모양 검사', () => {
  assert.equal(dayLabel('2026-11-15'), '11월 15일 (일)')
  assert.equal(isRowId('3f2b8c1e-0d4a-4b7e-9c1a-1234567890ab'), true)
  assert.equal(isRowId('없는id'), false)
  assert.equal(isRowId(undefined), false)
})

test('요약 Markdown → 에디터 블록', () => {
  const md = ['## 1. **촬영**', '설명', '- [ ] 할 일', '- [x] 끝남', '- 목록', '> 인용'].join('\n')
  assert.deepEqual(summaryToEditorBlocks(md), [
    { type: 'heading', props: { level: 2 }, content: '1. 촬영' },
    { type: 'paragraph', content: '설명' },
    { type: 'checkListItem', props: { checked: false }, content: '할 일' },
    { type: 'checkListItem', props: { checked: true }, content: '끝남' },
    { type: 'bulletListItem', content: '목록' },
    { type: 'quote', content: '인용' },
  ])
  assert.deepEqual(summaryToEditorBlocks(''), [])
})
