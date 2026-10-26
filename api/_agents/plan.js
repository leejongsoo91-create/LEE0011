// 계획서(JSON)를 다루는 도우미: 정규화해서 해시를 만들고, 결재 요약용 문장으로 바꾼다.
// 승인은 이 해시에 묶인다. 승인 뒤에 계획이 한 글자라도 바뀌면 해시가 달라져 실행되지 않는다.

import { createHash } from 'node:crypto'

// 키 순서와 상관없이 같은 내용이면 같은 문자열이 되도록 정규화한다.
// (Postgres jsonb는 저장할 때 키 순서를 바꿀 수 있다.)
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function hashPlan(plan) {
  return createHash('sha256').update(canonical(plan)).digest('hex')
}

// 결재 테스트 모드용 가짜 계획. 실제로 실행되는 것은 없다. (2단계에서 진짜 계획 작성으로 바뀐다.)
export function buildTestPlan(query) {
  return { version: 1, testMode: true, steps: [{ tool: 'test.noop', args: { text: query }, risk: 'write' }] }
}

export function describePlan(plan) {
  const steps = Array.isArray(plan?.steps) ? plan.steps : []
  if (steps.length === 0) return '(실행할 단계 없음)'
  return steps.map((step, index) => `${index + 1}. ${step.tool} (${step.risk})`).join('\n')
}
