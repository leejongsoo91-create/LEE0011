// Plaud 녹음(Zapier "Transcript & Summary Ready")을 업무 등록 인자로 바꾸는 도우미. 외부 호출 없음.
//
// Zapier가 주는 칸은 Title · Transcript · Summary(Markdown) · Create Time 넷뿐이다 (2026-11-12 확인).
//   - 녹음 id가 없어서 중복 키는 "Create Time + Title" 해시로 만든다: plaud:<16자리 hex>
//   - Create Time은 끝에 Z가 붙어 오지만 한국 시각이다 (같은 녹음을 MCP는 08:42, Zapier는 17:42Z로 줌).
//     그래서 Z·시간대 표시는 버리고 한국 시각(+09:00)으로 읽는다.
//   - 녹취록(Transcript)은 받지도 저장하지도 않는다. 요약만 쓴다.
//   - 할 일은 요약의 "- [ ] 할 일 -- *담당* YYYY-MM-DD" 줄이다. 제목줄("작업 계획"·"실행 항목")은 녹음마다 달라서 보지 않는다.

import { createHash } from 'node:crypto'

export const PLAUD_PREFIX = 'plaud:'
export const PLAUD_KEY = /^plaud:[0-9a-f]{16}$/
export const PLAUD_APPROVAL_TTL_MS = 24 * 60 * 60 * 1000
export const MAX_TITLE = 200
export const MAX_SUMMARY = 20000
export const MAX_ASSIGNEE = 100
export const MAX_TODOS = 20
export const UNTITLED = '제목 없는 녹음'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export const isPlaudTask = (task) => typeof task?.source_key === 'string' && task.source_key.startsWith(PLAUD_PREFIX)

// 실제 있는 날짜인지 (2026-02-30·2026-13-01은 거짓. 13월처럼 Date가 못 만드는 값도 오류 없이 거짓)
export function validDate(value) {
  if (typeof value !== 'string' || !DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

// 제목: 앞뒤 공백·줄바꿈 정리, 비면 기본 이름, 최대 200자
export const cleanTitle = (value) => clip(String(value ?? '').replace(/\s+/g, ' ').trim() || UNTITLED, MAX_TITLE)

// 요약: 최대 2만 자 (넘으면 잘라 내고 표시)
export const cleanSummary = (value) => {
  const text = String(value ?? '').trim()
  return text.length > MAX_SUMMARY ? `${text.slice(0, MAX_SUMMARY - 30)}\n\n…(요약이 길어 뒷부분을 잘랐어요)` : text
}

// 중복 키: 같은 녹음이면 같은 키 (Zapier가 다시 보내도, 재요약돼도)
export function plaudKey(createTime, title) {
  const hash = createHash('sha256').update(`${String(createTime ?? '').trim()}|${cleanTitle(title)}`, 'utf8').digest('hex')
  return `${PLAUD_PREFIX}${hash.slice(0, 16)}`
}

// Create Time → ISO(UTC). 날짜·시각 부분만 읽고 한국 시각으로 본다. 읽을 수 없으면 null.
export function plaudTimeToIso(value) {
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?/.exec(String(value ?? '').trim())
  if (!match || !validDate(match[1])) return null
  const date = new Date(`${match[1]}T${match[2]}${match[3] ?? ':00'}+09:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

// ISO → "11/11(수) 17:42" (한국 시각)
export function whenLabel(iso) {
  if (!iso) return '시각 모름'
  const kst = new Date(Date.parse(iso) + 9 * 60 * 60 * 1000)
  return `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}(${WEEKDAYS[kst.getUTCDay()]}) ${kst.toISOString().slice(11, 16)}`
}

const plain = (text) => text.replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim()

// 요약에서 할 일 뽑기. 돌려주는 값: { todos: [{ title, assignee, due_date }], skipped }
export function parseTodos(summary) {
  const todos = []
  let skipped = 0
  for (const line of String(summary ?? '').split(/\r?\n/)) {
    const match = /^\s*[-*]\s+\[ \]\s+(.+)$/.exec(line)
    if (!match) continue
    const body = match[1]
    const cut = body.lastIndexOf(' -- ')
    const text = plain(cut >= 0 ? body.slice(0, cut) : body)
    const meta = cut >= 0 ? body.slice(cut + 4) : ''
    if (!text) continue
    if (todos.length >= MAX_TODOS) {
      skipped += 1
      continue
    }
    const names = [...meta.matchAll(/\*([^*]+)\*/g)].map((m) => m[1].trim()).filter(Boolean)
    const date = /(\d{4}-\d{2}-\d{2})/.exec(meta)?.[1]
    todos.push({
      title: clip(text, MAX_TITLE),
      assignee: names.length ? clip(names.join(', '), MAX_ASSIGNEE) : null,
      due_date: date && validDate(date) ? date : null,
    })
  }
  return { todos, skipped }
}

// 받은함 한 줄 → work.import_meeting 인자
export function importArgs(row) {
  const summary = cleanSummary(row.summary_md)
  const { todos, skipped } = parseTodos(summary)
  return {
    plaud_key: row.source_key,
    title: cleanTitle(row.title),
    recorded_at: row.recorded_at ? new Date(row.recorded_at).toISOString() : null,
    summary_md: summary,
    todos,
    skipped,
  }
}
