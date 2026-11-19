// 작업 단위 기록(보고서 12)에 쓰는 git 출력 해석. 순수 함수만 둔다 (dev-work.mjs · dev-work-backfill.mjs가 쓴다).
// 코드 본문은 다루지 않는다: 파일 경로와 늘고 준 줄 수, 커밋 메시지만.

// 서버(api/_lib/devWork.js)와 같은 파일 경로 기준. 맞지 않는 경로(공백·특수 문자)는 빼고 보낸다
const PATH = /^(?!.*\.\.)[\w.\-/가-힣]+$/
export const MAX_FILES = 300
// 서버와 같은 작업 번호 모양 (보고서12-1 · 보고서12 · 수정-20261120-1)
export const WORK_KEY = /^(보고서\d{1,3}(-\d{1,2})?|수정-\d{8}-\d{1,3})$/

// git --numstat 한 줄들 → [{ path, added, removed }]. 바이너리('-')는 0줄, 이름 바꾸기는 새 이름
export function parseNumstat(text) {
  const files = []
  for (const line of String(text ?? '').split('\n')) {
    const match = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line.trim())
    if (!match) continue
    let path = match[3]
    if (path.includes('=>')) path = path.replace(/\{[^{}]*=> ([^{}]*)\}/, '$1').replace(/^.* => /, '').replace(/\/\//g, '/')
    if (!PATH.test(path) || path.length > 200) continue
    files.push({ path, added: match[1] === '-' ? 0 : Number(match[1]), removed: match[2] === '-' ? 0 : Number(match[2]) })
  }
  return files
}

// 바뀐 파일 경로(와 제목·본문)로 분야를 정한다. 한글 분야: 화면 · 에이전트 · DB · 보안 · 개발도구 · 문서 · 설정
export function areasFor(paths, text = '') {
  const areas = new Set()
  for (const path of paths) {
    if (/^(src|public)\/|^index\.html$/.test(path)) areas.add('화면')
    else if (/^api\//.test(path)) areas.add('에이전트')
    else if (/^supabase\//.test(path)) areas.add('DB')
    else if (/^(scripts|\.claude|\.codex|\.agents)\//.test(path)) areas.add('개발도구')
    else if (/\.md$/i.test(path) || /^docs\//.test(path)) areas.add('문서')
    else areas.add('설정')
  }
  if (/보안|CSP|RLS|시크릿|권한/.test(text)) areas.add('보안')
  return [...areas]
}

// 커밋 메시지 → 제목, 이유('왜:' 줄), 작업 번호('작업:' 줄), 바꾼 내용('- ' 줄들). 공동 작성자 줄은 뺀다
export function parseCommitMessage(message) {
  const lines = String(message ?? '').replace(/\r/g, '').split('\n')
  const subject = (lines[0] ?? '').trim()
  let reason = null
  let workKey = null
  const changes = []
  for (const raw of lines.slice(1)) {
    const line = raw.trim()
    if (/^왜\s*:/.test(line)) reason = line.replace(/^왜\s*:\s*/, '') || null
    else if (/^작업\s*:/.test(line)) workKey = line.replace(/^작업\s*:\s*/, '') || null
    else if (/^[-*] /.test(line)) changes.push(`- ${line.slice(2).trim()}`)
  }
  return { subject, reason, workKey, changes }
}

// 제목 속 "보고서 11 2단계" → '보고서11-2', "(보고서 10)" → '보고서10', 없으면 null
export function reportKey(subject) {
  const match = /보고서\s*(\d{1,3})(?:\s*(\d{1,2})\s*단계)?/.exec(subject ?? '')
  if (!match) return null
  return match[2] ? `보고서${match[1]}-${match[2]}` : `보고서${match[1]}`
}

// ISO 시각 → 한국 날짜 'YYYYMMDD'
export function kstDay(iso) {
  return new Date(Date.parse(iso) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '')
}

// git log --format=%x1e%H%x1f%aI%x1f%B%x1d --numstat 출력 → 커밋 목록 [{ hash, at, message, files }]
export function parseGitLog(text) {
  return String(text ?? '')
    .split('\x1e')
    .filter((chunk) => chunk.trim())
    .map((chunk) => {
      const [head, numstat = ''] = chunk.split('\x1d')
      const [hash, at, message = ''] = head.split('\x1f')
      return { hash: hash.trim(), at: at.trim(), message, files: parseNumstat(numstat) }
    })
}

// 커밋 하나 → 작업 단위로 보낼 본문 (dev-work commit). 파일 줄 수는 커밋 하나씩 보낸다 (서버가 이미 받은 커밋은 다시 더하지 않음).
// 제목은 처음 만들 때만 쓰이고(커밋 제목), 이미 있는 작업이면 서버가 제목·이유를 그대로 둔다.
export function commitBody(key, commit) {
  const { subject, reason, changes } = parseCommitMessage(commit.message)
  return {
    type: 'work',
    work_key: key,
    title: subject.slice(0, 200) || '(제목 없음)',
    commits: [commit.hash.slice(0, 7)],
    files: commit.files.slice(0, MAX_FILES),
    areas: areasFor(commit.files.map((file) => file.path), commit.message),
    ...(changes.length ? { changes: changes.join('\n') } : {}),
    ...(reason ? { reason } : {}),
  }
}

// 지난 커밋(오래된 것부터)을 작업 단위로 묶는다 (dev-work-backfill). 작업마다 보낼 본문 목록 [{ work_key, requests }]
//   작업 번호: 메시지의 '작업:' 줄(모양이 맞을 때) → 제목의 보고서 번호 → '수정-<한국 날짜>-<그날 순번>'
//   순번은 손으로 붙인 같은 날 번호를 건너뛴다.
//   첫 본문에 제목·이유·바꾼 내용·상태·시각과 첫 커밋, 나머지 본문은 커밋 하나씩 (서버가 커밋별로 줄 수를 더함)
//   커밋이 여럿인 작업은 바꾼 내용을 커밋 제목 목록으로, 하나면 그 커밋의 '- ' 줄로
export function groupCommits(commits) {
  const parsedAll = commits.map((commit) => ({ ...commit, parsed: parseCommitMessage(commit.message) }))
  const explicit = new Set(parsedAll.map((commit) => commit.parsed.workKey).filter((key) => key && WORK_KEY.test(key)))
  const groups = new Map()
  const perDay = new Map()
  for (const commit of parsedAll) {
    const own = commit.parsed.workKey && WORK_KEY.test(commit.parsed.workKey) ? commit.parsed.workKey : null
    let key = own || reportKey(commit.parsed.subject)
    if (!key) {
      const day = kstDay(commit.at)
      let n = perDay.get(day) ?? 0
      do n += 1
      while (explicit.has(`수정-${day}-${n}`))
      perDay.set(day, n)
      key = `수정-${day}-${n}`
    }
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(commit)
  }
  return [...groups].map(([work_key, list]) => {
    const first = list[0]
    const last = list.at(-1)
    const changes = list.length > 1 ? list.map((commit) => `- ${commit.parsed.subject}`) : first.parsed.changes
    const reason = list.map((commit) => commit.parsed.reason).find(Boolean)
    const reverted = /^(revert|되돌리기|되돌림)/i.test(last.parsed.subject)
    const allPaths = list.flatMap((commit) => commit.files.map((file) => file.path))
    const perCommit = list.map((commit) => ({ type: 'work', work_key, commits: [commit.hash.slice(0, 7)], files: commit.files.slice(0, MAX_FILES) }))
    perCommit[0] = {
      ...perCommit[0],
      title: first.parsed.subject.slice(0, 200) || '(제목 없음)',
      ...(reason ? { reason } : {}),
      ...(changes.length ? { changes: changes.join('\n').slice(0, 2000) } : {}),
      areas: areasFor(allPaths, list.map((commit) => commit.message).join('\n')),
      status: reverted ? '되돌림' : '완료',
      started_at: first.at,
      finished_at: last.at,
    }
    return { work_key, requests: perCommit.slice(0, 50) }
  })
}
