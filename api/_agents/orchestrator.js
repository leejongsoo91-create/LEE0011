// 오케스트레이터: 지시 하나를 PLANNING → VALIDATING → PENDING(또는 자동 승인 → 실행)까지 끌고 간다.
// 상태 전환은 전부 tasks.transition()의 조건부 업데이트로만 한다. 단계를 건너뛰거나 두 번 실행할 수 없다.
//
//   지시 ─▶ PLANNING ─(메인: 계획)─▶ VALIDATING ─(코드 검사 실패)─▶ FAILED
//                                       │  ↻ 상의: 크로스체크 이의 → 메인이 고침 (최대 2회, 시간 예산 안에서)
//                                       │ 읽기만 + 이견 없음 → APPROVED(AUTO_APPROVED) → 실행
//                                       └ 쓰기 있음 / 이견 남음 → PENDING → (결재 버튼: approval.js)
//
// event_logs의 모든 기록에 agent(누가)를 남긴다: intake · orchestrator · main · crosscheck · executor · captain

import { CONSULT_MAX_ROUNDS, MIN_CALL_MS, SEND_RESERVE_MS, planningBudgetMs, roleConfig } from './agents.config.js'
import { crosscheckProgram, normalizeOpinion } from './crosscheck.js'
import { friendlyReason } from './errors.js'
import { executePlan } from './executor.js'
import { hashPlan } from './plan.js'
import { mainProgram } from './planner.js'
import { approvalButtons, approvalText, clarificationText, scheduleHeader, executionReport, interruptedText, stalledText, validationFailedText } from './report.js'
import { loadRules, rulesStatus } from './rules.js'
import { sendMessage } from './telegram.js'
import { appendLog, createTask, lastLogAt, listOpenTasks, transition } from './tasks.js'
import { validatePlan } from './validator.js'

export const APPROVAL_TTL_MS = 30 * 60 * 1000
export const REASON_TTL_MS = 30 * 60 * 1000
export const STALE_EXECUTION_MS = 2 * 60 * 1000
// 계획 단계(PLANNING·VALIDATING)는 정상이면 60초 안에 끝난다. 5분 넘게 기록이 없으면 함수가 중간에 끊긴 것으로 본다.
export const STALE_PLANNING_MS = 5 * 60 * 1000
export const MAX_REJECTS = 3

// 새 지시 → 작업 만들기 → 계획·검증·결재 요청
export async function startInstruction({ text, chatId, updateId }, options) {
  let task
  try {
    task = await createTask({ query: text, sourceUpdateId: updateId, status: 'PLANNING', log: { agent: 'intake', event: 'CREATED' } })
  } catch (error) {
    console.error('[agents] 작업 생성 실패', error)
    await sendMessage(chatId, `⚠️ 작업을 저장하지 못했어요. 잠시 뒤에 다시 보내 주세요.\n원인: ${friendlyReason(error)}`)
    return 'error'
  }
  if (!task) return 'duplicate'
  return planAndRoute(task, chatId, options)
}

const stepCount = (plan) => plan?.steps?.length ?? 0

// 프로그램이 돌려준 사용량(토큰)을 떼어 낸다. 사용량은 계획이 아니라 event_logs에 남긴다.
function takeUsage(result) {
  if (!result || typeof result !== 'object') return { result, usage: {} }
  const { usage, ...rest } = result
  return { result: rest, usage: usage ? { usage } : {} }
}

// PLANNING 상태 작업: 메인이 계획 → 코드 검사 → 크로스체크와 상의 → 결재 요청(쓰기·이견) 또는 바로 실행(읽기 전용).
// planner·reviewer·clock은 테스트에서 바꿔 끼울 수 있다.
export async function planAndRoute(task, chatId, { planner, reviewer, clock = Date.now } = {}) {
  const rules = loadRules()
  const status = rulesStatus(rules)
  const mainCfg = roleConfig('main')
  const checkCfg = roleConfig('crosscheck')
  // 설정된 프로그램 이름이 등록돼 있는지 먼저 확인 (틀렸으면 작업이 PLANNING에 멈추지 않게 닫는다)
  let callMain
  let callReview
  try {
    callMain = planner ?? mainProgram(mainCfg.program)
    callReview = reviewer === undefined ? crosscheckProgram(checkCfg.program) : reviewer
  } catch (error) {
    await transition(task, 'FAILED', { log: { agent: 'orchestrator', event: 'CONFIG_ERROR', note: error.message } })
    await sendMessage(chatId, `⚙️ 에이전트 설정 오류: ${error.message}\nVercel 환경변수(AGENT_PROGRAM_…)를 확인해 주세요.`)
    return 'config-error'
  }
  const deadline = clock() + planningBudgetMs()
  // 이 역할에게 줄 수 있는 시간 (결재 메시지 보낼 시간은 남겨 둔다)
  const timeFor = (cfg) => Math.min(cfg.timeoutMs, deadline - clock() - SEND_RESERVE_MS)
  const mainOptions = (extra) => ({
    feedback: task.feedback ?? undefined,
    rules,
    model: mainCfg.model,
    timeoutMs: timeFor(mainCfg),
    ...extra,
  })

  // 1) 메인: 첫 계획
  let plan
  let usage
  try {
    ;({ result: plan, usage } = takeUsage(await callMain(task.task_query, mainOptions({ previousPlan: task.plan_payload, round: 0 }))))
  } catch (error) {
    console.error('[agents] 계획 작성 실패', error)
    await transition(task, 'FAILED', { log: { agent: 'main', event: 'PLAN_FAILED', note: String(error?.message ?? error).slice(0, 300) } })
    await sendMessage(chatId, [...scheduleHeader(task), `🚫 계획을 만들지 못했어요\n원인: ${friendlyReason(error)}\n지시: ${task.task_query}`].join('\n'))
    return 'plan-failed'
  }

  // 메인이 되묻기로 답함 (모호하거나 할 수 없는 지시). 이 작업은 닫고, 캡틴이 내용을 보태 다시 보내게 한다.
  if (plan?.clarification) {
    await transition(task, 'FAILED', { log: { agent: 'main', event: 'NEEDS_INFO', question: plan.clarification, ...usage } })
    await sendMessage(chatId, clarificationText(task, plan.clarification))
    return 'needs-info'
  }

  let current = await transition(task, 'VALIDATING', {
    log: { agent: 'main', event: 'PLANNED', program: mainCfg.program, steps: stepCount(plan), rules: status, ...usage },
    patch: { plan_payload: plan, plan_hash: hashPlan(plan) },
  })
  if (!current) return 'already'

  // 2) 검사와 상의: 코드 검사(규칙 위반 → 거부) → 크로스체크 의견 → 이의면 메인이 고침 (최대 CONSULT_MAX_ROUNDS회)
  const review = { program: checkCfg.program, verdict: 'off', rounds: 0, comments: [] }
  let verdict
  for (let round = 0; ; round += 1) {
    verdict = validatePlan(plan)
    if (!verdict.ok) {
      await transition(current, 'FAILED', { log: { agent: 'crosscheck', event: 'VALIDATION_FAILED', check: 'code', errors: verdict.errors } })
      await sendMessage(chatId, validationFailedText(task, verdict.errors))
      return 'invalid'
    }
    if (!callReview) break // 크로스체크 에이전트 꺼짐: 코드 검사만

    const reviewTime = timeFor(checkCfg)
    if (reviewTime < MIN_CALL_MS) {
      review.verdict = 'timeout'
      break
    }
    let opinion
    let reviewUsage
    try {
      const raw = await callReview({ query: task.task_query, plan, rules, round, model: checkCfg.model, timeoutMs: reviewTime })
      reviewUsage = raw?.usage ? { usage: raw.usage } : {}
      opinion = normalizeOpinion(raw)
    } catch (error) {
      console.error('[agents] 크로스체크 실패', error)
      review.verdict = 'error'
      review.comments = [friendlyReason(error)]
      current = (await appendLog(current, { agent: 'crosscheck', event: 'CROSSCHECK_ERROR', note: review.comments[0] })) ?? current
      break
    }
    if (opinion.verdict === 'agree') {
      review.verdict = 'agreed'
      current = (await appendLog(current, { agent: 'crosscheck', event: 'CROSSCHECK_AGREED', round, ...reviewUsage })) ?? current
      break
    }

    review.comments = opinion.comments
    current =
      (await appendLog(current, { agent: 'crosscheck', event: 'CROSSCHECK_OBJECTION', round, comments: opinion.comments, ...reviewUsage })) ??
      current
    if (round >= CONSULT_MAX_ROUNDS) {
      review.verdict = 'unresolved'
      break
    }
    if (timeFor(mainCfg) < MIN_CALL_MS) {
      review.verdict = 'timeout'
      break
    }

    // 메인이 크로스체크 의견을 반영해 고친다
    let revised
    let reviseUsage
    try {
      ;({ result: revised, usage: reviseUsage } = takeUsage(
        await callMain(task.task_query, mainOptions({ previousPlan: plan, review: opinion, round: round + 1 })),
      ))
    } catch (error) {
      console.error('[agents] 계획 수정 실패', error)
      review.verdict = 'unresolved'
      current = (await appendLog(current, { agent: 'main', event: 'PLAN_REVISE_FAILED', note: friendlyReason(error) })) ?? current
      break
    }
    if (revised?.clarification) {
      await transition(current, 'FAILED', { log: { agent: 'main', event: 'NEEDS_INFO', question: revised.clarification, ...reviseUsage } })
      await sendMessage(chatId, clarificationText(task, revised.clarification))
      return 'needs-info'
    }
    plan = revised
    review.rounds = round + 1
    const next = await appendLog(
      current,
      { agent: 'main', event: 'PLAN_REVISED', round: round + 1, steps: stepCount(plan), ...reviseUsage },
      { patch: { plan_payload: plan, plan_hash: hashPlan(plan) } },
    )
    if (!next) return 'already'
    current = next
  }

  // 3) 상의 결과를 계획에 붙여(결재는 이 내용 전체에 묶인다) 결재 대기 또는 자동 승인으로
  const finalPlan = { ...plan, review }
  const finalPatch = { plan_payload: finalPlan, plan_hash: hashPlan(finalPlan) }
  const disagreed = ['unresolved', 'timeout', 'error'].includes(review.verdict)

  // 읽기 전용이고 이견이 없으면 결재 생략. 상태 머신은 그대로 밟고, 로그에 AUTO_APPROVED를 남긴다.
  // 단, 일정에서 자동으로 시작한 작업(source_key 있음)은 캡틴이 보낸 지시가 아니므로 항상 결재한다. (G-9)
  const scheduled = Boolean(task.source_key)
  if (!verdict.needsApproval && !disagreed && !scheduled) {
    const approved = await transition(current, 'APPROVED', {
      log: { agent: 'orchestrator', event: 'AUTO_APPROVED', note: '읽기 전용 계획' },
      patch: finalPatch,
    })
    if (!approved) return 'already'
    return runApproved(approved, chatId, status)
  }

  const pending = await transition(current, 'PENDING', {
    log: { agent: 'orchestrator', event: 'VALIDATED', review: review.verdict },
    patch: { ...finalPatch, expires_at: new Date(Date.now() + APPROVAL_TTL_MS).toISOString() },
  })
  if (!pending) return 'already'

  const sent = await sendMessage(chatId, approvalText(pending, status), approvalButtons(pending.id))
  if (!sent.ok) {
    // 버튼 없는 결재 대기 작업이 남지 않도록 닫는다.
    await transition(pending, 'FAILED', { log: { agent: 'orchestrator', event: 'SEND_FAILED', note: '결재 메시지를 보내지 못함' } }).catch(() => null)
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
//   PLANNING·VALIDATING 5분 넘게 기록 없음 → FAILED(STALLED) + 알림 (계획 단계라 실행된 것은 없음)
//   PENDING 만료 → FAILED(EXPIRED) · REJECTED 사유 30분 무응답 → FAILED(REASON_TIMEOUT)
export async function sweepStale(chatId, now = Date.now()) {
  const rows = await listOpenTasks()
  const closed = []
  for (const task of rows) {
    if (task.status === 'EXECUTING' && now - lastLogAt(task) > STALE_EXECUTION_MS) {
      const failed = await transition(task, 'FAILED', { log: { agent: 'orchestrator', event: 'INTERRUPTED', note: '실행이 2분 넘게 멈춰 있음' } })
      if (failed) {
        closed.push('interrupted')
        await sendMessage(chatId, interruptedText(failed))
      }
    } else if ((task.status === 'PLANNING' || task.status === 'VALIDATING') && now - lastLogAt(task) > STALE_PLANNING_MS) {
      const failed = await transition(task, 'FAILED', {
        log: { agent: 'orchestrator', event: 'STALLED', note: `${task.status} 단계에서 5분 넘게 멈춰 있음` },
      })
      if (failed) {
        closed.push('stalled')
        await sendMessage(chatId, stalledText(failed))
      }
    } else if (task.status === 'PENDING' && task.expires_at && Date.parse(task.expires_at) <= now) {
      if (await transition(task, 'FAILED', { log: { agent: 'orchestrator', event: 'EXPIRED', note: '결재 대기 시간(30분) 초과' } })) closed.push('expired')
    } else if (task.status === 'REJECTED' && now - lastLogAt(task) > REASON_TTL_MS) {
      if (await transition(task, 'FAILED', { log: { agent: 'orchestrator', event: 'REASON_TIMEOUT', note: '반려 사유를 30분 동안 받지 못함' } })) {
        closed.push('reason-timeout')
      }
    }
  }
  return closed
}
