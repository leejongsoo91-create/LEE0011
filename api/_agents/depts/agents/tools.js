// 에이전트 설정 부서 도구: agents.set_matching(write, 원복 = 바꾸기 전 저장값으로 되돌림)
// 규칙서: depts/agents/rules.md. 저장 위치는 agent_settings 표(settings.js). 허용 목록 밖의 프로그램·모델은 결재 요청 전에 거부된다.

import { ALLOWED_MODELS, ALLOWED_PROGRAMS, ROLES, readSettings, saveSetting } from '../../settings.js'

const ROLE_LABEL = { main: '메인 에이전트', crosscheck: '크로스체크 에이전트' }
const PROGRAM_LABEL = { off: '꺼짐 (코드 검사만)', test: '테스트용' }

// 사람이 읽는 "프로그램 · 모델"
export const valueLabel = ({ program, model }) => PROGRAM_LABEL[program] ?? (model ? `${program} · ${model}` : String(program ?? '기본값'))

function onlyKeys(args, allowed) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return '인자가 객체가 아닙니다'
  const unknown = Object.keys(args).filter((key) => !allowed.includes(key))
  return unknown.length ? `모르는 인자: ${unknown.join(', ')}` : null
}

export const setMatching = {
  label: '에이전트 매칭 변경',
  risk: 'write',
  description: '메인 또는 크로스체크 에이전트가 쓸 프로그램(과 모델)을 바꾼다. 다음 작업부터 적용된다.',
  schema: {
    type: 'object',
    properties: {
      role: { type: 'string', enum: ROLES, description: 'main(계획 담당) 또는 crosscheck(검토·상의 담당)' },
      program: { type: 'string', enum: [...new Set(Object.values(ALLOWED_PROGRAMS).flat())], description: 'main은 anthropic 또는 test, crosscheck는 off, test, anthropic' },
      model: { type: ['string', 'null'], enum: [...ALLOWED_MODELS, null], description: 'program이 anthropic일 때만 필수, 그 밖에는 null' },
    },
    required: ['role', 'program'],
  },
  check(args) {
    const keys = onlyKeys(args, ['role', 'program', 'model'])
    if (keys) return keys
    if (!ROLES.includes(args.role)) return `role은 ${ROLES.join(', ')} 중 하나여야 합니다`
    if (!ALLOWED_PROGRAMS[args.role].includes(args.program)) {
      return `${ROLE_LABEL[args.role]}의 프로그램은 ${ALLOWED_PROGRAMS[args.role].join(', ')} 중 하나여야 합니다`
    }
    const model = args.model ?? null
    if (args.program === 'anthropic') {
      if (!ALLOWED_MODELS.includes(model)) return `anthropic은 model이 필요합니다 (${ALLOWED_MODELS.join(', ')} 중 하나)`
    } else if (model !== null) {
      return `${args.program}에는 model을 정하지 않습니다`
    }
    return null
  },
  describe: (args) => `${ROLE_LABEL[args.role] ?? args.role} → ${valueLabel({ program: args.program, model: args.model ?? null })}`,
  async run(args) {
    // 원복에 쓸 이전 저장값을 정확히 읽는다 (읽기에 실패하면 여기서 오류 → 아무것도 바꾸지 않고 실패 처리)
    const previous = (await readSettings())[args.role]
    const saved = await saveSetting(args.role, { program: args.program, model: args.program === 'anthropic' ? args.model : null })
    return { previous, summary: `${ROLE_LABEL[args.role]} 매칭 변경: ${valueLabel(saved)} (다음 작업부터 적용)` }
  },
  async undo(args, output) {
    const previous = output?.previous ?? { program: null, model: null }
    await saveSetting(args.role, previous)
    return { summary: `${ROLE_LABEL[args.role]} 매칭 원복: ${previous.program ? valueLabel(previous) : '저장값 없음 (환경변수 기본값)'}` }
  },
}
