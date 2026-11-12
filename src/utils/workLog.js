// 업무 탭 "업무 기록" 목록과 상세 화면의 계산. 화면·네트워크와 상관없는 순수 함수다.
import { kstDate } from './controlTime.js'
import { summaryBlocks } from './meetingSummary.js'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export const STATUS_LABEL = { Todo: '할 일', 'In Progress': '진행 중', Done: '완료' }
export const STATUS_PROGRESS = { Todo: 0, 'In Progress': 50, Done: 100 }

// 상세 주소(/work/<id>)의 id 모양 검사. 모양이 틀리면 DB에 묻지 않고 "찾을 수 없음"으로 보여 준다.
export const isRowId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id ?? '')

// 회의에서 나온 할 일 수와 끝낸 수
export function todoCounts(work, meetingId) {
  const todos = (work ?? []).filter((row) => row.meeting_id === meetingId)
  return { total: todos.length, done: todos.filter((row) => row.status === 'Done').length }
}

// 목록에 올릴 항목: 회의 기록(녹음 시각, 없으면 들어온 시각) + 회의 없이 직접 만든 업무(만든 시각)
export function workLogEntries(meetings, work) {
  const fromMeetings = (meetings ?? []).map((meeting) => ({
    kind: 'meeting',
    id: meeting.id,
    title: meeting.title,
    at: meeting.recorded_at ?? meeting.created_at,
    todos: todoCounts(work, meeting.id),
  }))
  const tasks = (work ?? [])
    .filter((row) => !row.meeting_id)
    .map((row) => ({ kind: 'task', id: row.id, title: row.title, at: row.created_at, status: row.status }))
  return [...fromMeetings, ...tasks]
}

// "2026-11-11" → "11월 11일 (수)"
export function dayLabel(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${m}월 ${d}일 (${weekday})`
}

// 한국 날짜별로 묶는다. 날짜도, 날짜 안의 항목도 최신순. 시각을 모르면 맨 아래 "날짜 모름"에 둔다.
export function groupByDay(entries) {
  const groups = new Map()
  const sorted = [...entries].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0))
  for (const entry of sorted) {
    const ms = Date.parse(entry.at ?? '')
    const day = Number.isNaN(ms) ? '' : kstDate(new Date(ms))
    if (!groups.has(day)) groups.set(day, [])
    groups.get(day).push(entry)
  }
  return [...groups].map(([day, items]) => ({ day, label: day ? dayLabel(day) : '날짜 모름', items }))
}

// Plaud 요약 Markdown → 블록 에디터가 처음 열 때 쓸 블록. (처음 고칠 때 content로 저장되고, 원본은 그대로 남는다)
// 요약 속 "- [ ]" 줄은 체크 목록 블록이 되지만, 할 일 카드와는 따로다.
export function summaryToEditorBlocks(markdown) {
  return summaryBlocks(markdown).map((block) => {
    if (block.type === 'heading') return { type: 'heading', props: { level: block.level }, content: block.text }
    if (block.type === 'todo') return { type: 'checkListItem', props: { checked: block.done }, content: block.text }
    if (block.type === 'item') return { type: 'bulletListItem', content: block.text }
    if (block.type === 'quote') return { type: 'quote', content: block.text }
    return { type: 'paragraph', content: block.text }
  })
}
