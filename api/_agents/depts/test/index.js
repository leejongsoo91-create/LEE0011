// 테스트 팀: 실제 데이터를 건드리지 않는 가짜 도구 3개. 원복(롤백)과 결재 흐름을 확인하는 용도.
// test.lookup·test.write는 테스트 계획 작성기 전용(aiVisible: false), test.fail_write는 AI도 쓸 수 있다("실패 테스트").

import { randomUUID } from 'node:crypto'

// 테스트 쓰기 도구가 기록하는 곳. 메모리라서 요청이 끝나면 사라진다. (원복이 실제로 지웠는지 테스트에서 확인하는 용도)
export const sandbox = new Map()

const ALLOWED_ARGS = new Set(['text', 'failUndo'])
function checkTextArgs(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return '인자가 객체가 아닙니다'
  const unknown = Object.keys(args).filter((key) => !ALLOWED_ARGS.has(key))
  if (unknown.length) return `모르는 인자: ${unknown.join(', ')}`
  if (typeof args.text !== 'string' || !args.text.trim() || args.text.length > 500) return 'text는 1~500자 글자여야 합니다'
  if (args.failUndo !== undefined && typeof args.failUndo !== 'boolean') return 'failUndo는 true/false여야 합니다'
  return null
}

const short = (text) => (text.length > 30 ? `${text.slice(0, 30)}…` : text)

export default {
  id: 'test',
  name: '테스트 팀',
  role: '가짜 도구로 결재·원복 흐름 확인 (실제 데이터 없음)',
  examples: ['실패 테스트', '조회 테스트'],
  rulesUrl: null,
  tools: {
    'test.lookup': {
      label: '테스트 조회',
      aiVisible: false,
      risk: 'read',
      check: checkTextArgs,
      run: async (args) => ({ summary: `가짜 데이터 3건 조회 ("${short(args.text)}")` }),
    },
    'test.write': {
      label: '테스트 쓰기',
      aiVisible: false,
      risk: 'write',
      check: checkTextArgs,
      run: async (args) => {
        const recordId = randomUUID()
        sandbox.set(recordId, { text: args.text })
        return { recordId, summary: '테스트 기록 1건 작성' }
      },
      undo: async (args, output) => {
        if (args.failUndo) throw new Error('의도된 원복 실패(테스트)')
        sandbox.delete(output?.recordId)
        return { summary: '테스트 기록 삭제' }
      },
    },
    'test.fail_write': {
      label: '실패하는 테스트 쓰기',
      risk: 'write',
      description: '롤백 확인용. 항상 실패한다. 캡틴이 "실패 테스트"·"롤백 테스트"를 명시적으로 요청할 때만 계획의 마지막 단계에 넣는다.',
      schema: {
        type: 'object',
        properties: { text: { type: 'string', description: '아무 설명 (1~500자)' } },
        required: ['text'],
      },
      check: checkTextArgs,
      run: async () => {
        throw new Error('의도된 실패(테스트)')
      },
      undo: async () => ({ summary: '되돌릴 것 없음' }),
    },
  },
}
