#!/usr/bin/env bash
# QA 창 시작: 점검하고 보고만 하는 Claude를 띄운다 (코드는 고치지 않는다).
# 규칙은 .claude/qa/QA.md. 편집 도구, git 쓰기, 다른 창을 끄거나 입력하는 wmux 도구는 빼고 실행한다.
#   사용: wmux 창 이름을 "대시보드-QA"로 바꾼 뒤, 그 창의 WSL 셸에서  bash scripts/qa_agent.sh
#   (--name은 Claude 세션 이름일 뿐, wmux 창 이름은 바꾸지 않는다)
set -euo pipefail
cd "$(dirname "$0")/.."

RULES=.claude/qa/QA.md
if [ ! -s "$RULES" ]; then
  echo "QA 규칙 파일($RULES)이 없습니다. 규칙 없이 띄우지 않습니다." >&2
  exit 1
fi

# 창 제목 (Claude Code가 나중에 덮어쓸 수 있음)
printf '\033]0;🔍 QA\007'
mkdir -p /tmp/lee0011-qa

exec claude \
  --name "대시보드-QA" \
  --append-system-prompt "$(cat "$RULES")" \
  --disallowedTools Edit Write NotebookEdit MultiEdit Agent \
    "Bash(git commit:*)" "Bash(git push:*)" "Bash(git reset:*)" "Bash(git checkout:*)" \
    "Bash(git restore:*)" "Bash(git rebase:*)" "Bash(git merge:*)" "Bash(git stash:*)" \
    mcp__wmux__pane_close mcp__wmux__surface_close mcp__wmux__terminal_send mcp__wmux__terminal_send_key mcp__wmux__send_message \
  -- "QA 창으로 시작했다. 규칙을 확인하고 'QA 대기 중'이라고 한 줄만 말한 뒤 지시를 기다려."
