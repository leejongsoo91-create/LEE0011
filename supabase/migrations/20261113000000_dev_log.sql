-- 업무 탭 "개발 팀" 현황판: Lead Coder · QA/Reviewer · DevOps/Monitor의 작업 기록.
-- 흐름: 노트북 Claude Code → scripts/dev-log.mjs → /api/dev-log (DEV_LOG_SECRET) → dev_log → 업무 탭이 읽음(RLS)
-- 각 에이전트의 "지금 상태"는 따로 저장하지 않고, 가장 최근 기록에서 화면이 계산한다.
--
-- 실행 순서: 20261112000000_work_meetings_plaud.sql 다음. 여러 번 실행해도 안전하다.
-- 바꿀 곳 없음 (비밀 값은 Vercel 환경변수 DEV_LOG_SECRET과 노트북 사용자 환경변수에만 넣는다).
--
-- 되돌리기 (필요할 때만):
--   select cron.unschedule('dev-log-cleanup');
--   drop table if exists public.dev_log;

-- [A] 작업 기록: 한 단계 = 한 줄. 요약은 한 줄(300자)만, 비밀 값·코드 본문·녹취록은 넣지 않는다.
create table if not exists public.dev_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  agent text not null check (agent in ('lead', 'qa', 'devops')),
  kind text not null check (kind in ('plan', 'edit', 'test', 'review', 'commit', 'deploy', 'check')),
  status text not null check (status in ('running', 'pass', 'fail', 'info')),
  summary text not null check (char_length(summary) between 1 and 300),
  ref text check (ref is null or char_length(ref) between 1 and 300),
  created_at timestamptz not null default now()
);

create index if not exists dev_log_user_created_idx on public.dev_log (user_id, created_at desc);

-- 화면(로그인한 사용자)은 자기 기록을 읽기만 한다. 쓰기·지우기는 서버(서비스 롤 키)만.
alter table public.dev_log enable row level security;
drop policy if exists "own rows only" on public.dev_log;
drop policy if exists "own rows read only" on public.dev_log;
create policy "own rows read only" on public.dev_log for select to authenticated
  using (auth.uid() = user_id);

-- [B] 보관 30일: 매일 새벽 3시 15분(UTC, 한국 12시 15분)에 지난 기록을 지운다. 같은 이름이면 덮어쓴다.
create extension if not exists pg_cron;
select cron.schedule(
  'dev-log-cleanup',
  '15 3 * * *',
  $$delete from public.dev_log where created_at < now() - interval '30 days'$$
);
