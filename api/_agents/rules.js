// 규칙서 로더. AI 계획 작성기(planner.js)가 시스템 프롬프트에 넣는다.
// Vercel 배포에 파일이 포함되도록 vercel.json의 includeFiles에 rules 폴더를 넣어 두었다.

import { readFileSync } from 'node:fs'

let cache = null

function read(url) {
  try {
    return readFileSync(url, 'utf8')
  } catch {
    return null
  }
}

export function loadRules() {
  cache ??= {
    global: read(new URL('./rules/global_rules.md', import.meta.url)),
    deptTemplate: read(new URL('./rules/dept_template.md', import.meta.url)),
    depts: {
      schedule: read(new URL('./rules/dept_schedule.md', import.meta.url)),
    },
  }
  return cache
}

// event_logs·결재 메시지에 남길 짧은 상태
export const rulesStatus = (rules) => ({
  global: Boolean(rules?.global),
  deptTemplate: Boolean(rules?.deptTemplate),
  schedule: Boolean(rules?.depts?.schedule),
})
