// 일정 부서: 대시보드 /schedule 메뉴의 일정을 등록하고 조회한다.
// 부서 하나 = 폴더 하나 (index.js 등록 정보 · tools.js 도구 · rules.md 부서 규칙). depts/index.js에 한 줄 추가하면 등록된다.

import { scheduleCreate, scheduleList } from './tools.js'

export default {
  id: 'schedule',
  name: '일정 부서',
  role: '대시보드 일정 등록·조회',
  examples: ['내일 오후 3시 회의 등록해줘', '이번 주 일정 알려줘'],
  rulesUrl: new URL('./rules.md', import.meta.url),
  tools: {
    'schedule.list': scheduleList,
    'schedule.create': scheduleCreate,
  },
}
