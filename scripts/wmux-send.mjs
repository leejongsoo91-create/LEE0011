#!/usr/bin/env node
// wmux 창 이름(대시보드-메인, 대시보드-QA)으로 창을 찾아 한 줄을 입력하고 Enter를 누른다.
// 다른 프로젝트(stockview)도 "메인" 창을 쓰므로 이름에 "대시보드-"를 붙인다.
// 메인 창 → QA 창: 테스트 요청, QA 창 → 메인 창: QA 보고.
//
//   node scripts/wmux-send.mjs <창 이름> "<한 줄>"
//   예) node scripts/wmux-send.mjs 대시보드-메인 "[QA 보고] 통과 — 테스트 4종 통과 — /tmp/lee0011-qa/report.md"
//
// wmux MCP 도구는 이 대화를 다른 작업공간으로 잘못 알아보는 일이 있어 CLI를 쓴다.
// CLI는 '#이름'을 못 풀어서(plugin unconfirmed), list-panes --json으로 ptyId를 찾아 보낸다.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const WMUX_CMD = process.env.WMUX_CMD || 'C:\\Users\\이종수\\AppData\\Local\\wmux\\bin\\wmux.cmd'
// cmd.exe가 특별하게 읽는 글자. 그대로 두면 명령이 끊기거나 바뀐다.
const CMD_SPECIAL = { '"': "'", '&': '＆', '|': '｜', '<': '＜', '>': '＞', '^': '＾', '%': '％' }
const MAX_LEN = 500

// 여러 줄을 한 줄로 합치고, cmd.exe 특수 글자를 비슷한 모양의 안전한 글자로 바꾼다.
export function oneLine(text) {
  const flat = String(text ?? '')
    .split(/[\r\n]+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' / ')
  let safe = flat
    .replace(/["&|<>^%]/g, (ch) => CMD_SPECIAL[ch])
    // 끝의 \는 WSL이 붙이는 닫는 따옴표와 합쳐져 \"가 되므로 바꾼다.
    .replace(/\\+$/, (m) => '＼'.repeat(m.length))
  // 받는 쪽 Claude Code 입력창은 맨 앞 ! / #를 bash·명령·메모로 읽고, wmux는 -를 옵션으로 읽는다.
  if (/^[!/#-]/.test(safe)) safe = `[전달] ${safe}`
  return safe.length > MAX_LEN ? `${safe.slice(0, MAX_LEN - 1)}…` : safe
}

// list-panes --json 결과에서 이름(paneName 또는 metadata.label)이 같은 창의 ptyId를 찾는다.
// 대소문자는 무시한다(QA, qa). 같은 이름이 둘 이상이면 어디로 갈지 모르므로 오류.
export function findPtyId(listJson, name) {
  const want = String(name).trim().toLowerCase()
  const panes = (listJson?.panes ?? []).filter((p) => !p.stashed)
  const hits = panes.filter((p) =>
    [p.paneName, p.metadata?.label].some((n) => typeof n === 'string' && n.trim().toLowerCase() === want),
  )
  if (hits.length === 0) {
    const names = panes.map((p) => p.paneName).filter(Boolean).join(', ')
    throw new Error(`'${name}' 창이 없습니다. 지금 창: ${names || '(없음)'}`)
  }
  if (hits.length > 1) throw new Error(`'${name}' 이름의 창이 ${hits.length}개입니다. 하나만 남겨 주세요.`)
  // 창에 탭이 여럿이면 Claude Code가 떠 있는 탭으로. 그런 탭이 없고 탭이 여럿이면 어디인지 모르므로 오류.
  const pane = hits[0]
  const claudePty = (pane.agents ?? []).find((a) => a.agentName === 'Claude Code')?.ptyId
  if (claudePty) return claudePty
  const ptys = pane.surfacePtyIds ?? []
  if (ptys.length === 0) throw new Error(`'${name}' 창에 터미널이 없습니다.`)
  if (ptys.length > 1) throw new Error(`'${name}' 창에 탭이 ${ptys.length}개인데 Claude Code 탭을 못 찾았습니다.`)
  return ptys[0]
}

// cmd.exe는 WSL 경로에서 실행하면 경고를 내므로 Windows 드라이브에서 실행한다.
function runWmux(args) {
  const r = spawnSync('cmd.exe', ['/c', WMUX_CMD, ...args], { cwd: '/mnt/c', encoding: 'utf8', timeout: 20000 })
  if (r.error) throw new Error(`wmux 실행 실패: ${r.error.message}`)
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim()
  if (r.status !== 0 || /^Error:/.test(out)) throw new Error(`wmux 오류: ${out || `종료 코드 ${r.status}`}`)
  return r.stdout
}

export function send(name, text, run = runWmux) {
  const line = oneLine(text)
  if (!line) throw new Error('보낼 내용이 비어 있습니다.')
  const raw = run(['list-panes', '--json'])
  let list
  try {
    list = JSON.parse(raw)
  } catch {
    throw new Error(`wmux 창 목록을 읽지 못했습니다: ${String(raw).slice(0, 200)}`)
  }
  const ptyId = findPtyId(list, name)
  run(['send', line, '--submit', '--to', ptyId])
  return { ptyId, line }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [name, ...rest] = process.argv.slice(2)
  if (!name || rest.length === 0) {
    console.error('사용법: node scripts/wmux-send.mjs <창 이름> "<한 줄>"')
    process.exit(2)
  }
  try {
    const { ptyId, line } = send(name, rest.join(' '))
    console.log(`[wmux-send] ${name}(${ptyId})에 보냄: ${line}`)
  } catch (e) {
    console.error(`[wmux-send] ${e.message}`)
    process.exit(1)
  }
}
