// 도구·부서 레지스트리: 에이전트가 쓸 수 있는 도구의 유일한 목록.
// 검증기는 여기에 없는 도구를 무조건 거부하고, 계획에 적힌 위험도가 아니라 여기 적힌 위험도를 믿는다.
//
// 도구 하나 = { dept, label, risk, check(args) → 오류 문장|null, run(args) → 결과, undo(args, 결과) → 결과 }
//   risk: 'read'(결재 없이 실행) · 'write'(결재 필요, undo 필수) · 'irreversible'(결재 + 경고, 계획의 마지막 1단계만)
//
// 2단계에서는 실제 부서 없이 "테스트 팀" 도구 3개만 있다. 실제 데이터는 건드리지 않는다.

import { randomUUID } from 'node:crypto'

export const departments = {
  test: { name: '테스트 팀', tools: ['test.lookup', 'test.write', 'test.fail_write'] },
}

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

export const tools = {
  'test.lookup': {
    dept: 'test',
    label: '테스트 조회',
    risk: 'read',
    check: checkTextArgs,
    run: async (args) => ({ summary: `가짜 데이터 3건 조회 ("${short(args.text)}")` }),
  },
  'test.write': {
    dept: 'test',
    label: '테스트 쓰기',
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
    dept: 'test',
    label: '실패하는 테스트 쓰기',
    risk: 'write',
    check: checkTextArgs,
    run: async () => {
      throw new Error('의도된 실패(테스트)')
    },
    undo: async () => ({ summary: '되돌릴 것 없음' }),
  },
}

export const getTool = (name, registry = tools) =>
  typeof name === 'string' && Object.hasOwn(registry, name) ? registry[name] : null
