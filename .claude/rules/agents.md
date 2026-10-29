---
paths:
  - "api/**"
---

# 에이전트(api/) 작업 규칙

설계 전체는 `agent_architecture.md`, 에이전트가 따르는 규칙은 `api/_agents/rules/global_rules.md`.

## 지킬 것

- 작업 상태(`agent_tasks.status`)는 `tasks.transition()`의 **조건부 업데이트**(지금 이 상태일 때만)로만 바꾼다. 상태를 직접 PATCH하지 않는다.
- `event_logs`의 모든 기록에 `agent`(captain · intake · orchestrator · main · crosscheck · executor)를 남긴다. 실행 단계 기록에는 `dept`.
- 위험도(`risk`)와 부서(`dept`)는 AI가 정하지 않는다. 레지스트리(`registry.js`) 값을 코드가 채우고, 검증기(`validator.js`)가 다시 검사한다.
- `write` 도구는 `undo`(원복)가 필수다. `irreversible`은 계획의 마지막 단계에만.
- 실행은 코드만 한다. AI(메인·크로스체크)는 계획과 의견만 낸다.
- 일정 등 실제 데이터 도구는 모든 쿼리에 주인 `user_id` 조건을 붙인다 (`owner.js`).
- 웹훅은 처리 결과와 상관없이 200을 돌려준다. `AGENT_MODE=on`이면 `TELEGRAM_WEBHOOK_SECRET` 확인이 필수다.
- 오류는 텔레그램에 원인 한 줄(`errors.js`)로 알리고, 키·토큰은 넣지 않는다.
- 결재는 최종 계획 전체(`plan_hash`)에 묶인다. 계획 내용이 바뀌면 다시 결재.

## 구조

- 새 부서: `api/_agents/depts/<id>/`(index.js · tools.js · rules.md) + `depts/index.js`에 한 줄. 도구 이름은 `<id>.<이름>`. 절차는 `add-department` 스킬.
- 역할별 프로그램·모델·시간 한도: `agents.config.js`. 프로그램 선택은 사용자가 정한다.
- Vercel 함수에서 읽는 `.md`는 `vercel.json`의 `includeFiles`(`api/_agents/**/*.md`)로 배포에 포함된다.

## 테스트

- `npm run test:agents`. 가짜 서버는 `api/_agents/testkit.js`(Supabase·텔레그램·Anthropic). 실제 서버 호출 금지.
- 새 동작마다 시나리오 테스트를 추가하고, 기존 테스트가 깨지면 이유를 확인한 뒤에만 기대값을 고친다.
