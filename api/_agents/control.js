// 중앙관제 화면용 에이전트 작업 요약. (/api/control-summary 가 쓴다)
// agent_tasks는 서버 전용 표라서 브라우저에 그대로 내려주지 않는다.
// 숫자와 짧은 목록만 만들고, 계획 원문(plan_payload)·인자·로그 전체는 담지 않는다.

import { rest } from './supabase.js'

const DAY_MS = 24 * 60 * 60 * 1000
export const WINDOW_DAYS = 7
const RECENT_LIMIT = 10
const QUERY_MAX = 60

const RUNNING = new Set(['PLANNING', 'VALIDATING', 'APPROVED', 'EXECUTING'])

// 확인이 필요한 이유 (로그의 event 이름 → 화면 문구)
const ATTENTION_REASONS = {
  INTERRUPTED: '실행이 중간에 멈춤',
  STALLED: '계획 단계에서 멈춤',
  STEP_UNCERTAIN: '저장됐는지 확인 필요',
}

// 한국 시간 기준 오늘 0시(UTC 밀리초)
export function kstDayStart(now = Date.now()) {
  const ymd = new Date(now).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  return Date.parse(`${ymd}T00:00:00+09:00`)
}

const shortText = (text, max) => {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim()
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

const deptsOf = (task) => {
  const steps = Array.isArray(task.plan_payload?.steps) ? task.plan_payload.steps : []
  return [...new Set(steps.map((step) => step?.dept).filter((dept) => typeof dept === 'string'))]
}

const lastAt = (task) => task.event_logs?.at?.(-1)?.at ?? task.updated_at ?? task.created_at

// 확인이 필요한 작업이면 이유 문구, 아니면 null
export function attentionReason(task) {
  const events = (task.event_logs ?? []).map((entry) => entry?.event)
  if (events.includes('STEP_UNCERTAIN')) return ATTENTION_REASONS.STEP_UNCERTAIN
  if (task.status !== 'FAILED') return null
  // Plaud 녹음을 캡틴이 반려해 버린 것은 실패가 아니라 결정이다
  if (events.includes('DISCARDED')) return null
  if (events.includes('INTERRUPTED')) return ATTENTION_REASONS.INTERRUPTED
  if (events.includes('STALLED')) return ATTENTION_REASONS.STALLED
  return '실패'
}

// 작업이 어느 영역 카드에 속하나: 일정 자동 작업 → schedule, 투자 부서 단계 → invest, 그 밖 → agent
const areaOf = (task, depts) => {
  if (String(task.source_key ?? '').startsWith('schedule:')) return 'schedule'
  if (depts.includes('invest')) return 'invest'
  return 'agent'
}

// 작업 목록 → 화면용 요약 (DB 없이 테스트할 수 있게 순수 함수로 둔다)
export function summarizeTasks(tasks, now = Date.now()) {
  const todayStart = kstDayStart(now)
  const isToday = (iso) => Date.parse(iso) >= todayStart

  const agent = { running: 0, waiting: 0, doneToday: 0, attention: 0 }
  const schedule = { waiting: 0, attention: 0 }
  const invest = { lookupsToday: 0, failedToday: 0 }
  const attention = []
  let updatedAt = null

  const sorted = [...tasks].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  for (const task of sorted) {
    const depts = deptsOf(task)
    const area = areaOf(task, depts)
    const at = lastAt(task)
    if (at && (!updatedAt || Date.parse(at) > Date.parse(updatedAt))) updatedAt = at

    if (RUNNING.has(task.status)) agent.running += 1
    if (task.status === 'PENDING') agent.waiting += 1
    if (task.status === 'COMPLETED' && isToday(at)) agent.doneToday += 1

    if (area === 'schedule' && task.status === 'PENDING') schedule.waiting += 1
    if (depts.includes('invest') && isToday(task.created_at)) {
      invest.lookupsToday += 1
      if (task.status === 'FAILED') invest.failedToday += 1
    }

    const reason = attentionReason(task)
    if (reason) {
      agent.attention += 1
      if (area === 'schedule') schedule.attention += 1
      attention.push({ id: task.id.slice(0, 8), area, reason, query: shortText(task.task_query, QUERY_MAX), status: task.status, at })
    }
  }

  const recent = sorted.slice(0, RECENT_LIMIT).map((task) => ({
    id: task.id.slice(0, 8),
    query: shortText(task.task_query, QUERY_MAX),
    status: task.status,
    depts: deptsOf(task),
    auto: String(task.source_key ?? '').startsWith('schedule:'),
    flagged: attentionReason(task) !== null,
    at: lastAt(task),
  }))

  return { windowDays: WINDOW_DAYS, updatedAt, agent, schedule, invest, attention, recent }
}

// 최근 7일 작업을 읽어 요약한다. (서비스 롤 키로 읽으므로, 부르는 쪽에서 주인 확인을 먼저 끝낸다)
export async function loadControlSummary(now = Date.now()) {
  const since = new Date(now - WINDOW_DAYS * DAY_MS).toISOString()
  const columns = 'id,task_query,status,plan_payload,event_logs,source_key,created_at,updated_at'
  const rows = (await rest(`agent_tasks?select=${columns}&created_at=gte.${since}&order=created_at.desc&limit=300`)) ?? []
  return summarizeTasks(rows, now)
}
