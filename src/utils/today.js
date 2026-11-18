// 홈 "오늘" 칸과 업무 상자의 계산 (보고서 11). 날짜는 모두 한국 날짜 'YYYY-MM-DD' 문자열로 비교한다.
import { addDays } from './controlTime.js'

const DAY_MS = 24 * 60 * 60 * 1000

// 두 날짜(YYYY-MM-DD) 사이 일수. later가 더 늦으면 양수.
export function daysBetween(earlier, later) {
  return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / DAY_MS)
}

// 시간 순(시간 없는 일정은 맨 뒤), 같으면 제목 순
const byTime = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || (a.title ?? '').localeCompare(b.title ?? '')

// 오늘 일정, 시간 순
export function todaySchedule(rows, today) {
  return (rows ?? []).filter((row) => row.date === today).sort(byTime)
}

// 오늘부터 7일 안(오늘 포함)의 일정 수. 달력의 '이번 주'(월~일)가 아니다.
export function weekScheduleCount(rows, today) {
  const end = addDays(today, 6)
  return (rows ?? []).filter((row) => row.date >= today && row.date <= end).length
}

// 마감 가까운 순(마감 없는 것은 뒤), 같으면 최근에 만든 것 먼저
function byDue(a, b) {
  if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date)
  if (Boolean(a.due_date) !== Boolean(b.due_date)) return a.due_date ? -1 : 1
  return (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0)
}

// 끝나지 않은 업무, 마감 가까운 순
export function openWork(rows) {
  return (rows ?? []).filter((row) => row.status !== 'Done').sort(byDue)
}

// 오늘 마감이거나 마감이 지난 미완료 업무. overdue = 지난 일수 (오늘 마감이면 0)
export function dueWork(rows, today) {
  return openWork(rows)
    .filter((row) => row.due_date && row.due_date <= today)
    .map((row) => ({ ...row, overdue: daysBetween(row.due_date, today) }))
}

// 마감 표시: 'N일 지남' · '오늘 마감' · 'MM-DD 마감' · ''
export function dueLabel(dueDate, today) {
  if (!dueDate) return ''
  const diff = daysBetween(dueDate, today)
  if (diff > 0) return `${diff}일 지남`
  if (diff === 0) return '오늘 마감'
  return `${dueDate.slice(5)} 마감`
}

// 홈 상자 순서. 저장된 값이 [[...], [...]] 모양이고 기본 상자를 빠짐없이 한 번씩 담고 있을 때만 쓴다.
export function parseWidgetOrder(raw, defaults) {
  try {
    const value = JSON.parse(raw)
    const want = defaults.flat().sort().join()
    const ok =
      Array.isArray(value) &&
      value.length === defaults.length &&
      value.every((column) => Array.isArray(column) && column.every((name) => typeof name === 'string')) &&
      value.flat().sort().join() === want
    return ok ? value : defaults
  } catch {
    return defaults
  }
}
