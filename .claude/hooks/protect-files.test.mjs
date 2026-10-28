// protect-files hook 테스트: 판단 로직 + Claude Code처럼 stdin JSON을 넣어 실제로 실행

import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { decide } from './protect-files.mjs'

const script = fileURLToPath(new URL('./protect-files.mjs', import.meta.url))
const root = path.resolve(path.dirname(script), '..', '..')
const edit = (file_path, tool_name = 'Edit') => ({ tool_name, tool_input: { file_path }, cwd: root })

function run(input, env = {}) {
  return spawnSync(process.execPath, [script], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, ...env },
    encoding: 'utf8',
  })
}

test('.env 계열은 막고 .env.example은 허용', () => {
  for (const file of ['.env', '.env.local', '.env.production.local', 'api/.env']) {
    assert.equal(decide(edit(file), { projectDir: root }).block, true, file)
  }
  assert.equal(decide(edit('.env.example'), { projectDir: root }).block, false)
  assert.equal(decide(edit(path.join(root, '.env.local')), { projectDir: root }).block, true, '절대 경로도')
})

test('이미 있는 SQL은 수정·덮어쓰기 막고, 새 SQL 만들기는 허용', () => {
  const existing = 'supabase/migrations/20261026000000_create_agent_tasks.sql'
  assert.equal(decide(edit(existing), { projectDir: root }).block, true)
  assert.equal(decide(edit(existing, 'Write'), { projectDir: root }).block, true)
  assert.match(decide(edit(existing), { projectDir: root }).reason, /새 파일/)
  assert.equal(decide(edit('supabase/migrations/20261101000000_new.sql', 'Write'), { projectDir: root }).block, false)
})

test('일반 코드·문서는 통과, 입력이 이상해도 막지 않음', () => {
  for (const file of ['src/App.jsx', 'api/_agents/orchestrator.js', 'CLAUDE.md', 'supabase/README.md']) {
    assert.equal(decide(edit(file), { projectDir: root }).block, false, file)
  }
  assert.equal(decide({}, { projectDir: root }).block, false)
  assert.equal(decide({ tool_input: { notebook_path: '.env' } }, { projectDir: root }).block, true)
})

test('실제 실행: 막을 때 종료 코드 2와 한국어 이유, 통과는 0', () => {
  const blocked = run(edit('.env.local', 'Write'))
  assert.equal(blocked.status, 2)
  assert.match(blocked.stderr, /\[protect-files\] 비밀 값 파일\(\.env\.local\)/)

  const sql = run(edit('supabase/migrations/20261021000000_create_core_tables.sql'))
  assert.equal(sql.status, 2)
  assert.match(sql.stderr, /이미 실행한 SQL/)

  assert.equal(run(edit('src/App.jsx')).status, 0)
  assert.equal(run('이건 JSON이 아님').status, 0)
})

test('settings.json에 hook이 편집 도구 대상으로 등록되어 있다', async () => {
  const { readFileSync } = await import('node:fs')
  const settings = JSON.parse(readFileSync(path.join(root, '.claude/settings.json'), 'utf8'))
  const entry = settings.hooks.PreToolUse[0]
  assert.deepEqual(entry.matcher.split('|').sort(), ['Edit', 'MultiEdit', 'NotebookEdit', 'Write'])
  assert.match(entry.hooks[0].command, /protect-files\.mjs/)
})
