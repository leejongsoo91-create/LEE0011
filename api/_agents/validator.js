// 계획 검증기(크로스체크 자리). AI 없이 코드로만 검사한다.
// 통과하지 못한 계획은 결재 요청조차 가지 않는다.

import { getTool, tools } from './registry.js'

export const MAX_STEPS = 5
const RISKS = new Set(['read', 'write', 'irreversible'])

// 돌려주는 값: { ok: true, needsApproval } 또는 { ok: false, errors: [문장, …] }
export function validatePlan(plan, registry = tools) {
  const errors = []
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return { ok: false, errors: ['계획이 객체가 아닙니다'] }
  const steps = plan.steps
  if (!Array.isArray(steps) || steps.length === 0) return { ok: false, errors: ['실행할 단계가 없습니다'] }
  if (steps.length > MAX_STEPS) errors.push(`단계가 ${steps.length}개입니다 (최대 ${MAX_STEPS}개)`)

  steps.forEach((step, index) => {
    const n = index + 1
    const tool = getTool(step?.tool, registry)
    if (!tool) return errors.push(`${n}단계: 등록되지 않은 도구 "${step?.tool}"`)
    if (!RISKS.has(tool.risk)) errors.push(`${n}단계: 도구 위험도가 잘못 등록됨`)
    if (step.risk !== tool.risk) errors.push(`${n}단계: 위험도 표기(${step.risk})가 도구(${tool.risk})와 다릅니다`)
    if (step.dept !== undefined && step.dept !== tool.dept) errors.push(`${n}단계: 부서 표기(${step.dept})가 도구의 부서(${tool.dept})와 다릅니다`)
    const argError = tool.check?.(step.args) ?? null
    if (argError) errors.push(`${n}단계: ${argError}`)
    if (tool.risk === 'write' && typeof tool.undo !== 'function') errors.push(`${n}단계: 원복 방법이 없는 쓰기 도구`)
    if (tool.risk === 'irreversible' && index !== steps.length - 1) errors.push(`${n}단계: 되돌릴 수 없는 단계는 마지막에만 올 수 있습니다`)
  })

  if (errors.length) return { ok: false, errors }
  const needsApproval = steps.some((step) => getTool(step.tool, registry).risk !== 'read')
  return { ok: true, needsApproval }
}
