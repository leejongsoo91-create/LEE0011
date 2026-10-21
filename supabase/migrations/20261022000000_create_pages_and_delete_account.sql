-- 1) 페이지 본문·제목 자동 저장용 테이블, 2) 내 계정 삭제 함수
-- 20261021000000, 20261021010000 파일을 먼저 실행한 뒤, 이 파일 전체를 SQL Editor에서 실행하세요.

-- 1) 페이지(Schedule/Work/Hobbies/Investments)마다 제목과 에디터 본문을 사용자별로 한 줄씩 저장
create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path text not null,
  title text not null default '',
  content jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, path)
);

alter table public.pages enable row level security;

drop policy if exists "own rows only" on public.pages;
create policy "own rows only" on public.pages for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) 로그인한 사용자가 자기 계정을 삭제한다. (work/hobbies/investments/schedule/pages의 내 데이터도 함께 삭제됨)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
