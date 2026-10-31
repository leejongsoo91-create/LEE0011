# personal-dashboard

혼자 쓰는 개인 대시보드(업무·취미·투자·일정) + 텔레그램으로 지시하는 결재 통제형 멀티 에이전트.

- 배포: https://lee-0011.vercel.app (Vercel, `main` 푸시 시 자동 배포)
- 저장소: github.com/leejongsoo91-create/LEE0011
- 스택: Vite 7 · React 19 · Tailwind v4 · React Router 7 · BlockNote · Supabase(Postgres, Auth, RLS) · Vercel 함수 · Anthropic API

## 우리의 규칙 (가장 중요)

1. 작업 전에 **보고서**를 먼저 써서 올린다 (Claude 문서로). 범위·설계·파일·테스트·결정할 것·되돌리기를 담는다.
2. 사용자가 보고서를 고치고 **승인한 뒤에만** 작업한다. 승인 전에는 코드를 바꾸지 않는다.
3. 작업이 끝나면 결과를 보고하고(무엇을 바꿨나, 테스트, 사용자가 확인할 순서), 다음 단계 보고서를 제안한다.

## 폴더 지도

| 위치 | 내용 |
| --- | --- |
| `src/` | 대시보드 화면 (pages, components, hooks, lib, utils) |
| `api/` | Vercel 함수: `webhook.js`(텔레그램 입구), `agent-cron.js`(일정 자동 작업 크론), `send-reminders.js`·`notify-schedule.js`(일정 알림) |
| `api/_agents/` | 멀티 에이전트 (오케스트레이터, 메인·크로스체크, 실행기, 부서 `depts/`: 일정·투자·에이전트 설정·테스트, 규칙서 `rules/`) |
| `supabase/migrations/` | SQL. 사용자가 Supabase SQL Editor에서 직접 실행한다 |
| `agent_architecture.md` | 에이전트 설계 문서 (상태 머신, 역할, 파일 구조, 단계별 계획) |
| `docs/SPEC.md` | 대시보드 스펙 |

## 주요 명령어

- `npm run dev` — 로컬 개발 서버
- `npm run build` — 빌드 (화면을 바꿨으면 실행)
- `npm run test:agents` — 에이전트 자동 테스트 (가짜 Supabase·텔레그램·AI, 외부 호출 없음)
- `npm run test:hooks` — `.claude/hooks` 테스트

## 배포와 비밀 값

- 비밀 값(봇 토큰, 서비스 롤 키, ANTHROPIC_API_KEY, 시크릿)은 **Vercel 환경변수에만**. 채팅·코드·`VITE_` 접두사 금지. 목록은 `.env.example`.
- 이 작업 환경에서는 실제 Supabase·텔레그램·Vercel·Anthropic에 접속할 수 없다. 검증은 자동 테스트와 임시 Postgres로 하고, 실제 확인은 사용자에게 단계별 가이드로 맡긴다.
- 사용자는 폰과 노트북(Windows)으로 확인한다. 확인 가이드는 번호를 매겨 짧게.

## 작업 습관

- 코드 주석과 커밋 메시지는 한국어.
- 커밋 전에 관련 테스트를 모두 통과시킨다. 테스트 실행은 `test-runner` 에이전트에 맡길 수 있다.
- 주제별 규칙은 `.claude/rules/` (해당 폴더를 작업할 때 읽힌다): 에이전트 `agents.md`, 화면 `frontend.md`, DB `supabase.md`
- 절차는 `.claude/skills/`: 새 부서 추가 `add-department`, 배포 후 확인 `deploy-check`
- `.env` 파일과 이미 실행한 SQL 파일은 hook이 수정을 막는다 (`.claude/hooks/protect-files.mjs`).
