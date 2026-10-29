-- 4단계: 일정의 "에이전트 작업"과 그것을 1분마다 확인하는 크론.
-- 일정 시각이 다가오면 /api/agent-cron 이 에이전트 작업을 계획해 텔레그램으로 결재를 요청한다.
--
-- 실행 순서: 20261026000000_create_agent_tasks.sql 다음. 여러 번 실행해도 안전하다.
-- 실행 전에 바꿀 곳 2군데:
--   1) 아래 [B]의  여기에_CRON_SECRET  → Vercel 환경변수 CRON_SECRET과 똑같은 값 (32자 이상)
--   2) 아래 [C]의  https://lee-0011.vercel.app  → 내 사이트 주소 (다르면)
-- 확장(pg_cron, pg_net, Vault)이 꺼져 있으면 Supabase > Database > Extensions 에서 켠 뒤 다시 실행한다.
--
-- 되돌리기 (필요할 때만):
--   select cron.unschedule('agent-schedule');
--   delete from vault.secrets where name = 'cron_secret';
--   alter table public.schedule drop column if exists agent_task, drop column if exists agent_before_min;
--   drop index if exists public.agent_tasks_source_key_key;
--   alter table public.agent_tasks drop column if exists source_key;

-- [A] 칸 추가 ---------------------------------------------------------------

-- agent_task       : 일정 시각에 에이전트가 할 일(지시 문장). 비어 있으면(null) 자동 작업 없음
-- agent_before_min : 일정 몇 분 전에 시작할지 (0 = 정시, 10, 30, 60)
alter table public.schedule add column if not exists agent_task text;
alter table public.schedule add column if not exists agent_before_min int not null default 10;

alter table public.schedule drop constraint if exists schedule_agent_task_length;
alter table public.schedule add constraint schedule_agent_task_length
  check (agent_task is null or char_length(agent_task) between 1 and 300);

alter table public.schedule drop constraint if exists schedule_agent_before_min_options;
alter table public.schedule add constraint schedule_agent_before_min_options
  check (agent_before_min in (0, 10, 30, 60));

-- 자동 작업이 있는 일정만 빠르게 찾기 위한 인덱스
create index if not exists schedule_agent_tasks_idx
  on public.schedule (date)
  where agent_task is not null;

-- source_key: 자동으로 만든 작업의 중복 방지 키 (예: schedule:<일정 id>:2026-10-30T17:00)
-- 같은 키로 두 번 만들려고 하면 DB가 두 번째를 받지 않는다. 텔레그램 지시는 null이라 영향이 없다.
alter table public.agent_tasks add column if not exists source_key text;
create unique index if not exists agent_tasks_source_key_key on public.agent_tasks (source_key);

-- [B] CRON_SECRET을 Vault에 보관 -------------------------------------------
-- 크론 명령에 비밀 값을 직접 쓰지 않는다. (cron.job 표를 봐도 값이 보이지 않게)
do $$
declare
  secret text := '여기에_CRON_SECRET';
  existing uuid;
begin
  if char_length(secret) < 32 then
    raise exception '여기에_CRON_SECRET 자리에 Vercel의 CRON_SECRET 값(32자 이상)을 넣고 다시 실행해 주세요';
  end if;
  select id into existing from vault.secrets where name = 'cron_secret';
  if existing is null then
    perform vault.create_secret(secret, 'cron_secret', '/api/agent-cron 호출 헤더 x-cron-secret');
  else
    perform vault.update_secret(existing, secret);
  end if;
end
$$;

-- [C] 1분마다 /api/agent-cron 호출 -------------------------------------------
-- 같은 이름으로 다시 실행하면 기존 작업을 덮어쓴다.
-- timeout 60초: AI가 계획을 세우는 동안 요청이 끊기지 않게 (기본값은 5초)
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'agent-schedule',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://lee-0011.vercel.app/api/agent-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- 확인:
--   select jobname, schedule, active from cron.job;                              -- agent-schedule 이 보이면 OK
--   select status_code, content from net._http_response order by created desc limit 5;  -- 200이면 OK, 401이면 시크릿 불일치
