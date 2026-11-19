// 개발 팀 "작업 단위"(dev_work) 기록의 검사와 합치기 (보고서 12). 순수 함수만 둔다 (저장은 api/dev-log.js).
// 작업 단위 = 보고서 한 단계(보통 커밋 하나). 작업 번호·분야·상태는 한글로 저장한다.
// 코드 본문은 받지 않는다: 바뀐 파일 경로와 줄 수, 커밋 해시만.

// 작업 번호: '보고서11' · '보고서11-2' (보고서 11의 2단계) · '수정-20261120-1' (보고서 없는 작은 수정, 날짜-순번)
export const WORK_KEY = /^(보고서\d{1,3}(-\d{1,2})?|수정-\d{8}-\d{1,3})$/
export const AREAS = ['화면', '에이전트', 'DB', '보안', '개발도구', '문서', '설정']
export const WORK_STATUSES = ['진행 중', '완료', '되돌림']
export const LIMITS = { title: 200, reason: 1000, changes: 2000, files: 300, commits: 50, path: 200, url: 300 }

const COMMIT = /^[0-9a-f]{7,40}$/
const REPORT_URL = /^https:\/\/claude\.ai\/\S+$/
// 파일 경로: 영문·숫자·한글과 . _ - / 만, 위로 올라가는 .. 는 안 됨
const PATH = /^(?!.*\.\.)[\w.\-/가-힣]+$/

// 파일 경로용 비밀 값 검사: 알려진 키·토큰 머리글만 본다.
// (긴 영문 연속 검사는 '20261021010000_add_user_id_and_auth_policies.sql' 같은 이름을 잘못 거르므로 쓰지 않는다)
const SECRET_IN_PATH = /(sk-[A-Za-z0-9_-]{8,}|sb_secret_|eyJ[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{20,}|github_pat_|xox[bp]-|AKIA[A-Z0-9]{12,})/

const isTime = (value) => typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))

// 여러 줄 글: 줄마다 앞뒤 공백 정리, 빈 줄 3개 이상은 하나로, 한도에서 자름
function cleanText(value, max) {
  if (value == null || value === '') return null
  if (typeof value !== 'string') return undefined
  const text = value
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
  return text || null
}

// 본문 → 저장할 칸들. 준 칸만 담는다 (없는 칸은 기존 값을 그대로 둔다). 잘못되었으면 { error }
// looksSecret: 비밀 값처럼 보이는 글자 검사 (dev-log.js의 것을 받아 같은 기준을 쓴다)
export function devWorkFields(body, looksSecret) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'bad-request' }
  const key = typeof body.work_key === 'string' ? body.work_key.trim() : ''
  if (!WORK_KEY.test(key)) return { error: 'bad-work-key' }
  const fields = { work_key: key }

  for (const name of ['title', 'reason', 'changes']) {
    if (!(name in body)) continue
    const text = cleanText(body[name], LIMITS[name])
    if (text === undefined) return { error: 'bad-request' }
    if (name === 'title') {
      if (!text) return { error: 'bad-request' }
      fields.title = text.replace(/\n/g, ' ')
    } else fields[name] = text
  }

  if ('areas' in body) {
    if (!Array.isArray(body.areas) || !body.areas.every((area) => AREAS.includes(area))) return { error: 'bad-areas' }
    fields.areas = [...new Set(body.areas)]
  }
  if ('files' in body) {
    const ok =
      Array.isArray(body.files) &&
      body.files.length <= LIMITS.files &&
      body.files.every(
        (file) =>
          file &&
          typeof file.path === 'string' &&
          file.path.length <= LIMITS.path &&
          PATH.test(file.path) &&
          Number.isInteger(file.added) &&
          Number.isInteger(file.removed) &&
          file.added >= 0 &&
          file.removed >= 0,
      )
    if (!ok) return { error: 'bad-files' }
    fields.files = body.files.map(({ path, added, removed }) => ({ path, added, removed }))
  }
  if ('commits' in body) {
    if (!Array.isArray(body.commits) || body.commits.length > LIMITS.commits || !body.commits.every((hash) => typeof hash === 'string' && COMMIT.test(hash))) {
      return { error: 'bad-commits' }
    }
    fields.commits = [...new Set(body.commits)]
  }
  // 파일 줄 수는 커밋 하나씩만 받는다. 그래야 이미 받은 커밋을 다시 보내도 줄 수를 두 번 더하지 않는다
  if (fields.files && fields.commits?.length !== 1) return { error: 'one-commit-per-files' }
  if ('report_url' in body && body.report_url != null && body.report_url !== '') {
    if (typeof body.report_url !== 'string' || body.report_url.length > LIMITS.url || !REPORT_URL.test(body.report_url)) return { error: 'bad-report-url' }
    fields.report_url = body.report_url
  }
  if ('status' in body) {
    if (!WORK_STATUSES.includes(body.status)) return { error: 'bad-status' }
    fields.status = body.status
  }
  for (const name of ['started_at', 'finished_at']) {
    if (!(name in body) || body[name] == null) continue
    if (!isTime(body[name])) return { error: 'bad-time' }
    fields[name] = new Date(body[name]).toISOString()
  }

  // 비밀 값처럼 보이는 글자는 저장하지 않는다 (제목·이유·바꾼 내용, 파일 경로는 따로)
  if ([fields.title, fields.reason, fields.changes].some((text) => text && looksSecret(text))) return { error: 'looks-secret' }
  if ((fields.files ?? []).some((file) => SECRET_IN_PATH.test(file.path))) return { error: 'looks-secret' }
  return { fields }
}

// 같은 파일은 줄 수를 더한다 (커밋 여러 개가 같은 파일을 바꿨을 때)
export function mergeFiles(before = [], after = []) {
  const byPath = new Map(before.map((file) => [file.path, { ...file }]))
  for (const file of after) {
    const prev = byPath.get(file.path)
    if (prev) Object.assign(prev, { added: prev.added + file.added, removed: prev.removed + file.removed })
    else byPath.set(file.path, { ...file })
  }
  return [...byPath.values()].slice(0, LIMITS.files)
}

// 기존 줄에 새 칸을 합친 값 (고칠 칸만).
//   커밋을 담은 요청(dev-work commit): 새 커밋일 때만 파일 줄 수를 더하고 바꾼 내용을 뒤에 이어 붙인다.
//     이미 받은 커밋이면 아무것도 더하지 않는다 (두 번 보내도 숫자·내용이 늘지 않게).
//     제목·이유는 이미 있으면 그대로 두고, 상태·시각은 바꾸지 않는다 (start로 적은 것을 커밋·지난 커밋 채우기가 덮지 않게).
//   커밋이 없는 요청(start·done·revert): 준 칸을 그대로 바꾼다.
export function mergeWork(existing, fields) {
  const patch = { ...fields }
  delete patch.work_key
  if (fields.commits) {
    const known = new Set(existing.commits ?? [])
    const fresh = fields.commits.filter((hash) => !known.has(hash))
    const commits = [...(existing.commits ?? []), ...fresh].slice(0, LIMITS.commits)
    // 한도(50개)에 걸려 해시를 못 남긴 커밋은 줄 수도 더하지 않는다 (다시 보내면 또 더해지므로)
    const added = fresh.filter((hash) => commits.includes(hash))
    patch.commits = commits
    delete patch.files
    delete patch.changes
    if (added.length > 0) {
      if (fields.files) patch.files = mergeFiles(existing.files, fields.files)
      if (fields.changes) patch.changes = [existing.changes, fields.changes].filter(Boolean).join('\n').slice(0, LIMITS.changes)
    }
    if (existing.title) delete patch.title
    if (existing.reason) delete patch.reason
    // 상태·시각은 start·done·revert만 바꾼다 (지난 커밋 채우기를 다시 돌려도 '진행 중'·'되돌림'이 바뀌지 않게)
    delete patch.status
    delete patch.started_at
    delete patch.finished_at
  }
  if (fields.areas) patch.areas = [...new Set([...(existing.areas ?? []), ...fields.areas])]
  return patch
}
