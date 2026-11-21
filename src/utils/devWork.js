// 중앙관제 개발 창 "작업 정리" 탭의 계산 (보고서 12 2단계). 화면·네트워크와 상관없는 순수 함수다.
// 날짜는 모두 한국 날짜 'YYYY-MM-DD'. 주는 월요일에 시작한다.
import { addDays, kstDate } from './controlTime.js'
import { KIND_LABEL } from './teamStatus.js'

export const PERIODS = [
  { id: 'week', name: '주간' },
  { id: 'month', name: '월간' },
  { id: 'year', name: '연간' },
]
export const AGENT_FILTERS = [
  { id: 'all', name: '전체' },
  { id: 'lead', name: '개발' },
  { id: 'review', name: '검토' },
  { id: 'qa', name: '테스트' },
  { id: 'devops', name: '운영' },
]
// 분야 표시 이름 (저장값은 그대로). '에이전트'는 서버 코드 전체를 뜻해서 '서버·에이전트'로 보여 준다
export const AREA_LABEL = { 에이전트: '서버·에이전트' }
export const areaLabel = (area) => AREA_LABEL[area] ?? area
// 작업이 거치는 단계 순서 (진행 줄과 "지금 단계"에 쓴다)
export const STEPS = ['plan', 'edit', 'test', 'review', 'commit', 'deploy', 'check']
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const REPO = 'https://github.com/leejongsoo91-create/LEE0011'

// 주소 값 검사: 모르는 값이면 기본값
export const parsePeriod = (value) => (PERIODS.some((period) => period.id === value) ? value : 'week')
export const parseAgent = (value) => (AGENT_FILTERS.some((agent) => agent.id === value) ? value : 'all')
// 날짜는 실제로 있는 날만 (2026-02-30처럼 넘치는 날은 오늘로)
export function parseAnchor(value, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return today
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : today
}

const weekday = (ymd) => new Date(`${ymd}T00:00:00Z`).getUTCDay()
// 그 날이 든 주의 월요일
export const mondayOf = (ymd) => addDays(ymd, -((weekday(ymd) + 6) % 7))
const lastDayOfMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate()
const pad = (n) => String(n).padStart(2, '0')
const md = (ymd) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`

// 기간: { from, to (둘 다 포함), label, prev, next (옆 기간 안의 아무 날) }
export function periodRange(kind, anchor) {
  const [y, m] = anchor.split('-').map(Number)
  if (kind === 'year') {
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}년`, prev: `${y - 1}-01-01`, next: `${y + 1}-01-01` }
  }
  if (kind === 'month') {
    const from = `${y}-${pad(m)}-01`
    const to = `${y}-${pad(m)}-${pad(lastDayOfMonth(y, m))}`
    return { from, to, label: `${y}년 ${m}월`, prev: addDays(from, -1), next: addDays(to, 1) }
  }
  const from = mondayOf(anchor)
  const to = addDays(from, 6)
  return { from, to, label: `${md(from)}(월) ~ ${md(to)}(일)`, prev: addDays(from, -7), next: addDays(from, 7) }
}

// 기간의 시작·끝을 DB 조회용 시각으로 (끝은 다음 날 0시 전까지)
export const rangeToTimes = ({ from, to }) => ({ start: `${from}T00:00:00+09:00`, end: `${addDays(to, 1)}T00:00:00+09:00` })

// 작업이 속한 날: 시작 시각의 한국 날짜
export const workDay = (work) => kstDate(new Date(work.started_at))

// 기간 안 작업을 묶는다 (최신 묶음이 위, 묶음 안도 최신순).
//   주간: 날짜별 "11월 20일 (금)" · 월간: 주별 "11/16 ~ 11/22" · 연간: 달별 "11월" (key = 그 달 1일, 누르면 월간으로)
//   withYear: 연도가 섞이는 검색 결과는 달 이름에 연도를 붙인다 ("2026년 11월")
export function groupWorks(works, kind, { withYear = false } = {}) {
  const groups = new Map()
  const sorted = [...(works ?? [])].sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))
  for (const work of sorted) {
    const day = workDay(work)
    let key
    let label
    if (kind === 'year') {
      key = `${day.slice(0, 7)}-01`
      label = `${withYear ? `${day.slice(0, 4)}년 ` : ''}${Number(day.slice(5, 7))}월`
    } else if (kind === 'month') {
      key = mondayOf(day)
      label = `${md(key)} ~ ${md(addDays(key, 6))}`
    } else {
      key = day
      label = `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일 (${WEEKDAYS[weekday(day)]})`
    }
    if (!groups.has(key)) groups.set(key, { key, label, items: [] })
    groups.get(key).items.push(work)
  }
  return [...groups.values()]
}

// 역할 거르기: 개발은 모든 작업, 검토·테스트·운영은 그 역할의 기록이 있는 작업만 (logs = 작업들의 한 줄 기록)
export function filterByAgent(works, logs, agent) {
  if (agent === 'all' || agent === 'lead') return works ?? []
  const keys = new Set((logs ?? []).filter((row) => row.agent === agent && row.work_key).map((row) => row.work_key))
  return (works ?? []).filter((work) => keys.has(work.work_key))
}

// 작업의 진행 줄: 단계별 가장 최근 기록 (STEPS 순서, 기록 없는 단계는 뺀다)
export function stepLine(logs) {
  const latest = new Map()
  for (const row of [...(logs ?? [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) latest.set(row.kind, row)
  return STEPS.filter((kind) => latest.has(kind)).map((kind) => latest.get(kind))
}

// 지금 단계 한 줄: 완료·되돌림이면 그대로, 진행 중이면 마지막 기록 "검토 통과" 등
export function currentStep(work, logs) {
  if (work.status !== '진행 중') return work.status
  const last = [...(logs ?? [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
  if (!last) return '진행 중'
  const result = { pass: '통과', fail: '실패', running: '진행 중', info: '기록' }[last.status] ?? ''
  return `${KIND_LABEL[last.kind] ?? last.kind} ${result}`.trim()
}

// 바꾼 내용 글 → 줄 목록 ('- ' 떼고 빈 줄 빼고)
export const changeLines = (text) =>
  String(text ?? '')
    .split('\n')
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean)

// 파일 목록 합계
export const fileTotals = (files) =>
  (files ?? []).reduce((sum, file) => ({ added: sum.added + file.added, removed: sum.removed + file.removed }), { added: 0, removed: 0 })

// GitHub 링크 (커밋 해시 모양일 때만)
export const commitUrl = (hash) => (/^[0-9a-f]{7,40}$/.test(hash ?? '') ? `${REPO}/commit/${hash}` : null)
export const fileUrl = (hash, path) => (commitUrl(hash) && path ? `${REPO}/blob/${hash}/${path}` : null)

// 검색어 정리: DB 조회식(or=…)을 깨는 글자를 빼고 앞뒤 공백 정리, 40자까지
export const cleanQuery = (value) =>
  String(value ?? '')
    .replace(/[,()*%\\:."'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)

// 데이터 관리 탭 기간: 이번 주 · 이번 달 · 올해 · 전체 → { start, end } (전체면 빈 값)
export const DATA_PERIODS = [
  { id: 'week', name: '이번 주' },
  { id: 'month', name: '이번 달' },
  { id: 'year', name: '올해' },
  { id: 'all', name: '전체' },
]
export const dataRange = (id, today) => (id === 'all' ? {} : rangeToTimes(periodRange(id, today)))

// 오류 이름 → 화면 문구
export const ADMIN_ERROR = {
  'login-required': '다시 로그인해 주세요',
  forbidden: '권한이 없어요',
  'no-work': '그 작업 번호가 없어요',
  'work-hidden': '숨긴 작업이에요. "숨긴 것 보기"에서 되살린 뒤 해 주세요',
  'bad-request': '입력 값을 확인해 주세요',
  'bad-work-key': '작업 번호 모양이 달라요 (예: 보고서12-3, 수정-20261120-1)',
  'bad-areas': '분야를 확인해 주세요',
  'bad-status': '상태를 확인해 주세요',
  'bad-report-url': '보고서 주소는 https://claude.ai/ 로 시작해야 해요',
  'looks-secret': '비밀 값처럼 보이는 글자가 있어 저장하지 않았어요',
}

// CSV 한 칸: 따옴표로 감싸고, 엑셀이 수식으로 읽는 글자(= + - @)로 시작하면 앞에 ' 를 붙인다
export function csvCell(value) {
  let text = Array.isArray(value) ? value.join('·') : value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

// 줄 목록 → CSV 글 (엑셀이 한글을 읽도록 맨 앞에 BOM)
export function toCsv(columns, rows) {
  const head = columns.map((column) => csvCell(column.label)).join(',')
  const body = rows.map((row) => columns.map((column) => csvCell(row[column.key])).join(','))
  return `﻿${[head, ...body].join('\r\n')}\r\n`
}
