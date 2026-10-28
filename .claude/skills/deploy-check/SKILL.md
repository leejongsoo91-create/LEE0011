---
name: deploy-check
description: 푸시한 뒤 Vercel 배포와 텔레그램 에이전트가 실제로 잘 도는지 사용자와 함께 확인할 때 쓰는 순서. 이 환경은 실제 서버에 접속할 수 없으므로 사용자에게 줄 가이드를 만든다.
---

# 배포 후 확인 순서 (사용자에게 줄 가이드)

번호를 매겨 짧게, 폰과 노트북 어느 쪽에서도 따라 할 수 있게 쓴다.

1. **배포**: Vercel → Deployments에서 방금 커밋이 Ready인지. 환경변수를 바꿨다면 Redeploy.
2. **응답 확인**: 텔레그램에 조회 지시(예: 「이번 주 일정 알려줘」). 답이 없으면 브라우저로 `https://api.telegram.org/bot<봇토큰>/getWebhookInfo` → `last_error_message` (401이면 시크릿 불일치).
3. **결재 메시지**: 쓰기 지시(예: 「내일 오후 3시 회의 등록해줘」) → `👥 맡는 부서`, `🤖 메인`, `🔍 크로스체크`, `📚 규칙서 ✓` 줄 확인 → 시험이었다면 반려 후 사유에 「취소」, 또는 `/cancel`.
4. **기록 확인** (Supabase SQL Editor):
   ```sql
   select e->>'at' as at, e->>'agent' as agent, e->>'event' as event, e->>'dept' as dept
   from public.agent_tasks, jsonb_array_elements(event_logs) e
   where id = (select id from public.agent_tasks order by created_at desc limit 1);
   ```
5. **문제가 있으면**: Vercel → Logs에서 `[agents]`·`[webhook]` 줄, 또는 실패 작업의 원인
   ```sql
   select created_at, event_logs->-1->>'event' as event, event_logs->-1->>'note' as note
   from public.agent_tasks where status = 'FAILED' order by created_at desc limit 5;
   ```
   사용자가 붙여 준 문장으로 원인을 찾고, 고칠 것이 있으면 보고서부터.
