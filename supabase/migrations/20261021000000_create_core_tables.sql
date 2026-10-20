-- Personal Dashboard: 핵심 테이블 4개 (데이터는 넣지 않는다)
-- Supabase 콘솔의 SQL Editor에 이 파일 전체를 붙여넣고 실행하세요.

create extension if not exists pgcrypto;

-- 업무/프로젝트
create table if not exists public.work (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  status text not null default 'Todo' check (status in ('Todo', 'In Progress', 'Done')),
  progress int not null default 0 check (progress between 0 and 100),
  content jsonb,
  created_at timestamptz not null default now()
);

-- 취미/학습
create table if not exists public.hobbies (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  details text,
  content jsonb,
  created_at timestamptz not null default now()
);

-- 투자
create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  name text,
  avg_price numeric,
  quantity numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 일정
create table if not exists public.schedule (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  date date not null,
  created_at timestamptz not null default now()
);

-- 접근 권한 (Row Level Security)
-- 로그인 기능이 아직 없어서 anon 키로 읽기/쓰기를 허용합니다.
-- 주의: anon 키는 브라우저에 노출되므로, 이 상태에서는 누구나 데이터를 읽고 쓸 수 있습니다.
-- 로그인을 붙이면 아래 정책을 `to authenticated` 로 바꾸세요.
alter table public.work enable row level security;
alter table public.hobbies enable row level security;
alter table public.investments enable row level security;
alter table public.schedule enable row level security;

create policy "anon full access" on public.work for all to anon using (true) with check (true);
create policy "anon full access" on public.hobbies for all to anon using (true) with check (true);
create policy "anon full access" on public.investments for all to anon using (true) with check (true);
create policy "anon full access" on public.schedule for all to anon using (true) with check (true);
