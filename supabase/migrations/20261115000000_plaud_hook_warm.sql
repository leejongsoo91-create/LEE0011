-- Plaud 입구(/api/plaud-hook)를 5분마다 깨워 둔다.
-- 무료 Zapier의 Code 단계는 0.8초 안에 응답을 받아야 하는데, 함수가 잠들어 있으면 깨어나는 데(콜드 스타트) 그보다 오래 걸릴 수 있다.
-- 깨우기 호출은 비밀 값 없이 GET만 보낸다 → 입구가 405로 바로 끝내고 DB는 부르지 않는다.
--
-- 실행 순서: 20261112000000_work_meetings_plaud.sql 다음. 바꿀 곳 없음 (주소가 https://lee-0011.vercel.app 이 아니면 그것만 바꾼다).
-- 같은 이름으로 다시 걸면 기존 예약을 덮어쓰므로 여러 번 실행해도 안전하다.
--
-- 되돌리기 (깨우기를 끄고 싶을 때만):
--   select cron.unschedule('plaud-hook-warm');
--
-- 실행 뒤 확인 (5분 뒤):
--   select status_code, created from net._http_response order by created desc limit 4;
--   → 405 줄이 보이면 OK (깨우기는 일부러 거절되는 호출이다)

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'plaud-hook-warm',
  '*/5 * * * *',
  $$
  select net.http_get(url := 'https://lee-0011.vercel.app/api/plaud-hook');
  $$
);
