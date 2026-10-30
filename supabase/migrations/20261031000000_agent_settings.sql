-- 5단계: 에이전트 프로그램 매칭을 저장하는 표 (텔레그램 결재로 바꾼다).
-- 메인·크로스체크가 어떤 프로그램/모델을 쓸지 한 줄로 저장한다. 비어 있는(null) 칸은 Vercel 환경변수 기본값을 쓴다.
--
-- 실행 순서: 20261030000000_schedule_agent_tasks.sql 다음. 여러 번 실행해도 안전하다. 바꿀 곳 없음.
-- RLS를 켜고 정책을 만들지 않는다 = 브라우저(anon/로그인 사용자)는 읽고 쓸 수 없고, 서버의 서비스 롤 키로만 접근한다.
--
-- 되돌리기 (필요할 때만):
--   drop table if exists public.agent_settings;   -- 지우면 환경변수 기본값으로 돌아간다

create table if not exists public.agent_settings (
  id                 int primary key default 1 check (id = 1),  -- 항상 한 줄
  main_program       text check (main_program is null or main_program in ('anthropic', 'test')),
  main_model         text check (main_model is null or char_length(main_model) between 1 and 100),
  crosscheck_program text check (crosscheck_program is null or crosscheck_program in ('off', 'test', 'anthropic')),
  crosscheck_model   text check (crosscheck_model is null or char_length(crosscheck_model) between 1 and 100),
  updated_at         timestamptz not null default now()
);

alter table public.agent_settings enable row level security;

-- 확인:
--   select * from public.agent_settings;   -- 처음에는 0건이어도 정상 (환경변수 기본값 사용)
