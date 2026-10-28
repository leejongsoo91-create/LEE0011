---
paths:
  - "src/**"
  - "index.html"
  - "vite.config.js"
---

# 대시보드 화면(src/) 작업 규칙

- 다크 모드가 기본이고 테마 전환(`ThemeToggle`)이 있다. 바꾼 화면은 두 테마에서 모두 확인한다.
- 반응형 기준 폭은 lg(1024px). 그보다 좁으면(폰·태블릿 세로) 하단 탭을 쓴다. 사용자는 주로 폰으로 보므로 폰 폭에서 먼저 확인한다.
- 페이지 본문은 노션 스타일 블록 에디터(BlockNote)다. 슬래시 메뉴·커스텀 블록은 `editorSchema.jsx`, `EditorSlashMenu.jsx`.
- 데이터는 Supabase에서 로그인한 사용자 것만 다룬다(RLS, `user_id`). 저장·삭제 뒤에는 `notifyDataChange()`로 목록을 새로 고친다.
- 브라우저에 노출되는 값은 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`뿐이다. 다른 비밀 값을 `VITE_`로 만들지 않는다.
- 화면을 바꾸면 `npm run build`가 통과해야 한다.
- 주석·문구는 한국어.
