-- 업무 탭 상세 편집: 회의 기록의 고친 내용과 고친 시각.
-- Plaud가 준 원본 요약(summary_md)은 그대로 두고, 대시보드에서 고친 내용은 content(블록 에디터 형식)에 따로 저장한다.
-- edited_at이 있으면 텔레그램 "원복"이 이 회의를 지우지 않는다 (고친 내용을 잃지 않게).
--
-- 실행 순서: 20261113000000_dev_log.sql 다음. 여러 번 실행해도 안전하다. 바꿀 곳 없음.
-- 화면은 기존 정책("own rows only", 내 것 읽기·쓰기)으로 저장한다.
--
-- 되돌리기 (필요할 때만):
--   alter table public.work_meetings drop column if exists content, drop column if exists edited_at;

alter table public.work_meetings add column if not exists content jsonb;
alter table public.work_meetings add column if not exists edited_at timestamptz;
