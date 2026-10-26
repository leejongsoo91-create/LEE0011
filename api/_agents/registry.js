// 도구·부서 레지스트리: 에이전트가 쓸 수 있는 도구의 유일한 목록. depts/index.js의 부서들로 자동으로 만든다.
// 검증기는 여기에 없는 도구를 무조건 거부하고, 계획에 적힌 위험도·부서가 아니라 여기 적힌 값을 믿는다.
//
// 도구 하나 = { label, risk, check(args) → 오류 문장|null, run(args) → 결과, undo(args, 결과) → 결과 }
//   risk: 'read'(결재 없이 실행) · 'write'(결재 필요, undo 필수) · 'irreversible'(결재 + 경고, 계획의 마지막 1단계만)
//   선택: describe(args) → 결재 요약 한 줄 · description·schema → AI에게 보여 줄 설명과 인자 형식
//   aiVisible: false면 AI 메인 에이전트에게는 보이지 않는다 (테스트 계획 작성기 전용)
//   dept는 레지스트리가 부서 폴더에 따라 붙인다. 도구 이름은 "<부서 id>.<이름>" 이어야 한다.

import { DEPARTMENTS } from './depts/index.js'

export { sandbox } from './depts/test/index.js'

export function buildRegistry(list) {
  const departments = {}
  const tools = {}
  for (const dept of list) {
    if (!/^[a-z][a-z0-9_]*$/.test(dept.id ?? '')) throw new Error(`부서 id가 잘못됨: ${dept.id}`)
    if (departments[dept.id]) throw new Error(`부서 id 중복: ${dept.id}`)
    for (const [name, tool] of Object.entries(dept.tools ?? {})) {
      if (!name.startsWith(`${dept.id}.`)) throw new Error(`도구 이름은 "${dept.id}."로 시작해야 함: ${name}`)
      if (tools[name]) throw new Error(`도구 이름 중복: ${name}`)
      tools[name] = { ...tool, dept: dept.id }
    }
    departments[dept.id] = { ...dept, tools: Object.keys(dept.tools ?? {}) }
  }
  return { departments, tools }
}

export const { departments, tools } = buildRegistry(DEPARTMENTS)

export const getTool = (name, registry = tools) =>
  typeof name === 'string' && Object.hasOwn(registry, name) ? registry[name] : null

export const deptName = (id) => departments[id]?.name ?? id
