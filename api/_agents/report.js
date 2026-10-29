// 텔레그램으로 보낼 문장 템플릿. (결재 요청·실행 결과·검증 실패·실행 중단)

import { describePlan } from './plan.js'
import { friendlyReason } from './errors.js'
import { deptName, getTool } from './registry.js'

const MAX_QUERY_SHOWN = 300
const TEST_NOTE = '🧪 테스트 도구만 쓰는 계획이라 실제 데이터는 바뀌지 않습니다.'
const REAL_NOTE = '⚠️ 실제 대시보드 데이터가 바뀝니다. (실패하면 역순으로 원복)'

// 계획이 실제 데이터를 건드리는지(테스트 팀 도구만 있는지)
const onlyTestTools = (plan) => (plan?.steps ?? []).every((step) => getTool(step.tool)?.dept === 'test')
// 누가 계획했는지 (메인 에이전트 프로그램)
const plannerLine = (plan) =>
  plan?.main?.program === 'anthropic'
    ? `🤖 메인: Anthropic (${plan.main.model})`
    : plan?.main?.program === 'test' || plan?.testMode
      ? '🧪 메인: 테스트 계획 작성기 (AI 아님)'
      : `🤖 메인: ${plan?.main?.program ?? '알 수 없음'}`

// 크로스체크와의 상의 결과
function crosscheckLine(plan) {
  const review = plan?.review
  if (!review || review.verdict === 'off') return '🔍 크로스체크: 코드 검사만 (크로스체크 에이전트 꺼짐)'
  const rounds = review.rounds > 0 ? `상의 ${review.rounds}회` : '바로'
  const comments = review.comments?.length ? `: ${review.comments.join(' / ')}` : ''
  if (review.verdict === 'agreed') return `🔍 크로스체크: 동의 (${rounds})`
  if (review.verdict === 'unresolved') return `⚠️ 크로스체크 이견 (상의 ${review.rounds}회 후에도)${comments}`
  if (review.verdict === 'timeout') return `⏱️ 시간 부족으로 상의 중단 (상의 ${review.rounds}회)${comments}`
  return `⚠️ 크로스체크 에이전트 오류${comments}`
}

// 맡는 부서
const deptsLine = (plan) => {
  const ids = [...new Set((plan?.steps ?? []).map((step) => getTool(step.tool)?.dept).filter(Boolean))]
  return ids.length ? `👥 맡는 부서: ${ids.map(deptName).join(', ')}` : null
}

const queryOf = (task) =>
  task.task_query.length > MAX_QUERY_SHOWN ? `${task.task_query.slice(0, MAX_QUERY_SHOWN)}…` : task.task_query

const labelOf = (tool) => getTool(tool)?.label ?? tool

export const kst = (iso) =>
  new Date(iso).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })

const mark = (ok) => (ok ? '✓' : '✗')
const rulesLine = (status) =>
  [
    `📚 규칙서: 전사 공통 ${mark(status?.global)}`,
    ...Object.entries(status?.depts ?? {}).map(([id, ok]) => `${deptName(id)} ${mark(ok)}`),
    `부서 템플릿 ${mark(status?.deptTemplate)}`,
  ].join(' · ')

export function approvalText(task, rules) {
  const lines = ['📝 [결재 요청]', `지시: ${queryOf(task)}`]
  if (task.reject_count > 0) lines.push(`🔁 재계획 ${task.reject_count}회차 · 반려 사유: ${task.feedback ?? '(없음)'}`)
  if (task.plan_payload?.summary) lines.push(`요약: ${task.plan_payload.summary}`)
  lines.push('', '계획:', describePlan(task.plan_payload), '')
  lines.push(...[deptsLine(task.plan_payload), plannerLine(task.plan_payload), crosscheckLine(task.plan_payload)].filter(Boolean))
  if (rules) lines.push(rulesLine(rules))
  lines.push(`⏰ ${kst(task.expires_at)}까지 결정해 주세요 (30분 뒤 만료)`)
  lines.push(onlyTestTools(task.plan_payload) ? TEST_NOTE : REAL_NOTE)
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
    lines.push(...[deptsLine(task.plan_payload), plannerLine(task.plan_payload), crosscheckLine(task.plan_payload)].filter(Boolean))
    if (rules) lines.push(rulesLine(rules))
  }
  if (outcome.results?.length) {
    lines.push('', '실행한 단계:')
    outcome.results.forEach((r) => lines.push(`${r.step}. ${labelOf(r.tool)} — ${r.summary ?? '완료'}`))
  }
  if (outcome.failure) {
    lines.push('', `실패한 단계: ${outcome.failure.step}. ${labelOf(outcome.failure.tool)} — ${friendlyReason(outcome.failure)}`)
    if (outcome.failure.uncertain) {
      const what = outcome.failure.detail ? ` (${outcome.failure.detail})` : ''
      lines.push(`⚠️ 확인 필요: ${outcome.failure.step}. ${labelOf(outcome.failure.tool)}${what} — 저장됐는지 알 수 없어요. 대시보드에서 확인해 주세요`)
    }
  }
  if (outcome.undo?.length) {
    lines.push('', '되돌린 단계 (역순):')
    outcome.undo.forEach((u) =>
      lines.push(`${u.step}. ${labelOf(u.tool)} — ${u.ok ? `원복 완료 (${u.summary ?? ''})` : `❗원복 실패: ${u.message}`}`),
    )
  } else if (outcome.failure) {
    lines.push('', '되돌릴 단계 없음 (먼저 성공한 쓰기가 없었어요)')
  }
  lines.push('', `상태: ${task.status}`)
  if (onlyTestTools(task.plan_payload)) lines.push(TEST_NOTE)
  return lines.join('\n')
}

export const errorText = (reason, { executing = false } = {}) =>
  [
    '⚠️ 처리 중 문제가 생겼어요',
    `원인: ${reason}`,
    ...(executing ? ['실행이 중간에 멈췄을 수 있어요. 2분 뒤 자동으로 정리되니, 대시보드에서 결과를 확인해 주세요.'] : []),
  ].join('\n')

export const clarificationText = (task, question) =>
  ['❓ 계획을 세우기 전에 확인이 필요해요', `지시: ${queryOf(task)}`, '', question, '', '내용을 보태서 지시를 다시 보내 주세요.'].join('\n')

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

// 계획을 세우다 멈춘 작업 (함수가 시간 한도로 끊긴 경우 등)
export const stalledText = (task) =>
  [
    '⚠️ 계획을 세우다 멈춘 작업을 정리했어요',
    `지시: ${queryOf(task)}`,
    '실행된 것은 없어요. 필요하면 지시를 다시 보내 주세요.',
  ].join('\n')

export const REASON_PROMPT =
  '✍️ 반려 사유를 이 메시지에 "답장"으로 적어 주세요.\n사유를 반영해 다시 계획합니다. "취소"라고 답하면 작업을 끝냅니다.'
