// 계획서(JSON)를 다루는 도우미: 정규화해서 해시를 만들고, 결재 요약용 문장으로 바꾼다.
// 승인은 이 해시에 묶인다. 승인 뒤에 계획이 한 글자라도 바뀌면 해시가 달라져 실행되지 않는다.

import { createHash } from 'node:crypto'
import { getTool } from './registry.js'

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

// 가짜 계획 작성기(메인 에이전트 자리). 3단계에서 AI 계획 작성으로 교체된다.
// 지시 문구(또는 반려 사유)에 든 낱말로 시나리오를 고른다:
//   "원복실패" → 쓰기 후 실패, 원복도 실패 · "실패" → 쓰기 후 실패, 원복 · "조회" → 읽기 전용 · 그 외 → 쓰기 1단계
export function scenarioOf(text) {
  const t = String(text ?? '').replace(/\s+/g, '')
  if (t.includes('원복실패')) return 'undo-fail'
  if (t.includes('실패')) return 'fail'
  if (t.includes('조회')) return 'lookup'
  return null
}

const step = (tool, args) => ({ tool, args, risk: getTool(tool).risk, dept: getTool(tool).dept })

export function buildTestPlan(query, { feedback, review, round = 0 } = {}) {
  // 반려 사유에 시나리오 낱말이 있으면 그걸 따르고, 없으면 원래 지시를 따른다.
  const scenario = scenarioOf(feedback) ?? scenarioOf(query) ?? 'write'
  const text = query
  const steps = {
    lookup: [step('test.lookup', { text })],
    write: [step('test.write', { text })],
    fail: [step('test.write', { text }), step('test.fail_write', { text })],
    'undo-fail': [step('test.write', { text, failUndo: true }), step('test.fail_write', { text })],
  }[scenario]
  return {
    version: 2,
    testMode: true,
    main: { program: 'test' },
    scenario,
    revision: round,
    summary: review ? `크로스체크 의견 반영 (${round}회): ${review.comments.join(' / ')}` : '',
    steps,
    ...(feedback ? { feedback } : {}),
  }
}

export const RISK_LABEL = { read: '읽기', write: '쓰기·원복 가능', irreversible: '⚠️ 되돌릴 수 없음' }

export function describePlan(plan) {
  const steps = Array.isArray(plan?.steps) ? plan.steps : []
  if (steps.length === 0) return '(실행할 단계 없음)'
  return steps
    .map((s, index) => {
      const tool = getTool(s.tool)
      const detail = tool?.describe && !tool.check?.(s.args) ? `: ${tool.describe(s.args)}` : ''
      return `${index + 1}. ${tool?.label ?? s.tool}${detail} [${RISK_LABEL[s.risk] ?? s.risk}]`
    })
    .join('\n')
}
