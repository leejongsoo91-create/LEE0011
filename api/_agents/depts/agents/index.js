// 에이전트 설정 부서: 메인·크로스체크 에이전트가 쓸 프로그램 매칭을 결재로 바꾼다.
// 부서 하나 = 폴더 하나 (index.js 등록 정보 · tools.js 도구 · rules.md 부서 규칙). depts/index.js에 한 줄 추가하면 등록된다.

import { setMatching } from './tools.js'

export default {
  id: 'agents',
  name: '에이전트 설정 부서',
  role: '메인·크로스체크 에이전트의 프로그램 매칭 변경',
  examples: ['메인을 Opus 5.5로 바꿔줘', '크로스체크를 Claude로 켜줘', '크로스체크 꺼줘'],
  rulesUrl: new URL('./rules.md', import.meta.url),
  tools: {
    'agents.set_matching': setMatching,
  },
}
