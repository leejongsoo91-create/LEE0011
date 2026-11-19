-- 중앙관제 개발 팀 "작업 단위" 기록 (보고서 12 1단계).
-- 작업 단위 = 보고서 한 단계(보통 커밋 하나): 왜 했나 · 무엇을 바꿨나 · 바뀐 파일과 줄 수 · 커밋 · 보고서 링크.
-- 흐름: 노트북 Claude Code → scripts/dev-work.mjs · dev-log.mjs → /api/dev-log (DEV_LOG_SECRET) → dev_work · dev_log → 중앙관제가 읽음(RLS)
-- 작업 번호·분야·상태는 한글로 저장한다: 작업 번호 '보고서11-2' · '수정-20261120-1', 분야 '화면' 등, 상태 '진행 중' 등.
-- 코드 본문은 저장하지 않는다 (파일 경로·줄 수·커밋 해시만. 코드는 GitHub 커밋에서 본다).
--
-- 실행 순서: 20261113000000_dev_log.sql 다음. 여러 번 실행해도 안전하다. 바꿀 곳 없음.
--
-- 되돌리기 (필요할 때만. 작업 단위 기록이 모두 지워진다. 같은 내용은 git 커밋 메시지에 남아 있다):
--   drop table if exists public.dev_work;
--   drop index if exists public.dev_log_user_work_idx;
--   alter table public.dev_log drop column if exists work_key;
--   select cron.schedule('dev-log-cleanup', '15 3 * * *', $$delete from public.dev_log where created_at < now() - interval '30 days'$$);

-- [A] 작업 단위: 내 계정 안에서 작업 번호 하나에 한 줄
create table if not exists public.dev_work (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  work_key text not null check (work_key ~ '^(보고서[0-9]{1,3}(-[0-9]{1,2})?|수정-[0-9]{8}-[0-9]{1,3})$'),
  title text not null check (char_length(title) between 1 and 200),
  reason text check (reason is null or char_length(reason) <= 1000),
  changes text check (changes is null or char_length(changes) <= 2000),
  areas text[] not null default '{}'
    check (areas <@ array['화면', '에이전트', 'DB', '보안', '개발도구', '문서', '설정']::text[]),
  files jsonb not null default '[]'::jsonb
    check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 300),
  commits text[] not null default '{}' check (cardinality(commits) <= 50),
  report_url text check (report_url is null or (char_length(report_url) <= 300 and report_url ~ '^https://claude\.ai/')),
  status text not null default '진행 중' check (status in ('진행 중', '완료', '되돌림')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, work_key)
);

create index if not exists dev_work_user_started_idx on public.dev_work (user_id, started_at desc);

-- 화면(로그인한 사용자)은 자기 기록을 읽기만 한다. 쓰기·지우기는 서버(서비스 롤 키)만.
alter table public.dev_work enable row level security;
drop policy if exists "own rows read only" on public.dev_work;
create policy "own rows read only" on public.dev_work for select to authenticated
  using (auth.uid() = user_id);

-- [B] 한 줄 기록(dev_log)을 작업 단위에 묶는 칸. 비어 있어도 된다 (예전 기록, 작업과 상관없는 점검).
alter table public.dev_log add column if not exists work_key text;
alter table public.dev_log drop constraint if exists dev_log_work_key_length;
alter table public.dev_log add constraint dev_log_work_key_length
  check (work_key is null or char_length(work_key) between 1 and 40);
create index if not exists dev_log_user_work_idx on public.dev_log (user_id, work_key);

-- [C] 보관 5년: 매일 새벽 3시 15분(UTC, 한국 12시 15분)에 5년 지난 한 줄 기록과 작업 단위를 지운다.
-- 같은 이름(dev-log-cleanup)이라 예전 30일 작업을 덮어쓴다.
create extension if not exists pg_cron;
select cron.schedule(
  'dev-log-cleanup',
  '15 3 * * *',
  $$delete from public.dev_log where created_at < now() - interval '5 years';
    delete from public.dev_work where started_at < now() - interval '5 years'$$
);
