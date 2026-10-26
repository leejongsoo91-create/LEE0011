// 오케스트레이터: 지시 하나를 PLANNING → VALIDATING → PENDING(또는 자동 승인 → 실행)까지 끌고 간다.
// 상태 전환은 전부 tasks.transition()의 조건부 업데이트로만 한다. 단계를 건너뛰거나 두 번 실행할 수 없다.
//
//   지시 ─▶ PLANNING ─(계획 작성)─▶ VALIDATING ─(검증 실패)─▶ FAILED
//                                       │ 읽기만 → APPROVED(AUTO_APPROVED) → 실행
//                                       └ 쓰기 있음 → PENDING → (결재 버튼: approval.js)

import { executePlan } from './executor.js'
import { buildTestPlan, hashPlan } from './plan.js'
import { approvalButtons, approvalText, executionReport, interruptedText, validationFailedText } from './report.js'
import { loadRules, rulesStatus } from './rules.js'
import { sendMessage } from './telegram.js'
import { createTask, lastLogAt, listOpenTasks, transition } from './tasks.js'
import { validatePlan } from './validator.js'

export const APPROVAL_TTL_MS = 30 * 60 * 1000
export const REASON_TTL_MS = 30 * 60 * 1000
export const STALE_EXECUTION_MS = 2 * 60 * 1000
export const MAX_REJECTS = 3

// 새 지시 → 작업 만들기 → 계획·검증·결재 요청
export async function startInstruction({ text, chatId, updateId }, options) {
  let task
  try {
    task = await createTask({ query: text, sourceUpdateId: updateId, status: 'PLANNING', log: { event: 'CREATED' } })
  } catch (error) {
    console.error('[agents] 작업 생성 실패', error)
    await sendMessage(chatId, '⚠️ 작업을 저장하지 못했어요. 잠시 뒤에 다시 보내 주세요.')
    return 'error'
  }
  if (!task) return 'duplicate'
  return planAndRoute(task, chatId, options)
}

// PLANNING 상태 작업의 계획을 세우고 검증한 뒤, 결재 요청을 보내거나(쓰기) 바로 실행한다(읽기 전용).
export async function planAndRoute(task, chatId, { planner = buildTestPlan } = {}) {
  const rules = loadRules()
  const status = rulesStatus(rules)

  let plan
  try {
    plan = planner(task.task_query, { feedback: task.feedback ?? undefined, rules })
  } catch (error) {
    await transition(task, 'FAILED', { log: { event: 'PLAN_FAILED', note: error?.message } })
    await sendMessage(chatId, `🚫 계획을 만들지 못했어요\n지시: ${task.task_query}`)
    return 'plan-failed'
  }

  const validating = await transition(task, 'VALIDATING', {
    log: { event: 'PLANNED', steps: plan?.steps?.length ?? 0, rules: status },
    patch: { plan_payload: plan, plan_hash: hashPlan(plan) },
  })
  if (!validating) return 'already'

  const verdict = validatePlan(plan)
  if (!verdict.ok) {
    await transition(validating, 'FAILED', { log: { event: 'VALIDATION_FAILED', errors: verdict.errors } })
    await sendMessage(chatId, validationFailedText(task, verdict.errors))
    return 'invalid'
  }

  // 읽기 전용 → 결재 생략. 상태 머신은 그대로 밟고, 로그에 AUTO_APPROVED를 남긴다.
  if (!verdict.needsApproval) {
    const approved = await transition(validating, 'APPROVED', { log: { event: 'AUTO_APPROVED', note: '읽기 전용 계획' } })
    if (!approved) return 'already'
    return runApproved(approved, chatId, status)
  }

  const pending = await transition(validating, 'PENDING', {
    log: { event: 'VALIDATED' },
    patch: { expires_at: new Date(Date.now() + APPROVAL_TTL_MS).toISOString() },
  })
  if (!pending) return 'already'

  const sent = await sendMessage(chatId, approvalText(pending, status), approvalButtons(pending.id))
  if (!sent.ok) {
    // 버튼 없는 결재 대기 작업이 남지 않도록 닫는다.
    await transition(pending, 'FAILED', { log: { event: 'SEND_FAILED', note: '결재 메시지를 보내지 못함' } }).catch(() => null)
    return 'error'
  }
  return 'pending'
}

// APPROVED 작업을 실행하고 결과를 보고한다.
export async function runApproved(task, chatId, rules) {
  const outcome = await executePlan(task)
  await sendMessage(chatId, executionReport(outcome.task ?? task, outcome, rules))
  return outcome.status
}

// 크론 없이, 봇에 메시지가 올 때마다 남은 작업을 정리한다.
//   EXECUTING 2분 넘게 기록 없음 → FAILED(INTERRUPTED) + 알림 (자동 원복은 하지 않음)
//   PENDING 만료 → FAILED(EXPIRED) · REJECTED 사유 30분 무응답 → FAILED(REASON_TIMEOUT)
export async function sweepStale(chatId, now = Date.now()) {
  const rows = await listOpenTasks()
  const closed = []
  for (const task of rows) {
    if (task.status === 'EXECUTING' && now - lastLogAt(task) > STALE_EXECUTION_MS) {
      const failed = await transition(task, 'FAILED', { log: { event: 'INTERRUPTED', note: '실행이 2분 넘게 멈춰 있음' } })
      if (failed) {
        closed.push('interrupted')
        await sendMessage(chatId, interruptedText(failed))
      }
    } else if (task.status === 'PENDING' && task.expires_at && Date.parse(task.expires_at) <= now) {
      if (await transition(task, 'FAILED', { log: { event: 'EXPIRED', note: '결재 대기 시간(30분) 초과' } })) closed.push('expired')
    } else if (task.status === 'REJECTED' && now - lastLogAt(task) > REASON_TTL_MS) {
      if (await transition(task, 'FAILED', { log: { event: 'REASON_TIMEOUT', note: '반려 사유를 30분 동안 받지 못함' } })) {
        closed.push('reason-timeout')
      }
    }
  }
  return closed
}
