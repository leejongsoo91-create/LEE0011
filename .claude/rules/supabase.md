---
paths:
  - "supabase/**"
---

# DB(supabase/) 작업 규칙

- `supabase/migrations/`에 있는 SQL은 **사용자가 이미 실행한 파일**이다. 고치지 않는다(hook이 막는다). 바꿀 것이 있으면 새 파일을 만든다.
- 새 파일 이름: `YYYYMMDDHHMMSS_무엇을_하는지.sql` (기존 파일보다 늦은 시각).
- 파일 첫머리에 무엇을 하는지, 어떤 파일 다음에 실행하는지, 되돌리는 방법을 한국어 주석으로 적는다.
- 여러 번 실행해도 안전하게(`if not exists`, `drop ... if exists`) 쓴다.
- 새 테이블은 RLS를 켠다. 사용자 데이터는 `user_id` + `own rows only` 정책, 서버 전용 테이블(`agent_tasks`)은 정책 없이 서비스 롤 키로만.
- 전달 전에 임시 Postgres 16으로 실행해 본다 (데이터 폴더는 `/var/lib/postgresql/<이름>`, `postgres` 사용자, 끝나면 정리).
- `pg_cron` 예약의 시크릿은 SQL에 직접 적지 않고 금고에서 꺼낸다: `(select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')`. 본문은 `jsonb_build_object()`로 넣어 따옴표를 줄인다. (직접 적다가 따옴표 오류·401로 알림이 멈춘 적 있음, 2026-11-11)
- 이 PC(Windows)에는 Postgres가 없다. 임시 Postgres 대신 스크래치패드에 PGlite(`@electric-sql/pglite`)를 받아 `cron`·`net`·`vault`를 가짜 함수로 만들고 실행해 본다. 예약 SQL은 저장된 명령(`cron.job.command`)까지 실행해 본다.
- SQL은 사용자가 Supabase SQL Editor에 그대로 붙여 넣을 수 있게 전체를 전달하고, 실행 뒤 확인할 SQL도 함께 준다.
