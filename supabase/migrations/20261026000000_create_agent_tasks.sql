-- agent_tasks: 결재 통제형 멀티 에이전트의 작업·결재·로그를 한 표에서 관리한다.
-- Supabase SQL Editor에 그대로 붙여넣고 Run 하면 된다. 두 번 실행해도 오류가 나지 않는다.

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  task_query text not null,
  status text not null default 'PLANNING'
    check (status in ('PLANNING', 'VALIDATING', 'PENDING', 'APPROVED', 'REJECTED', 'EXECUTING', 'COMPLETED', 'FAILED')),
  plan_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(plan_payload) = 'object'),
  plan_hash text,
  feedback text,
  reject_count integer not null default 0
    check (reject_count >= 0),
  event_logs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(event_logs) = 'array'),
  source_update_id bigint unique,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_tasks_status_idx
  on public.agent_tasks (status, created_at desc);

create index if not exists agent_tasks_pending_expiry_idx
  on public.agent_tasks (expires_at)
  where status = 'PENDING';

-- 레코드가 수정될 때마다 updated_at을 현재 시각으로 갱신한다.
create or replace function public.agent_tasks_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_tasks_set_updated_at on public.agent_tasks;
create trigger agent_tasks_set_updated_at
  before update on public.agent_tasks
  for each row
  execute function public.agent_tasks_set_updated_at();

-- RLS 활성화만 한다. 정책이 없으므로 서비스 롤 키(서버)만 접근할 수 있다.
alter table public.agent_tasks enable row level security;
