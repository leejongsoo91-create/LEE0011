---
name: add-department
description: 텔레그램 멀티 에이전트에 새 부서(업무 영역과 그 도구)를 추가할 때 쓰는 절차. 보고서 → 부서 폴더 → 등록 → 테스트 → 문서 순서.
---

# 새 부서 추가 절차

1. **보고서 먼저** (우리의 규칙). 담을 것:
   - 부서 id(영문 소문자·숫자·밑줄)와 이름, 한 줄 역할, 맡지 않는 일
   - 도구 목록: 이름(`<id>.<이름>`), 위험도(read/write/irreversible), 인자, write는 원복 방법
   - 접근하는 테이블과 `user_id` 조건, 필요한 SQL(있으면), 결재 요약에 보일 문장
   - 테스트 시나리오와 사용자 확인 순서
   승인 전에는 파일을 만들지 않는다.
2. **부서 폴더** `api/_agents/depts/<id>/`:
   - `rules.md`: `api/_agents/rules/dept_template.md`를 복사해 채운다 (메인 에이전트 프롬프트에 그대로 들어간다)
   - `tools.js`: 도구마다 `label`, `risk`, `description`, `schema`, `check(args)`, `describe(args)`, `run(args)`, write면 `undo(args, output)`. 실제 데이터는 `ownerUserId()`로 주인 조건을 붙인다. 본보기는 `depts/schedule/tools.js`
   - `index.js`: `{ id, name, role, examples, rulesUrl: new URL('./rules.md', import.meta.url), tools }`
3. **등록**: `api/_agents/depts/index.js`의 `DEPARTMENTS`에 한 줄. 규칙서 읽기·결재 메시지·검증·/help는 자동으로 따라온다.
4. **테스트** (`api/_agents/<id>.test.js`): 인자 검사(정상·경계·거부), 실행과 원복, 다른 사용자 데이터 제외, 가짜 AI(`fakeAnthropic`)로 지시 → 결재 → 실행 → 실패 시 원복. `npm run test:agents` 전부 통과.
5. **문서·마무리**: `agent_architecture.md`(파일 구조·단계별 계획), 필요하면 `.env.example`. 한국어 커밋 후 푸시, `deploy-check` 순서로 사용자 확인 가이드.
