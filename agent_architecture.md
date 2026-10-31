# 결재 통제형 멀티 에이전트 시스템 — 아키텍처

> 상태: **뼈대 완료 + 배정 준비 필수 정리** (부서 플러그인 구조, 역할별 프로그램 자리, 메인↔크로스체크 상의, 시간 예산, 작업 기록의 agent·dept)
> 계획서: 「멀티 에이전트 뼈대 구축 계획서」, 「에이전트 배정 전 점검 보고서」 / 규칙서: `api/_agents/rules/global_rules.md`, `api/_agents/rules/dept_template.md`, `api/_agents/depts/schedule/rules.md`, `api/_agents/depts/agents/rules.md`
> 에이전트 프로그램 매칭(5단계): 텔레그램에 "메인을 Opus 5.5로 바꿔줘"처럼 요청하면 에이전트 설정 부서가 매칭 변경 계획을 세우고, 크로스체크와 상의한 뒤 결재로 올린다. 승인하면 `agent_settings` 표에 저장되어 다음 작업부터 적용된다. 메인·크로스체크의 프로그램은 캡틴이 정한다.

## 1. 목표

기존 대시보드(Vercel + Supabase + Telegram) 위에, 캡틴(사용자)의 자연어 지시를 받아 계획하고 실행하는 멀티 에이전트 구조를 올린다.
**데이터를 바꾸는 모든 작업은 캡틴의 결재(승인/반려)를 거친 뒤에만 실행한다.** (Human-in-the-Loop)

## 2. 이번 범위와 나중 범위

| 구분 | 내용 |
| --- | --- |
| 이번 (뼈대) | 상태 머신, 결재 버튼 수신, 규칙서 3개, 도구·부서를 등록할 빈 레지스트리, 가짜 계획·검증·실행 모듈, 켜고 끄는 스위치 |
| 나중 (데이터 채우기) | 부서별 에이전트, 도구 목록과 인자 스키마, 롤백 구현, 실제 LLM 프롬프트와 API 연결 |
| 하지 않음 | LangChain·LangGraph, 대화 이어받기용 세션 테이블, 별도 실행 기록 테이블, 보고 단계의 LLM 요약 |

## 3. 7단계 흐름

| # | 단계 | 담당 | 하는 일 |
| --- | --- | --- | --- |
| 1 | 지시 | 캡틴 | 텔레그램으로 자연어 지시 |
| 2 | 계획 | 메인 에이전트 | 실행할 도구와 순서를 정한 **초안 계획서**만 작성 (실행하지 않음) |
| 3 | 검증 | 크로스체크 에이전트 | 안전성, 권한 범위, 필수 파라미터 누락 검사 |
| 4 | 결재 대기 | 시스템 | 검증된 **최종 계획서**를 요약해 텔레그램으로 전송, [승인] [반려] 버튼 제공 후 대기 |
| 5 | 결재 | 캡틴 | 승인 → 6단계, 반려 → 피드백을 담아 2단계로 회귀 |
| 6 | 실행 | 실무 에이전트(실행기) | 승인된 계획만 도구로 실행 |
| 7 | 보고 | 메인 에이전트 | 실행 결과를 취합해 성공/실패 보고 |

## 4. 작업 상태 머신

작업 하나는 `agent_tasks` 표의 한 줄이고, `status` 컬럼이 아래 8개 값 중 하나다.

```
PLANNING ──→ VALIDATING ──쓰기 있음──→ PENDING ──승인──→ APPROVED ──→ EXECUTING ──→ COMPLETED
   ↑              │  └──읽기만(AUTO_APPROVED)──────────────↗                │
   │              └─ 검증 실패 ──→ FAILED ←── 만료·취소·반려 3회 초과 ←─────┤ 오류 → 역순 원복
   │                                 │반려                                  │ 중단(2분) → 알림만
   └── 사유 답장(feedback) ← REJECTED ←┘
```

| 상태 | 의미 | 다음 상태 | 전환 조건 |
| --- | --- | --- | --- |
| `PLANNING` (기본값) | 초안 계획서 작성 중 | `VALIDATING` / `FAILED` | 초안 완료 / 5분 넘게 기록 없음 → `STALLED`(알림, 실행된 것 없음) |
| `VALIDATING` | 크로스체크 검증 중 | `PENDING` / `APPROVED` / `FAILED` | 쓰기 단계가 있으면 결재 대기 / 읽기 전용이면 자동 승인(`AUTO_APPROVED`, 일정 자동 작업은 제외 — 항상 결재) / 검증 실패, 5분 넘게 기록 없음(`STALLED`). (되묻기는 3단계 AI 계획에서) |
| `PENDING` | 결재 대기 (`expires_at`까지) | `APPROVED` / `REJECTED` / `FAILED` | [승인] / [반려] / 만료 |
| `APPROVED` | 승인됨, 실행 전 | `EXECUTING` | 실행기가 `plan_hash`를 다시 확인한 뒤 시작 |
| `REJECTED` | 반려됨, 사유 답장 대기 | `PLANNING` / `FAILED` | 사유 답장 → `feedback` 저장 후 재계획 / "취소" 답장, 반려 4번째(3회 초과), 30분 무응답 |
| `EXECUTING` | 승인된 계획 실행 중 | `COMPLETED` / `FAILED` | 전 단계 성공 / 오류 → 실행한 쓰기 단계를 역순으로 원복 / 2분 넘게 기록 없음 → `INTERRUPTED`(자동 원복 없이 알림) |
| `COMPLETED` | 완료 (끝) | 없음 | |
| `FAILED` | 실패·원복 완료, 만료, 반려 3회 초과 (끝) | 없음 | 사유는 `event_logs`에 기록 |

- 만료는 별도 상태 없이 `FAILED`로 처리하고, `event_logs`에 `EXPIRED` 사유를 남긴다.
- 봇에 메시지가 올 때마다, 그리고 4단계부터는 크론(`/api/agent-cron`, 1분마다)이 남은 작업(만료된 `PENDING`, 30분 넘은 `REJECTED`, 2분 넘게 멈춘 `EXECUTING`, 5분 넘게 멈춘 `PLANNING`·`VALIDATING`)을 정리한다.
- 반려 사유는 봇이 보낸 `force_reply` 메시지에 단 답장으로 받는다. 그 메시지 번호를 `event_logs`의 `REASON_REQUESTED`에 적어 두어 세션 표 없이 작업을 찾는다.
- 오류는 서버 로그에만 두지 않고 텔레그램에 "원인 한 줄"로 알린다(`errors.js`). 키·토큰 같은 비밀 값은 넣지 않는다.
- 쓰기 단계가 연결 끊김·5xx로 실패하면 저장됐는지 알 수 없으므로 원복 대상에 넣지 않고 `STEP_UNCERTAIN`으로 기록, 보고에 "⚠️ 확인 필요"를 붙인다.
- 모든 `event_logs` 기록에는 `agent`(누가: `captain` `intake` `orchestrator` `main` `crosscheck` `executor`)가, 실행 단계 기록에는 `dept`(어느 부서)가 붙는다. 계획의 각 단계에도 `dept`가 있다(레지스트리 값, AI가 정하지 않음).
- 상의(`VALIDATING` 안): 코드 검사 → 크로스체크 의견 → 이의면 메인이 고침(최대 2회) → 결과를 계획의 `review`(`off`·`agreed`·`unresolved`·`timeout`·`error`)에 붙여 결재. 이견·시간 부족·오류가 남으면 읽기 전용이어도 결재를 받는다. 시간 예산 기본 50초.
- AI를 부를 때마다 사용량(`usage`: 모델, 입력·출력 토큰)을 그 기록(`PLANNED`, `PLAN_REVISED`, `NEEDS_INFO`, `CROSSCHECK_*`)에 남긴다. 계획(해시 대상)에는 넣지 않는다.
- 운영 명령은 AI를 부르지 않는다(`commands.js`): `/help`(`/start`) 사용법·부서·지금 설정, `/pending` 대기 작업 목록과 버튼·답장 칸 다시 보내기, `/cancel` 결재·사유 대기 작업 모두 취소(실행 중은 그대로).
- `event_logs`의 사건 이름: `CROSSCHECK_AGREED` `CROSSCHECK_OBJECTION` `CROSSCHECK_ERROR` `PLAN_REVISED` `PLAN_REVISE_FAILED` `CONFIG_ERROR` `CREATED` `NEEDS_INFO` `PLAN_FAILED` `STEP_UNCERTAIN` `PLANNED` `VALIDATED` `VALIDATION_FAILED` `AUTO_APPROVED` `APPROVED` `REJECTED` `REASON_REQUESTED` `REPLANNING` `CANCELLED` `REJECT_LIMIT` `REASON_TIMEOUT` `EXPIRED` `HASH_MISMATCH` `SEND_FAILED` `EXECUTE_START` `STEP_START` `STEP_DONE` `STEP_FAILED` `UNDO_DONE` `UNDO_STEP_FAILED` `ROLLED_BACK` `UNDO_FAILED` `COMPLETED` `INTERRUPTED` `STALLED` `MISSED`
- 상태 전환은 모두 "이 상태일 때만 바꾼다"는 조건부 업데이트로 한다. 버튼을 두 번 눌러도 한 번만 실행된다.

## 5. 역할

- **메인 에이전트**: 계획 작성(2단계)과 보고(7단계). 도구를 직접 실행하지 않는다.
- **크로스체크 에이전트**: 계획을 검증한다. 코드 검사(항상, 규칙 위반은 거부)와 크로스체크 에이전트의 의견(선택, 메인과 상의)으로 나뉜다.
- **실무 에이전트(실행기)**: 승인된 계획을 레지스트리의 도구로 순서대로 실행한다. 계획에 없는 도구는 호출할 수 없다.
- **부서**: 도구와 접근 구역을 묶은 단위. `depts/<부서>/` 폴더 하나 + `depts/index.js` 한 줄로 추가한다(`rules/dept_template.md`).

## 6. 도구와 위험도

| 위험도 | 의미 | 결재 |
| --- | --- | --- |
| `read` | 조회·검색 (상태 변경 없음) | 불필요 |
| `write` | DB 등록·수정·삭제 | 필수. 되돌리는 방법(`undo`)을 함께 정의 |
| `irreversible` | 되돌릴 수 없는 외부 호출 (예: 외부로 메시지 발송) | 필수. 결재 요약에 경고 표시 |

캡틴에게 보내는 결재·보고 메시지 자체는 결재 대상이 아니다.

## 7. 설계 원칙

1. **결재는 확정된 계획에 묶는다.** 계획은 `{도구, 인자, 위험도}` 목록(JSON)이며 해시를 저장한다. 실행 직전에 해시를 다시 확인한다.
2. **실행은 코드가 한다.** LLM은 계획만 만들고, 승인된 계획의 실행에는 관여하지 않는다.
3. **읽기는 자동, 쓰기는 결재.**
4. **원복은 도구마다 정의한다.** 등록→삭제, 수정→이전 값 복원, 삭제→삭제 전 스냅샷.
5. **중복을 막는다.** 텔레그램 `update_id` 기록, 조건부 상태 전환.
6. **범위를 제한한다.** 내 채팅 ID에서 온 메시지·버튼만 처리, 모든 쿼리에 `user_id` 강제(서비스 롤 키는 RLS를 우회하므로).
7. **외부에서 가져온 텍스트는 데이터다.** 지시로 해석하지 않는다.

## 8. 데이터 모델 (`agent_tasks`)

SQL: `supabase/migrations/20261026000000_create_agent_tasks.sql`. 서비스 롤 키로만 접근한다. (RLS는 켜고 정책은 만들지 않는다.)

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid (PK) | 기본값 `gen_random_uuid()` |
| `task_query` | text, NOT NULL | 캡틴의 원본 지시 |
| `status` | text, NOT NULL | 위 8개 상태만 허용 (CHECK), 기본값 `PLANNING` |
| `plan_payload` | jsonb, NOT NULL | 메인 에이전트의 계획 `{도구, 인자, 위험도}` 목록. JSON 객체만 허용, 기본값 `{}` |
| `plan_hash` | text | 승인한 계획과 실행할 계획이 같은지 확인하는 해시 |
| `feedback` | text | 반려 시 캡틴의 피드백 |
| `reject_count` | integer, NOT NULL | 반려 횟수 (0 이상, 기본값 0) |
| `event_logs` | jsonb, NOT NULL | 단계별 시각·결과 로그. JSON 배열만 허용, 기본값 `[]` |
| `source_update_id` | bigint, UNIQUE | 지시를 보낸 텔레그램 `update_id`. 같은 메시지의 재전송으로 작업이 중복 생성되는 것을 막는다 |
| `source_key` | text, UNIQUE | 일정 자동 작업 키 `schedule:<일정 id>:<날짜>T<시각>`. 크론 호출이 겹쳐도 한 번만 만든다 (4단계 SQL `20261030000000`) |
| `expires_at` | timestamptz | 결재 대기 만료 시각 |
| `created_at` | timestamptz, NOT NULL | 기본값 `now()` |
| `updated_at` | timestamptz, NOT NULL | 기본값 `now()`, 수정 시 트리거가 자동 갱신 |

인덱스: `(status, created_at desc)`, `PENDING` 상태의 `expires_at`(만료 점검용 부분 인덱스).

## 9. 파일 구조

```
agent_architecture.md            이 문서
api/
  webhook.js                     스위치(AGENT_MODE)가 꺼져 있으면 echo, 켜져 있으면 approval.js로 연결
  agent-cron.js                  일정 자동 작업 크론 입구 (pg_cron 1분마다, CRON_SECRET 검증 → 남은 작업 정리 → 자동 작업 1개)
  _agents/
    approval.js                  텔레그램 입구: 새 지시 · [승인]/[반려] 버튼 · 반려 사유 답장 · 운영 명령 분기
    commands.js                  운영 명령 /help /pending /cancel (AI 호출 없음)
    orchestrator.js              PLANNING→VALIDATING(상의)→PENDING/자동 승인, 시간 예산, 남은 작업 정리
    scheduleTrigger.js           일정 자동 작업: 때가 된 일정 찾기, source_key, 놓친 작업(MISSED), planAndRoute 호출
    agents.config.js             역할별 설정: 메인·크로스체크 프로그램 자리, 모델, 시간 한도, 상의 횟수. 순서: 저장값(agent_settings) → 환경변수 → 기본값
    settings.js                  agent_settings(한 줄) 읽기·저장, 고를 수 있는 프로그램·모델 허용 목록
    planner.js                   메인 에이전트: 프로그램(anthropic|test) 선택, Anthropic 계획 작성(규칙서·라우팅 자리·상의 반영)
    crosscheck.js                크로스체크 에이전트: 프로그램(off|test|anthropic) 선택, 의견 형식 정리, Anthropic 검토 프로그램
    plan.js                      계획 해시 · 테스트 계획 작성기(낱말 시나리오) · 결재 요약
    owner.js                     대시보드 주인 user_id (AGENT_USER_ID 또는 Auth 사용자 1명 자동)
    validator.js                 크로스체크의 코드 검사: 등록 도구, 위험도·부서 표기, 인자, 원복 정의, 5단계 한도
    executor.js                  승인된 계획 실행 · 실패 시 역순 원복
    registry.js                  depts/index.js의 부서들로 도구·부서 목록을 자동으로 만듦
    depts/
      index.js                   등록된 부서 목록 (새 부서는 여기 한 줄)
      schedule/                  일정 부서: index.js(등록 정보) · tools.js(schedule.list, schedule.create) · rules.md
      invest/                    투자 부서(조회만): tools.js(invest.quote·chart_summary·news·disclosures·brief) · rules.md
                                 resolve.js(종목 찾기) · format.js(기준 시각·구형 데이터 경고) · providers/(none·sample·stockview)
      agents/                    에이전트 설정 부서: agents.set_matching (매칭 변경, 결재)
      test/                      테스트 팀: 가짜 도구 3개 (규칙서 없음)
    report.js                    텔레그램 문장 템플릿 (결재 요청·결과 보고·검증 실패·중단 알림)
    errors.js                    오류 → 텔레그램에 보일 원인 한 줄 (비밀 값 제외)
    rules.js                     규칙서 로더 (vercel.json includeFiles로 배포에 포함)
    tasks.js / supabase.js       agent_tasks 읽기·조건부 전환·로그 추가
    telegram.js                  텔레그램 호출 (메시지 번호 반환, force_reply)
    testkit.js, *.test.js        가짜 Supabase·텔레그램과 자동 테스트
    rules/
      global_rules.md            전사 공통 규칙
      dept_template.md           부서별 규칙 템플릿 (새 부서 만드는 순서 포함)
```

## 10. 켜고 끄기

환경변수 `AGENT_MODE=on`일 때만 에이전트 경로가 동작한다. 기본은 꺼짐이며, 꺼져 있으면 지금처럼 echo 응답만 한다.
`AGENT_MODE=on`이면 `TELEGRAM_WEBHOOK_SECRET`이 **필수**다. setWebhook의 `secret_token`과 같은 값이어야 하고, 없으면 에이전트는 요청을 처리하지 않는다(위조 승인 방지).

2단계 현재 `on` 상태의 동작(테스트 도구 모드): 지시 문구의 낱말로 가짜 계획을 고른다. 실제 데이터는 바뀌지 않는다.

| 지시에 든 낱말 | 계획 | 흐름 |
| --- | --- | --- |
| "조회" | 테스트 조회(read) 1단계 | 결재 없이 바로 실행 → 완료 보고 |
| (없음) | 테스트 쓰기(write) 1단계 | 결재 → 승인 시 실행 → 완료 보고 |
| "실패" | 테스트 쓰기 → 실패하는 테스트 쓰기 | 결재 → 승인 → 2단계 실패 → 1단계 원복 → 실패 보고 |
| "원복실패" | 위와 같되 원복도 실패 | 결재 → 승인 → 실패 → 원복 실패 경고 |

반려하면 사유를 답장으로 받아 같은 작업을 다시 계획한다(사유에 위 낱말이 있으면 그 시나리오로 바뀐다).

3단계부터: `ANTHROPIC_API_KEY`가 있으면 위 표 대신 **AI 계획 작성기**가 쓰인다(`AGENT_PLANNER=test`로 되돌릴 수 있음).

- AI는 규칙서(전사 공통 + 일정 부서)와 도구 목록, 현재 한국 시각을 받고 `submit_plan` 도구로만 답한다. 실행하지 않는다.
- 위험도는 AI가 아니라 레지스트리 값을 코드가 채운다. 검증기가 인자·도구를 다시 검사한다.
- 모호하면 AI가 되묻고(`NEEDS_INFO`), 작업은 닫힌다. 캡틴이 내용을 보태 다시 보낸다.
- 일정 도구는 모든 조회·등록·삭제에 주인 `user_id` 조건을 코드가 붙인다.
- 롤백 확인: 지시에 "실패 테스트"를 넣으면 AI가 `test.fail_write`를 마지막 단계로 붙인다 → 등록한 일정이 삭제(원복)된다.
- 웹훅 함수 최대 실행 시간 60초(`vercel.json`). 계획·상의는 시간 예산 50초 안에서, 메인 호출은 최대 30초, 크로스체크 호출은 최대 15초. 시간 한도가 있는 AI 호출은 자동 재시도를 끈다(`maxRetries: 0`, 재시도하면 한도의 두 배가 걸려 함수 시간을 넘길 수 있음). 그래도 함수가 끊겨 PLANNING·VALIDATING에 남은 작업은 다음 메시지 때 5분 기준으로 정리한다.

역할별 프로그램(`agents.config.js`): 5단계부터는 텔레그램 결재로 바꾼 저장값(`agent_settings`)이 먼저이고, 비어 있는 칸은 Vercel 환경변수 `AGENT_PROGRAM_MAIN`(anthropic|test), `AGENT_MODEL_MAIN`, `AGENT_PROGRAM_CROSSCHECK`(off|test|anthropic), `AGENT_MODEL_CROSSCHECK`을 쓴다. 그 밖의 시간 설정: `AGENT_PLANNING_BUDGET_MS`. 상의 흐름 확인: `AGENT_PROGRAM_CROSSCHECK=test`로 두고 지시에 "이의 테스트"(한 번 이의 → 고친 뒤 동의) 또는 "이의 유지 테스트"(끝까지 이견)를 넣는다.

사용량 합계 (SQL Editor):

```sql
select e->>'agent' as agent, e->'usage'->>'model' as model, count(*) as calls,
       sum((e->'usage'->>'input_tokens')::int) as input_tokens, sum((e->'usage'->>'output_tokens')::int) as output_tokens
from public.agent_tasks, jsonb_array_elements(event_logs) e
where e ? 'usage' group by 1, 2 order by 1, 2;
```

테스트: `npm run test:agents` (가짜 Supabase·텔레그램, 외부 패키지 없음)

## 10-1. 역할 배정표

| 역할 | 파일 | 하는 일 | 할 수 없는 일 | AI |
| --- | --- | --- | --- | --- |
| 입구(접수) | `webhook.js`, `approval.js` | 텔레그램 수신, 시크릿·주인 확인, 새 지시·버튼·반려 사유 분배, 오류 알림 | 계획·실행 | 코드 |
| 오케스트레이터 | `orchestrator.js` | 상태 전환, 계획→검증→결재/자동 승인 분기, 남은 작업 정리 | 도구 직접 실행 | 코드 |
| 메인 에이전트(계획) | `planner.js` (테스트용 `plan.js`) | 규칙서에 맞는 JSON 계획, 모호하면 되묻기, 크로스체크 의견 반영 | 실행, 위험도·부서 결정 | **프로그램 자리** (지금 Anthropic) |
| 크로스체크(검증·상의) | `validator.js`(코드 검사), `crosscheck.js`(에이전트) | 규칙 검사, 계획에 의견·이의 | 계획 직접 수정 | 코드 + **프로그램 자리** (꺼짐·테스트·Anthropic 중 결재로 선택, 처음은 꺼짐) |
| 실무 에이전트(실행) | `executor.js` | 승인된 계획 실행, 역순 원복, 확인 필요 표시 | 계획에 없는 도구 호출 | 코드 |
| 부서(도구·규칙) | `depts/<부서>/`, `registry.js` | 부서별 도구와 원복, 부서 규칙 | 다른 부서 데이터 | 코드 |
| 보고 | `report.js`, `errors.js` | 결재 요청·결과·오류 문장 | 결과에 없는 내용 | 코드 |
| 공용 기반 | `tasks.js`, `supabase.js`, `telegram.js`, `owner.js`, `rules.js`, `agents.config.js` | 작업 기록, DB·텔레그램 호출, 주인 id, 규칙서 읽기, 역할 설정 | — | 코드 |

## 11. 단계별 계획

| 단계 | 작업 | 완료 기준 |
| --- | --- | --- |
| 0 | 규칙서 3개 작성 | 문서 검토 완료 |
| 1 | (1a) `agent_tasks` SQL — **Supabase 실행 완료** / (1b) 웹훅의 `callback_query` 수신과 `update_id` 중복 방지 — **배포·실제 확인 완료** | 가짜 입력으로 상태가 바뀌고 기존 echo는 그대로 |
| 2 | 오케스트레이터 뼈대와 스위치 — **폰 확인 완료** | 모의 텔레그램으로 지시→계획→검증→결재→실행→보고 전 경로, 반려·만료·중복 경로 테스트 통과 |
| 3 | 첫 부서(일정)·도구, 실제 LLM — **폰 확인 완료** | 자연어 지시 → AI 계획 → 결재 → 실제 일정 등록, 실패 시 삭제 원복 |
| 뼈대 마무리 | 웹훅 시크릿 필수, 오류 알림·원인 한 줄, 확인 필요 표시, 문서 정리 — **구현·자동 테스트 64개 통과** | 위조 요청 무시, 오류가 텔레그램에 보임 |
| 배정 준비(필수) | 부서 플러그인, 역할별 프로그램 자리, 작업 기록 agent·dept, 메인↔크로스체크 상의, 시간 예산 — **구현·자동 테스트 84개 통과** | 동작은 그대로, 상의는 `AGENT_PROGRAM_CROSSCHECK=test`로 확인 |
| 배정 준비(권장) | AI 사용량 기록, 운영 명령 `/help` `/pending` `/cancel` — **구현·자동 테스트 92개 통과** | 명령이 AI 없이 동작, 사용량이 기록에 남음 |
| 4 | 일정 도래 시 자동 계획·결재 요청 (pg_cron → `/api/agent-cron`, 크론 호출 시크릿 검증, 일정 입력 "에이전트 작업" 칸) — **완료**: 자동 테스트 110개 통과, 실제 환경(10/30)에서 🔔 알림 → 결재 → 승인 → 일정 조회 완료 확인. 안내 문구 3건(되묻기·규칙 번호·데이터 변경 경고) 정리 | 일정 10분 전에 🔔 결재 요청이 오고, 승인하면 실행, 같은 일정으로 두 번 오지 않음 |
| 5 (마지막) | 에이전트 프로그램 매칭을 결재로: 에이전트 설정 부서(`agents.set_matching`), `agent_settings` 표(SQL `20261031000000`), Anthropic 크로스체크 프로그램 — **완료**: 자동 테스트 123개 통과, 실제 환경(10/31)에서 결재로 매칭 변경 확인 | 텔레그램으로 "메인을 Opus 5.5로 바꿔줘" → 결재 → ✅ → `/help`에 반영, 같은 방법으로 원복 |
| 투자 부서 | StockView 기준 조회 부서: 시세·차트 요약·뉴스·공시·시장 브리핑, 데이터 공급자 자리(`INVEST_PROVIDER`: none·sample·stockview, `STOCKVIEW_URL`), 기본값(차트 3개월·뉴스/브리핑 오늘), 24시간 구형 데이터 경고, market_type(US/KR) — **구현·자동 테스트 136개 통과**, 실제 확인은 sample부터 | 텔레그램 "삼성전자 지금 얼마야?"·"시장 브리핑 해줘" → 결재 없이 보고, 🧪 예시 표시 |

## 12. 열린 항목

- 부서 이름과 권한 범위 (데이터를 채울 때 정한다)
- 프로그램을 정한 뒤 상의 시간이 모자라면 `waitUntil`(텔레그램에 먼저 답하고 뒤에서 처리)로 바꿀지 검토
- 실행 중단(`INTERRUPTED`) 때의 원복은 사람 확인 후 수동. 실제 도구를 붙일 때 단계별 재개·원복 방식을 다시 검토
