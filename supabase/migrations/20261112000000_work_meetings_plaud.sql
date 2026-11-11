-- 업무 탭 + Plaud 연동: 회의 기록 표, Plaud 받은함 표, 업무 카드에 회의·담당자·마감일 칸.
-- 흐름: Zapier(Plaud 요약 완료) → /api/plaud-hook → plaud_inbox → /api/agent-cron → 텔레그램 결재 → work_meetings + work
--
-- 실행 순서: 20261111000000_schedule_reminder_cron_vault.sql 다음. 여러 번 실행해도 안전하다.
-- 바꿀 곳 없음 (비밀 값은 Vercel 환경변수 PLAUD_HOOK_SECRET에만 넣는다).
--
-- 되돌리기 (필요할 때만, 이 순서로):
--   alter table public.work drop column if exists meeting_id, drop column if exists assignee, drop column if exists due_date;
--   drop table if exists public.work_meetings;
--   drop table if exists public.plaud_inbox;

-- [A] 회의 기록: 녹음 1건 = 1행. 요약(Markdown)만 저장하고 녹취록 전문·음성은 저장하지 않는다.
create table if not exists public.work_meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plaud_key text not null,
  title text not null check (char_length(title) between 1 and 200),
  recorded_at timestamptz,
  summary_md text not null default '' check (char_length(summary_md) <= 20000),
  todo_count int not null default 0 check (todo_count >= 0),
  created_at timestamptz not null default now()
);

-- 같은 녹음은 한 번만 (plaud_key = plaud:<시각·제목 해시>)
create unique index if not exists work_meetings_user_key on public.work_meetings (user_id, plaud_key);
create index if not exists work_meetings_user_recorded_idx on public.work_meetings (user_id, recorded_at desc);

alter table public.work_meetings enable row level security;
drop policy if exists "own rows only" on public.work_meetings;
create policy "own rows only" on public.work_meetings for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- [B] Plaud 받은함: Zapier가 보낸 녹음을 결재 작업으로 바꾸기 전까지 잠시 담아 둔다. (서버 전용, 정책 없음)
create table if not exists public.plaud_inbox (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  title text not null check (char_length(title) between 1 and 200),
  summary_md text not null default '' check (char_length(summary_md) <= 20000),
  recorded_at timestamptz,
  received_at timestamptz not null default now()
);

create index if not exists plaud_inbox_received_idx on public.plaud_inbox (received_at);

-- RLS만 켠다. 정책이 없으므로 서비스 롤 키(서버)만 읽고 쓸 수 있다.
alter table public.plaud_inbox enable row level security;

-- [C] 업무 카드: 어느 회의에서 나왔는지, 담당자, 마감일
alter table public.work add column if not exists meeting_id uuid references public.work_meetings (id) on delete set null;
alter table public.work add column if not exists assignee text;
alter table public.work add column if not exists due_date date;

alter table public.work drop constraint if exists work_assignee_length;
alter table public.work add constraint work_assignee_length
  check (assignee is null or char_length(assignee) between 1 and 100);

create index if not exists work_meeting_id_idx on public.work (meeting_id);
