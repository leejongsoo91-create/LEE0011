-- 1분마다 Vercel의 /api/send-reminders 를 호출해, 알릴 시간이 된 일정을 텔레그램으로 보낸다.
-- 실행 전에 아래 두 곳을 내 값으로 바꾸세요.
--   1) https://lee-0011.vercel.app  → 내 사이트 주소
--   2) 여기에_CRON_SECRET           → Vercel 환경변수 CRON_SECRET 과 똑같은 값
-- 확장(pg_cron, pg_net)이 SQL로 켜지지 않으면 Supabase > Database > Extensions 에서 켠 뒤 다시 실행하세요.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'schedule-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://lee-0011.vercel.app/api/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '여기에_CRON_SECRET'),
    body := '{}'::jsonb
  );
  $$
);

-- 알림을 끄고 싶을 때:  select cron.unschedule('schedule-reminders');
