// 업무 부서: 대시보드 /work 메뉴의 회의 기록과 칸반 할 일 카드를 등록한다.
// 지금은 Plaud 회의 녹음 자동 수신(plaudTrigger.js)이 만든 계획에서만 쓰고, AI 메인 에이전트에게는 도구가 보이지 않는다.

import { workImportMeeting } from './tools.js'

export default {
  id: 'work',
  name: '업무 부서',
  role: 'Plaud 회의 녹음을 업무 탭에 등록 (녹음이 끝나면 자동으로 결재 요청)',
  examples: [],
  rulesUrl: new URL('./rules.md', import.meta.url),
  tools: {
    'work.import_meeting': workImportMeeting,
  },
}
