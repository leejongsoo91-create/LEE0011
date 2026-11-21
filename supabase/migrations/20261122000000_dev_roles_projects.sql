-- 개발 창 역할 4개와 프로젝트 구분 (보고서 13).
--   1) 역할에 '검토'(review) 추가: 독립 검토 결과를 개발(lead)과 따로 본다. 지난 '개발 + 검토 종류' 기록은 검토 역할로 옮긴다.
--   2) 프로젝트 칸: '대시보드' · '주식'(주식 사이트 StockView). 지금까지의 기록은 모두 '대시보드'.
--      작업 번호 중복 기준을 (계정, 작업 번호) → (계정, 프로젝트, 작업 번호)로 바꾼다 (두 사이트의 '수정-날짜-1'이 겹쳐도 따로).
--   3) 분야에 '데이터' 추가 (주식 사이트의 데이터 수집 코드).
--
-- 실행 순서: 20261121000000_dev_admin.sql 다음. 여러 번 실행해도 안전하다. 바꿀 곳 없음.
--
-- 되돌리기 (필요할 때만. 주식 작업·검토 역할 기록이 있으면 먼저 지우거나 바꿔야 원래 제약이 걸린다):
--   delete from public.dev_work where project <> '대시보드';
--   delete from public.dev_log where project <> '대시보드';
--   update public.dev_log set agent = 'lead' where agent = 'review';
--   update public.dev_work set areas = array_remove(areas, '데이터');
--   alter table public.dev_work drop constraint if exists dev_work_user_project_key;
--   alter table public.dev_work add constraint dev_work_user_id_work_key_key unique (user_id, work_key);
--   alter table public.dev_log drop constraint if exists dev_log_agent_check;
--   alter table public.dev_log add constraint dev_log_agent_check check (agent in ('lead', 'qa', 'devops'));
--   alter table public.dev_work drop constraint if exists dev_work_areas_check;
--   alter table public.dev_work add constraint dev_work_areas_check
--     check (areas <@ array['화면', '에이전트', 'DB', '보안', '개발도구', '문서', '설정']::text[]);
--   alter table public.dev_log drop column if exists project;
--   alter table public.dev_work drop column if exists project;

-- 옛 확인 조건은 이름과 상관없이 찾아서 뺀다 (표, 조건 안에 든 칸 이름)
create or replace function pg_temp.drop_checks(tbl regclass, col text) returns void language plpgsql as $$
declare name text;
begin
  for name in
    select c.conname from pg_constraint c
    where c.conrelid = tbl and c.contype = 'c' and pg_get_constraintdef(c.oid) ~ ('\m' || col || '\M')
  loop
    execute format('alter table %s drop constraint %I', tbl, name);
  end loop;
end
$$;

-- [A] 역할: 검토(review) 추가, 지난 검토 기록 옮기기
select pg_temp.drop_checks('public.dev_log', 'agent');
alter table public.dev_log add constraint dev_log_agent_check check (agent in ('lead', 'review', 'qa', 'devops'));
update public.dev_log set agent = 'review' where agent = 'lead' and kind = 'review';

-- [B] 프로젝트 칸
alter table public.dev_log add column if not exists project text not null default '대시보드';
alter table public.dev_log drop constraint if exists dev_log_project_check;
alter table public.dev_log add constraint dev_log_project_check check (project in ('대시보드', '주식'));

alter table public.dev_work add column if not exists project text not null default '대시보드';
alter table public.dev_work drop constraint if exists dev_work_project_check;
alter table public.dev_work add constraint dev_work_project_check check (project in ('대시보드', '주식'));

-- 작업 번호는 프로젝트마다 따로. 예전 (user_id, work_key) 고유 제약은 이름과 상관없이 찾아서 뺀다
alter table public.dev_work drop constraint if exists dev_work_user_id_work_key_key;
do $$
declare name text;
begin
  for name in
    select c.conname from pg_constraint c
    where c.conrelid = 'public.dev_work'::regclass and c.contype = 'u'
      and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
           where a.attrelid = c.conrelid and a.attnum = any (c.conkey)) = array['user_id', 'work_key']
  loop
    execute format('alter table public.dev_work drop constraint %I', name);
  end loop;
end
$$;
alter table public.dev_work drop constraint if exists dev_work_user_project_key;
alter table public.dev_work add constraint dev_work_user_project_key unique (user_id, project, work_key);

create index if not exists dev_work_user_project_started_idx on public.dev_work (user_id, project, started_at desc);

-- [C] 분야에 '데이터' 추가
select pg_temp.drop_checks('public.dev_work', 'areas');
alter table public.dev_work add constraint dev_work_areas_check
  check (areas <@ array['화면', '에이전트', 'DB', '보안', '개발도구', '문서', '설정', '데이터']::text[]);
