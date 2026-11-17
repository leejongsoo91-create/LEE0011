// PreToolUse hook: 파일 편집 도구(Edit·Write·MultiEdit·NotebookEdit)가 아래 파일을 건드리려 하면 막는다.
//   1) .env, .env.local 같은 비밀 값 파일 (.env.example은 허용)
//   2) supabase/migrations/에 이미 있는 SQL 파일 (사용자가 이미 실행함, 새 파일 만들기는 허용)
// Claude Code가 도구 정보를 JSON으로 stdin에 넣어 준다. 막을 때는 이유를 stderr에 쓰고 종료 코드 2.
// 셸 명령(sed, rm 등)은 이번 범위가 아니다 (보고서 결정 2: 나중에).

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

export function decide(input, { projectDir, exists = existsSync } = {}) {
  const target = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path
  if (typeof target !== 'string' || !target) return { block: false }

  const root = projectDir || input?.cwd || process.cwd()
  const absolute = path.resolve(root, target)
  const relative = path.relative(root, absolute).split(path.sep).join('/').replace(/\\/g, '/')
  const name = path.basename(absolute)

  if (/^\.env(\..+)?$/.test(name) && name !== '.env.example') {
    return { block: true, reason: `비밀 값 파일(${relative})은 수정할 수 없어요. 값은 Vercel 환경변수에서 바꾸고, 형식은 .env.example에 적어 주세요.` }
  }
  if (/^supabase\/migrations\/[^/]+\.sql$/i.test(relative) && exists(absolute)) {
    return { block: true, reason: `이미 실행한 SQL 파일(${relative})은 고치지 않아요. 바꿀 내용은 supabase/migrations/에 새 파일(YYYYMMDDHHMMSS_설명.sql)로 만들어 주세요.` }
  }
  return { block: false }
}

function main() {
  let input
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}')
  } catch {
    process.exit(0) // 입력을 못 읽으면 막지 않는다 (다른 작업을 방해하지 않게)
  }
  const verdict = decide(input, { projectDir: process.env.CLAUDE_PROJECT_DIR })
  if (verdict.block) {
    process.stderr.write(`[protect-files] ${verdict.reason}\n`)
    process.exit(2)
  }
  process.exit(0)
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('protect-files.mjs')) main()
