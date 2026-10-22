-- 일정에 시간과 알림 설정을 추가한다. (20261021000000 ~ 20261022000000 파일을 먼저 실행한 뒤 이 파일을 실행하세요)
-- time              : 일정 시각 (한국 시간 기준, 비워 두면 종일 일정)
-- remind_before_min : 몇 분 전에 알릴지 (0 = 정시, 10 = 10분 전, NULL = 알림 없음)
-- reminded_at       : 알림을 이미 보낸 시각 (같은 알림이 두 번 가지 않게 하는 표시)

alter table public.schedule add column if not exists time time;
alter table public.schedule add column if not exists remind_before_min int check (remind_before_min is null or remind_before_min >= 0);
alter table public.schedule add column if not exists reminded_at timestamptz;

-- 아직 알리지 않은 알림 일정만 빠르게 찾기 위한 인덱스
create index if not exists schedule_pending_reminders_idx
  on public.schedule (date)
  where remind_before_min is not null and reminded_at is null;
