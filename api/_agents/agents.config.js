// 역할(에이전트)별 설정을 한 곳에. 어떤 역할에 어떤 프로그램을 쓸지는 캡틴이 정한다.
// 지금 AI(또는 프로그램)를 끼울 수 있는 역할은 둘: 메인(계획)과 크로스체크(검토·상의).
// 입구·오케스트레이터·실행·보고는 코드이고, 실행은 앞으로도 코드만 한다.
//
// 매칭은 두 곳에서 정한다. 텔레그램 결재로 바꾼 값(DB agent_settings, settings.js)이 먼저이고,
// 그 칸이 비어 있으면 아래 Vercel 환경변수, 그것도 없으면 기본값을 쓴다.
// Vercel 환경변수 (없으면 기본값):
//   AGENT_PROGRAM_MAIN        anthropic | test        (기본: ANTHROPIC_API_KEY가 있으면 anthropic, 없거나 AGENT_PLANNER=test면 test)
//   AGENT_MODEL_MAIN          메인 모델 (예전 이름 AGENT_MODEL도 됨, 기본 claude-sonnet-5-5)
//   AGENT_PROGRAM_CROSSCHECK  off | test               (기본 off = 코드 검사만)
//   AGENT_MODEL_CROSSCHECK    크로스체크 모델 (프로그램을 정하면 사용)
//   AGENT_PLANNING_BUDGET_MS  계획·상의에 쓸 시간 예산 (기본 50000 = 50초, 웹훅 함수 한도 60초 안)

export const DEFAULT_MAIN_MODEL = 'claude-sonnet-5-5'
export const DEFAULT_CROSSCHECK_MODEL = 'claude-sonnet-5-5'

// 상의: 크로스체크가 이의를 내면 메인이 고치는 횟수의 최대값
export const CONSULT_MAX_ROUNDS = 2
// 결재 메시지를 보내는 데 남겨 둘 시간, AI를 부를 최소 시간
export const SEND_RESERVE_MS = 3_000
export const MIN_CALL_MS = 5_000

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null)
const number = (value, fallback) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback)

// settings: 저장된 매칭 { main: {program, model}, crosscheck: {program, model} } (settings.js의 loadSettings). 비어 있으면 환경변수.
export function roleConfig(role, env = process.env, settings = {}) {
  if (role === 'main') {
    const fallback = env.AGENT_PLANNER === 'test' || !env.ANTHROPIC_API_KEY ? 'test' : 'anthropic'
    return {
      role,
      label: '메인 에이전트',
      program: text(settings.main?.program) ?? text(env.AGENT_PROGRAM_MAIN) ?? fallback,
      model: text(settings.main?.model) ?? text(env.AGENT_MODEL_MAIN) ?? text(env.AGENT_MODEL) ?? DEFAULT_MAIN_MODEL,
      timeoutMs: number(env.AGENT_TIMEOUT_MAIN_MS, 30_000),
    }
  }
  if (role === 'crosscheck') {
    const program = text(settings.crosscheck?.program) ?? text(env.AGENT_PROGRAM_CROSSCHECK) ?? 'off'
    const model = text(settings.crosscheck?.model) ?? text(env.AGENT_MODEL_CROSSCHECK)
    return {
      role,
      label: '크로스체크 에이전트',
      program,
      model: model ?? (program === 'anthropic' ? DEFAULT_CROSSCHECK_MODEL : null),
      timeoutMs: number(env.AGENT_TIMEOUT_CROSSCHECK_MS, 15_000),
    }
  }
  throw new Error(`모르는 역할: ${role}`)
}

// 사람이 읽는 프로그램 표시: "꺼짐 (코드 검사만)" · "테스트용" · "anthropic (claude-opus-5-5)"
export const programLabel = (cfg) => {
  if (cfg.program === 'off') return '꺼짐 (코드 검사만)'
  if (cfg.program === 'test') return '테스트용'
  return cfg.model ? `${cfg.program} (${cfg.model})` : cfg.program
}
export const matchingSummary = (mainCfg, checkCfg) => `메인 ${programLabel(mainCfg)} · 크로스체크 ${programLabel(checkCfg)}`

export const planningBudgetMs = (env = process.env) => number(env.AGENT_PLANNING_BUDGET_MS, 50_000)

// event_logs의 agent 값 (누가 그 일을 했는지)
export const AGENT_LABEL = {
  captain: '캡틴',
  intake: '입구',
  orchestrator: '오케스트레이터',
  main: '메인 에이전트',
  crosscheck: '크로스체크',
  executor: '실무 에이전트',
}
