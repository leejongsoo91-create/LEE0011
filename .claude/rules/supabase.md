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
- SQL은 사용자가 Supabase SQL Editor에 그대로 붙여 넣을 수 있게 전체를 전달하고, 실행 뒤 확인할 SQL도 함께 준다.
