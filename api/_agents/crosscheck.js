// 크로스체크 에이전트: 메인이 세운 계획을 검토하고 동의하거나 이의를 낸다. (상의)
// 코드 검사(validator.js)는 항상 먼저 돌고, 규칙 위반은 상의 없이 거부된다. 여기는 그 위에 더하는 "의견" 자리다.
// 어떤 프로그램을 쓸지는 캡틴이 정한다(agents.config.js의 AGENT_PROGRAM_CROSSCHECK). 지금 있는 프로그램:
//   off  : 크로스체크 에이전트 없음 (코드 검사만)
//   test : 상의 흐름 확인용. 지시에 "이의 테스트"가 있으면 처음 한 번 이의를 내고, 고친 계획에는 동의한다.
//          "이의 유지 테스트"면 끝까지 이의를 낸다.
//
// 프로그램 = async ({ query, plan, rules, round, model, timeoutMs }) → { verdict: 'agree' | 'object', comments: [문장] }

const compact = (text) => String(text ?? '').replace(/\s+/g, '')

export async function testReview({ query, plan }) {
  const text = compact(query)
  if (text.includes('이의유지테스트')) return { verdict: 'object', comments: ['테스트 이의(유지): 이 계획에는 계속 반대합니다'] }
  if (text.includes('이의테스트') && (plan?.revision ?? 0) < 1) {
    return { verdict: 'object', comments: ['테스트 이의: 계획을 한 번 고쳐서 다시 보여 주세요'] }
  }
  return { verdict: 'agree', comments: [] }
}

export const CROSSCHECK_PROGRAMS = { off: null, test: testReview }

export function crosscheckProgram(name) {
  if (!Object.hasOwn(CROSSCHECK_PROGRAMS, name)) throw new Error(`크로스체크 프로그램이 등록되지 않음: ${name}`)
  return CROSSCHECK_PROGRAMS[name]
}

// 프로그램의 답이 정해진 모양인지 확인 (모양이 이상하면 이의로 본다 — 안전한 쪽)
export function normalizeOpinion(opinion) {
  const verdict = opinion?.verdict === 'agree' ? 'agree' : 'object'
  const comments = (Array.isArray(opinion?.comments) ? opinion.comments : [])
    .map((c) => String(c).slice(0, 300))
    .filter(Boolean)
    .slice(0, 5)
  if (verdict === 'object' && comments.length === 0) comments.push('크로스체크가 이유 없이 동의하지 않았어요')
  return { verdict, comments }
}
