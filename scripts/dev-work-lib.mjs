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

// 주식 사이트(StockView, 파이썬 Flask) 파일 → 분야 (보고서 13)
function stockArea(path) {
  if (/^(templates|static)\//.test(path)) return '화면'
  if (/^(data\/|data_fetcher\.py$|fetch_[\w]*\.py$|cache\.py$|[\w]*cache[\w]*\.json$)/.test(path)) return '데이터'
  if (/^(api\/|app\.py$|[\w]*_api\.py$)/.test(path)) return '에이전트'
  if (/^(scripts|\.claude|\.codex|\.agents)\//.test(path)) return '개발도구'
  if (/\.md$/i.test(path) || /^docs\//.test(path)) return '문서'
  return '설정'
}

// 바뀐 파일 경로(와 제목·본문)로 분야를 정한다. 한글 분야: 화면 · 에이전트 · DB · 보안 · 개발도구 · 문서 · 설정 · 데이터
// project가 '주식'이면 주식 사이트 파일 모양으로 나눈다.
export function areasFor(paths, text = '', project = '대시보드') {
  const areas = new Set()
  for (const path of paths) {
    if (project === '주식') areas.add(stockArea(path))
    else if (/^(src|public)\/|^index\.html$/.test(path)) areas.add('화면')
    else if (/^api\//.test(path)) areas.add('에이전트')
    else if (/^supabase\//.test(path)) areas.add('DB')
    else if (/^(scripts|\.claude|\.codex|\.agents)\//.test(path)) areas.add('개발도구')
    else if (/\.md$/i.test(path) || /^docs\//.test(path)) areas.add('문서')
    else areas.add('설정')
  }
  if (/보안|CSP|RLS|시크릿|권한/.test(text)) areas.add('보안')
  return [...areas]
}

// 커밋 제목 머리글(feat: 등)을 한글로: "feat: 시장 거래 창" → "기능: 시장 거래 창" (보고서 13)
const PREFIX_LABEL = { feat: '기능', fix: '수정', docs: '문서', chore: '정리', refactor: '다듬기', test: '테스트', tune: '조정', deploy: '배포', perf: '성능', style: '모양', build: '빌드', ci: '빌드', revert: '되돌림' }
export function koreanTitle(subject) {
  const match = /^([a-z]+(?:\+[a-z]+)*)(\([^)]*\))?!?:\s*(.*)$/i.exec(subject ?? '')
  if (!match) return subject ?? ''
  const labels = match[1].toLowerCase().split('+').map((word) => PREFIX_LABEL[word])
  if (labels.some((label) => !label)) return subject
  return `${[...new Set(labels)].join('·')}: ${match[3]}`
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
export function commitBody(key, commit, project = '대시보드') {
  const { subject, reason, changes } = parseCommitMessage(commit.message)
  return {
    type: 'work',
    work_key: key,
    ...(project !== '대시보드' ? { project } : {}),
    title: koreanTitle(subject).slice(0, 200) || '(제목 없음)',
    commits: [commit.hash.slice(0, 7)],
    files: commit.files.slice(0, MAX_FILES),
    areas: areasFor(commit.files.map((file) => file.path), commit.message, project),
    ...(changes.length ? { changes: changes.join('\n') } : {}),
    ...(reason ? { reason } : {}),
  }
}

// 지난 커밋(오래된 것부터)을 작업 단위로 묶는다 (dev-work-backfill). 작업마다 보낼 본문 목록 [{ work_key, requests }]
//   작업 번호: 메시지의 '작업:' 줄(모양이 맞을 때) → 제목의 보고서 번호 → '수정-<한국 날짜>-<그날 순번>'
//   순번은 손으로 붙인 같은 날 번호를 건너뛴다.
//   첫 본문에 제목·이유·바꾼 내용·상태·시각과 첫 커밋, 나머지 본문은 커밋 하나씩 (서버가 커밋별로 줄 수를 더함)
//   커밋이 여럿인 작업은 바꾼 내용을 커밋 제목 목록으로, 하나면 그 커밋의 '- ' 줄로
//   project: '주식'이면 본문마다 project를 붙이고 분야를 주식 사이트 파일 모양으로. 제목 머리글(feat: 등)은 한글로
export function groupCommits(commits, { project = '대시보드' } = {}) {
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
    const changes = list.length > 1 ? list.map((commit) => `- ${koreanTitle(commit.parsed.subject)}`) : first.parsed.changes
    const reason = list.map((commit) => commit.parsed.reason).find(Boolean)
    const reverted = /^(revert|되돌리기|되돌림)/i.test(last.parsed.subject)
    const allPaths = list.flatMap((commit) => commit.files.map((file) => file.path))
    const tag = project !== '대시보드' ? { project } : {}
    const perCommit = list.map((commit) => ({ type: 'work', work_key, ...tag, commits: [commit.hash.slice(0, 7)], files: commit.files.slice(0, MAX_FILES) }))
    perCommit[0] = {
      ...perCommit[0],
      title: koreanTitle(first.parsed.subject).slice(0, 200) || '(제목 없음)',
      ...(reason ? { reason } : {}),
      ...(changes.length ? { changes: changes.join('\n').slice(0, 2000) } : {}),
      areas: areasFor(allPaths, list.map((commit) => commit.message).join('\n'), project),
      status: reverted ? '되돌림' : '완료',
      started_at: first.at,
      finished_at: last.at,
    }
    return { work_key, hashes: list.map((commit) => commit.hash), subjects: list.map((commit) => commit.parsed.subject), requests: perCommit.slice(0, 50) }
  })
}

// 최근 며칠 안에 끝난(마지막 커밋이 그 안인) 작업만 (자동 기록 장치가 커밋마다 최근 것만 보내도록, 보고서 13)
// 작업 번호의 순번은 전체 이력으로 매기므로, 일부만 보내도 번호는 늘 같다
export function recentGroups(groups, days, now = Date.now()) {
  if (!(days > 0)) return groups
  const since = now - days * 24 * 60 * 60 * 1000
  return groups.filter((group) => Date.parse(group.requests[0].finished_at) >= since)
}

// 프로젝트 이름 → GitHub 저장소 이름 (스크립트가 --repo가 맞는 저장소인지 확인할 때)
export const PROJECT_REPOS = { 대시보드: 'LEE0011', 주식: 'stockview' }

// --project·--repo 검사: 프로젝트는 아는 이름만, 대시보드가 아니면 --repo 필수, --repo를 주면 --project도 필수,
// 그 저장소의 origin 주소가 프로젝트 저장소 이름으로 끝나야 한다. 문제가 있으면 문구, 없으면 null
export function checkProjectRepo(project, repo, originUrl, { projectGiven = true } = {}) {
  if (!Object.hasOwn(PROJECT_REPOS, project)) return `모르는 프로젝트예요: ${project} (대시보드 · 주식)`
  if (repo && !projectGiven) return '--repo를 주면 --project도 같이 주세요 (예: --project 주식 --repo /root/stockview)'
  if (project !== '대시보드' && !repo) return `${project} 작업은 --repo로 그 저장소를 알려 주세요 (예: --repo /root/stockview)`
  const name = PROJECT_REPOS[project]
  if (!new RegExp(`[/:]${name}(\\.git)?/?$`, 'i').test(String(originUrl ?? '').trim())) {
    return `저장소가 ${project}(${name})가 아니에요: ${String(originUrl ?? '').trim() || '(origin 없음)'}`
  }
  return null
}

// 주식 사이트 docs/CHANGELOG.md → [{ day: 'YYYYMMDD', kind, content, commits: [해시…] }] 와 못 읽은 줄 수
//   "## 2026-11" 아래 "- 11-21 | 구분 | 내용 | 커밋" 줄. 날짜가 "07-22~23"처럼 범위면 시작일로.
//   커밋 칸의 해시를 모두 뽑는다 ("9b140c1, 1989d3d"). "(이번 커밋)"이면 빈 목록
export function parseChangelog(text) {
  const entries = []
  let skipped = 0
  let year = null
  for (const line of String(text ?? '').split('\n')) {
    const head = /^##\s+(\d{4})-(\d{2})\s*$/.exec(line)
    if (head) {
      year = head[1]
      continue
    }
    if (!/^-\s+\d{2}-\d{2}/.test(line)) continue
    const match = /^-\s+(\d{2})-(\d{2})(?:~\d{2}(?:-\d{2})?)?\s*\|\s*([^|]*?)\s*\|\s*(.*?)\s*\|\s*([^|]*?)\s*$/.exec(line)
    if (!match || !year) {
      skipped += 1
      continue
    }
    const commits = match[5].match(/\b[0-9a-f]{7,40}\b/g) ?? []
    entries.push({ day: `${year}${match[1]}${match[2]}`, kind: match[3], content: match[4].replace(/\*\*/g, '').replace(/`/g, '').trim(), commits })
  }
  return Object.assign(entries, { skipped })
}

// 글에서 두 글자 이상 낱말 (짝 맞추기 점수용)
const words = (text) => new Set((String(text ?? '').toLowerCase().match(/[가-힣a-z0-9]{2,}/g) ?? []))
const nextDay = (day) => {
  const date = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(4, 6)) - 1, Number(day.slice(6, 8)) + 1))
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

// 변경 기록 줄을 지난 커밋 묶음(groupCommits 결과)과 짝짓는다. 짝이 확실한 것만 그 작업의 "바꾼 내용" 맨 앞에 붙인다
// (커밋 메시지의 '- ' 줄은 그 뒤에 남긴다, 2000자 안에서).
//   1) 기록 줄의 커밋 칸에 해시가 있으면 그 커밋이 든 작업과 짝 (한 작업에 여러 줄도 붙음).
//      해시가 3개 이하면 그 커밋들의 작업 모두에, 더 많으면(여러 단계를 묶은 요약 줄) 첫 작업에만 붙인다
//   2) 아니면 같은 한국 날짜(자정 넘겨 커밋한 경우를 위해 다음 날까지)의 작업 중
//      커밋 제목과 겹치는 낱말이 가장 많은 것(2개 이상). 이 방식은 한 작업에 한 줄
// 돌려주는 값: { paired, unpaired: [짝 못 지은 기록 줄] }
export function attachChangelog(groups, entries) {
  const lines = new Map() // 작업 → 붙일 기록 줄들
  const add = (group, entry) => {
    if (!lines.has(group)) lines.set(group, [])
    lines.get(group).push(`- [${entry.kind}] ${entry.content}`)
  }
  const byDay = new Map()
  for (const group of groups) {
    const day = kstDay(group.requests[0].started_at)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day).push(group)
  }
  const unpaired = []
  const scored = []
  for (const entry of entries) {
    if (entry.commits?.length) {
      const matched = groups.filter((item) => item.hashes.some((hash) => entry.commits.some((short) => hash.startsWith(short))))
      const targets = entry.commits.length <= 3 ? matched : matched.slice(0, 1)
      for (const group of targets) add(group, entry)
      if (targets.length === 0) unpaired.push(entry)
      continue
    }
    const content = words(entry.content)
    const candidates = [...(byDay.get(entry.day) ?? []), ...(byDay.get(nextDay(entry.day)) ?? [])].map((group) => ({
      group,
      score: [...words(group.subjects.join(' '))].filter((word) => content.has(word)).length,
    }))
    scored.push({ entry, candidates: candidates.filter((item) => item.score >= 2) })
  }
  // 낱말 겹침 짝: 점수가 높은 것부터, 한 작업에 한 줄 (해시로 이미 줄이 붙은 작업은 빼고)
  const pairs = scored.flatMap(({ entry, candidates }) => candidates.map((item) => ({ entry, ...item }))).sort((a, b) => b.score - a.score)
  const done = new Set()
  for (const { entry, group } of pairs) {
    if (done.has(entry) || lines.has(group)) continue
    add(group, entry)
    done.add(entry)
  }
  for (const { entry } of scored) if (!done.has(entry)) unpaired.push(entry)
  for (const [group, added] of lines) {
    const head = group.requests[0]
    head.changes = [...added, head.changes].filter(Boolean).join('\n').slice(0, 2000)
    head.paired = true
  }
  return { paired: entries.length - unpaired.length, unpaired }
}
