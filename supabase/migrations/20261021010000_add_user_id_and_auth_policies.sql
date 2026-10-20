-- 사용자 인증(Auth): 4개 테이블에 user_id를 추가하고, 본인 데이터만 접근하도록 제한한다.
-- 먼저 20261021000000_create_core_tables.sql 을 실행한 뒤, 이 파일 전체를 SQL Editor에서 실행하세요.
-- 참고: user_id가 비어 있는 기존 행(인증 도입 전에 넣은 테스트 데이터)은 아무에게도 보이지 않습니다.
--       필요하면 Table Editor에서 지우거나 user_id를 직접 채워 주세요.

-- 1) user_id 컬럼 추가 (기본값 = 로그인한 사용자, 사용자가 삭제되면 데이터도 함께 삭제)
alter table public.work add column if not exists user_id uuid default auth.uid() references auth.users (id) on delete cascade;
alter table public.hobbies add column if not exists user_id uuid default auth.uid() references auth.users (id) on delete cascade;
alter table public.investments add column if not exists user_id uuid default auth.uid() references auth.users (id) on delete cascade;
alter table public.schedule add column if not exists user_id uuid default auth.uid() references auth.users (id) on delete cascade;

create index if not exists work_user_id_idx on public.work (user_id);
create index if not exists hobbies_user_id_idx on public.hobbies (user_id);
create index if not exists investments_user_id_idx on public.investments (user_id);
create index if not exists schedule_user_id_idx on public.schedule (user_id);

-- 2) 로그인 없이 접근할 수 있던 기존 정책 제거
drop policy if exists "anon full access" on public.work;
drop policy if exists "anon full access" on public.hobbies;
drop policy if exists "anon full access" on public.investments;
drop policy if exists "anon full access" on public.schedule;

-- 3) 로그인한 사용자가 자기 행만 읽고/추가/수정/삭제하도록 허용
create policy "own rows only" on public.work for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on public.hobbies for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on public.investments for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on public.schedule for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
