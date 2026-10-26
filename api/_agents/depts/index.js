// 등록된 부서 목록. 새 부서는 depts/<부서>/ 폴더를 만들고 여기에 한 줄만 추가한다.
// (폴더 안: index.js 등록 정보, tools.js 도구, rules.md 부서 규칙 — rules/dept_template.md 참고)

import schedule from './schedule/index.js'
import test from './test/index.js'

export const DEPARTMENTS = [schedule, test]
