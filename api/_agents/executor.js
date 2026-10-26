// 실행기: 승인된(APPROVED) 계획을 단계별로 실행한다.
// 단계마다 시작·끝을 event_logs에 남기고, 실패하면 이미 성공한 쓰기 단계를 거꾸로 되돌린 뒤 FAILED로 닫는다.
//
// 돌려주는 값: { status, task, results, failure, undo }
//   status: 'completed' | 'rolled-back' | 'undo-failed' | 'hash-mismatch' | 'already' | 'aborted'

import { hashPlan } from './plan.js'
import { getTool } from './registry.js'
import { appendLog, transition } from './tasks.js'

export async function executePlan(task) {
  if (task.status !== 'APPROVED') return { status: 'already', task }

  // 승인(또는 자동 승인) 뒤에 계획이 바뀌지 않았는지 실행 직전에 한 번 더 확인한다.
  if (hashPlan(task.plan_payload) !== task.plan_hash) {
    const failed = await transition(task, 'FAILED', { log: { event: 'HASH_MISMATCH', note: '실행 직전 계획 확인 실패' } })
    return { status: 'hash-mismatch', task: failed ?? task }
  }

  let current = await transition(task, 'EXECUTING', { log: { event: 'EXECUTE_START' } })
  if (!current) return { status: 'already', task }

  const steps = task.plan_payload.steps
  const done = []
  let failure = null

  // 로그를 붙이다가 상태가 바뀐 것을 발견하면(다른 요청이 '중단'으로 정리함) 즉시 멈춘다.
  const log = async (entries) => {
    const next = await appendLog(current, entries)
    if (next) current = next
    return Boolean(next)
  }

  for (const [index, step] of steps.entries()) {
    const n = index + 1
    if (!(await log({ event: 'STEP_START', step: n, tool: step.tool }))) return { status: 'aborted', task: current }
    const tool = getTool(step.tool)
    try {
      if (!tool) throw new Error('등록되지 않은 도구')
      const output = await tool.run(step.args)
      done.push({ n, step, tool, output })
      if (!(await log({ event: 'STEP_DONE', step: n, tool: step.tool, summary: output?.summary, output }))) {
        return { status: 'aborted', task: current }
      }
    } catch (error) {
      failure = { step: n, tool: step.tool, message: error?.message ?? String(error) }
      await log({ event: 'STEP_FAILED', ...failure })
      break
    }
  }

  const results = done.map(({ n, step, output }) => ({ step: n, tool: step.tool, summary: output?.summary }))

  if (!failure) {
    const completed = await transition(current, 'COMPLETED', { log: { event: 'COMPLETED' } })
    return { status: 'completed', task: completed ?? current, results }
  }

  // 역순 원복: 읽기 단계는 되돌릴 것이 없으므로 건너뛴다.
  const undo = []
  for (const { n, step, tool, output } of [...done].reverse()) {
    if (tool.risk === 'read') continue
    try {
      const result = await tool.undo(step.args, output)
      undo.push({ step: n, tool: step.tool, ok: true, summary: result?.summary })
    } catch (error) {
      undo.push({ step: n, tool: step.tool, ok: false, message: error?.message ?? String(error) })
    }
  }
  const undoFailed = undo.some((item) => !item.ok)
  if (undo.length) await log(undo.map((item) => ({ event: item.ok ? 'UNDO_DONE' : 'UNDO_STEP_FAILED', ...item })))

  const failed = await transition(current, 'FAILED', {
    log: { event: undoFailed ? 'UNDO_FAILED' : 'ROLLED_BACK', failedStep: failure.step, reason: failure.message },
  })
  return { status: undoFailed ? 'undo-failed' : 'rolled-back', task: failed ?? current, results, failure, undo }
}
