-- 중앙관제 개발 창 "데이터 관리" 탭 (보고서 12 3단계): 숨김 칸.
-- 테스트·잘못 남긴 기록과 합쳐서 빈 작업을 지우지 않고 숨긴다. "숨긴 것 보기"에서 되살릴 수 있다.
-- 쓰기는 서버 입구 /api/dev-admin(로그인한 주인만, 서비스 롤 키)만 한다. 화면은 지금처럼 읽기만(RLS 그대로).
--
-- 실행 순서: 20261120000000_dev_work.sql 다음. 여러 번 실행해도 안전하다. 바꿀 곳 없음.
--
-- 되돌리기 (필요할 때만. 숨긴 표시만 사라지고 기록은 남는다):
--   alter table public.dev_log drop column if exists hidden;
--   alter table public.dev_work drop column if exists hidden;

alter table public.dev_log add column if not exists hidden boolean not null default false;
alter table public.dev_work add column if not exists hidden boolean not null default false;
