import test from 'node:test'
import assert from 'node:assert/strict'
import { daysBetween, dueLabel, dueWork, openWork, parseWidgetOrder, todaySchedule, weekScheduleCount } from './today.js'

const TODAY = '2026-11-18'

test('일수 계산: 달·해 넘김 포함', () => {
  assert.equal(daysBetween('2026-11-18', '2026-11-18'), 0)
  assert.equal(daysBetween('2026-11-15', '2026-11-18'), 3)
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1)
  assert.equal(daysBetween('2026-11-20', '2026-11-18'), -2)
})

test('오늘 일정: 오늘 것만, 시간 순, 시간 없는 것은 뒤', () => {
  const rows = [
    { id: 'a', date: TODAY, time: '15:00', title: '회의' },
    { id: 'b', date: TODAY, time: null, title: '하루 종일' },
    { id: 'e', date: TODAY, time: '', title: '빈 시간' },
    { id: 'f', date: TODAY, time: '12:00:00', title: '초까지' },
    { id: 'c', date: TODAY, time: '09:30', title: '출근' },
    { id: 'd', date: '2026-11-19', time: '08:00', title: '내일' },
  ]
  assert.deepEqual(todaySchedule(rows, TODAY).map((r) => r.id), ['c', 'f', 'a', 'e', 'b'])
  assert.deepEqual(todaySchedule(null, TODAY), [])
})

test('7일 안 일정 수: 오늘부터 7일', () => {
  const rows = ['2026-11-17', '2026-11-18', '2026-11-24', '2026-11-25'].map((date) => ({ date }))
  assert.equal(weekScheduleCount(rows, TODAY), 2)
})

const work = [
  { id: 'done', status: 'Done', due_date: '2026-11-10', created_at: '2026-11-01T00:00:00Z' },
  { id: 'nodue-old', status: 'Todo', due_date: null, created_at: '2026-11-01T00:00:00Z' },
  { id: 'nodue-new', status: 'Todo', due_date: null, created_at: '2026-11-05T00:00:00Z' },
  { id: 'late', status: 'In Progress', due_date: '2026-11-15', created_at: '2026-11-02T00:00:00Z' },
  { id: 'today', status: 'Todo', due_date: TODAY, created_at: '2026-11-03T00:00:00Z' },
  { id: 'later', status: 'Todo', due_date: '2026-11-30', created_at: '2026-11-04T00:00:00Z' },
]

test('미완료 업무: 완료 제외, 마감 가까운 순, 마감 없는 것은 최근 것부터 뒤에', () => {
  assert.deepEqual(openWork(work).map((r) => r.id), ['late', 'today', 'later', 'nodue-new', 'nodue-old'])
})

test('마감 업무: 오늘 마감과 지난 마감만, 지난 일수', () => {
  assert.deepEqual(
    dueWork(work, TODAY).map((r) => [r.id, r.overdue]),
    [
      ['late', 3],
      ['today', 0],
    ],
  )
})

test('마감 표시', () => {
  assert.equal(dueLabel('2026-11-15', TODAY), '3일 지남')
  assert.equal(dueLabel(TODAY, TODAY), '오늘 마감')
  assert.equal(dueLabel('2026-11-30', TODAY), '11-30 마감')
  assert.equal(dueLabel(null, TODAY), '')
})

test('상자 순서: 올바른 저장값만 쓰고 이상하면 기본값', () => {
  const defaults = [
    ['Schedule', 'Hobbies'],
    ['Work', 'Investments'],
  ]
  const saved = [['Work', 'Schedule'], ['Hobbies', 'Investments']]
  assert.deepEqual(parseWidgetOrder(JSON.stringify(saved), defaults), saved)
  assert.deepEqual(parseWidgetOrder(JSON.stringify([['Work', 'Schedule', 'Hobbies', 'Investments'], []]), defaults), [
    ['Work', 'Schedule', 'Hobbies', 'Investments'],
    [],
  ])
  for (const bad of [null, '', '{', '[]', JSON.stringify([['Work'], ['Hobbies']]), JSON.stringify([['Work', 'Work'], ['Hobbies', 'Investments']]), JSON.stringify([['Work', 'Old'], ['Schedule', 'Hobbies', 'Investments']]), JSON.stringify([[1, 2], [3, 4]])]) {
    assert.deepEqual(parseWidgetOrder(bad, defaults), defaults, `잘못된 값: ${bad}`)
  }
})
