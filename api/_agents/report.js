// 텔레그램으로 보낼 문장 템플릿. (결재 요청·실행 결과·검증 실패·실행 중단)

import { describePlan } from './plan.js'
import { getTool } from './registry.js'

const MAX_QUERY_SHOWN = 300
const TEST_NOTE = '🧪 테스트 모드: 가짜 도구라 실제 데이터는 바뀌지 않습니다.'

const queryOf = (task) =>
  task.task_query.length > MAX_QUERY_SHOWN ? `${task.task_query.slice(0, MAX_QUERY_SHOWN)}…` : task.task_query

const labelOf = (tool) => getTool(tool)?.label ?? tool

export const kst = (iso) =>
  new Date(iso).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })

const rulesLine = (status) =>
  `📚 규칙서: 전사 공통 ${status?.global ? '✓' : '✗'} · 부서 템플릿 ${status?.deptTemplate ? '✓' : '✗'}`

export function approvalText(task, rules) {
  const lines = ['📝 [결재 요청]', `지시: ${queryOf(task)}`]
  if (task.reject_count > 0) lines.push(`🔁 재계획 ${task.reject_count}회차 · 반려 사유: ${task.feedback ?? '(없음)'}`)
  lines.push('', '계획:', describePlan(task.plan_payload), '', rulesLine(rules))
  lines.push(`⏰ ${kst(task.expires_at)}까지 결정해 주세요 (30분 뒤 만료)`, TEST_NOTE)
  return lines.join('\n')
}

export const approvalButtons = (id) => ({
  inline_keyboard: [[{ text: '✅ 승인', callback_data: `a:${id}` }, { text: '❌ 반려', callback_data: `r:${id}` }]],
})

const HEAD = {
  completed: '✅ 완료',
  'rolled-back': '↩️ 실패 → 원복 완료',
  'undo-failed': '🚨 실패 → 원복도 실패: 직접 확인이 필요해요',
  'hash-mismatch': '🚫 실행 거부: 승인 뒤 계획이 바뀌었습니다',
  already: 'ℹ️ 이미 실행 중이거나 끝난 작업이에요',
  aborted: '⚠️ 실행이 중간에 멈췄어요 (다른 요청이 작업을 정리함)',
}

export function executionReport(task, outcome, rules) {
  const lines = [HEAD[outcome.status] ?? `결과: ${outcome.status}`, `지시: ${queryOf(task)}`]
  if ((task.event_logs ?? []).some((entry) => entry.event === 'AUTO_APPROVED')) {
    lines.push('(읽기 전용 계획이라 결재 없이 실행했어요)')
    if (rules) lines.push(rulesLine(rules))
  }
  if (outcome.results?.length) {
    lines.push('', '실행한 단계:')
    outcome.results.forEach((r) => lines.push(`${r.step}. ${labelOf(r.tool)} — ${r.summary ?? '완료'}`))
  }
  if (outcome.failure) {
    lines.push('', `실패한 단계: ${outcome.failure.step}. ${labelOf(outcome.failure.tool)} — ${outcome.failure.message}`)
  }
  if (outcome.undo?.length) {
    lines.push('', '되돌린 단계 (역순):')
    outcome.undo.forEach((u) =>
      lines.push(`${u.step}. ${labelOf(u.tool)} — ${u.ok ? `원복 완료 (${u.summary ?? ''})` : `❗원복 실패: ${u.message}`}`),
    )
  } else if (outcome.failure) {
    lines.push('', '되돌릴 단계 없음 (먼저 성공한 쓰기가 없었어요)')
  }
  lines.push('', `상태: ${task.status}`, TEST_NOTE)
  return lines.join('\n')
}

export const validationFailedText = (task, errors) =>
  ['🚫 계획 검증 실패 — 결재 요청을 보내지 않았어요', `지시: ${queryOf(task)}`, '', ...errors.map((e) => `• ${e}`)].join('\n')

export function interruptedText(task) {
  const last = [...(task.event_logs ?? [])].reverse().find((entry) => entry.step)
  const where = last ? `마지막 기록: ${last.step}단계 ${last.event === 'STEP_DONE' ? '완료' : '시작'}` : '단계 기록 없음'
  return [
    '⚠️ 실행이 중간에 끊긴 작업을 정리했어요',
    `지시: ${queryOf(task)}`,
    where,
    '자동으로 되돌리지 않았어요. 어디까지 실행됐는지 확인해 주세요.',
  ].join('\n')
}

export const REASON_PROMPT =
  '✍️ 반려 사유를 이 메시지에 "답장"으로 적어 주세요.\n사유를 반영해 다시 계획합니다. "취소"라고 답하면 작업을 끝냅니다.'
