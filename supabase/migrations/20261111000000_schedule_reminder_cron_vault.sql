-- 일정 시각 알림 예약(schedule-reminders)을 금고(Vault)의 cron_secret으로 다시 건다.
-- 20261023010000_schedule_reminder_cron.sql 을 대신한다. 그 파일은 시크릿을 직접 적는 방식이라
-- 따옴표가 어긋나 매분 문법 오류가 나거나, 값이 Vercel과 달라 401이 났다 (2026-11-11).
--
-- 실행 순서: 20261030000000_schedule_agent_tasks.sql 다음 (그 파일이 금고에 cron_secret을 넣는다).
-- 바꿀 곳 없음: 시크릿은 금고에서 꺼내고, 주소가 https://lee-0011.vercel.app 이 아니면 그것만 바꾼다.
-- 같은 이름으로 다시 걸면 기존 예약을 덮어쓰므로 여러 번 실행해도 안전하다.
--
-- 되돌리기 (알림을 끄고 싶을 때만):
--   select cron.unschedule('schedule-reminders');
--
-- 실행 뒤 확인 (1~2분 뒤):
--   select status_code, left(content::text, 80) as content, created
--   from net._http_response order by created desc limit 4;
--   → 200 {"checked":…,"sent":…,"skipped":…} 줄이 보이면 OK, 401이면 금고 값과 Vercel CRON_SECRET이 다름

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'schedule-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://lee-0011.vercel.app/api/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := jsonb_build_object()
  );
  $$
);
