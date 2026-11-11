// 업무 탭 "개발 팀" 현황판의 계산. 기록(dev_log 행)만 보고 정하며, 화면·네트워크와 상관없는 순수 함수다.

export const TEAM = [
  { id: 'lead', name: 'Lead Coder', role: '구현 · 커밋' },
  { id: 'qa', name: 'QA/Reviewer', role: '검토 · 테스트' },
  { id: 'devops', name: 'DevOps/Monitor', role: '빌드 · 배포 확인' },
]

export const KIND_LABEL = { plan: '계획', edit: '수정', test: '테스트', review: '검토', commit: '커밋', deploy: '배포', check: '확인' }

// 상태 배지 문구. idle = 30분 넘게 기록이 없음, none = 기록이 하나도 없음
export const STATE_LABEL = { running: '작업 중', pass: '통과', fail: '실패', info: '기록', idle: '대기', none: '기록 없음' }

// 상태별 색과 기호 (기호를 함께 써서 색을 못 봐도 구분된다). 밝은 테마는 -700, 어두운 테마는 -400
export const STATE_STYLE = {
  running: { text: 'text-sky-700 dark:text-sky-400', dot: 'bg-sky-500', icon: '●' },
  pass: { text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', icon: '✔' },
  fail: { text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500', icon: '✘' },
  info: { text: 'text-gray-300', dot: 'bg-gray-400', icon: '·' },
  idle: { text: 'text-gray-400', dot: 'bg-gray-600', icon: '○' },
  none: { text: 'text-gray-400', dot: 'bg-gray-700', icon: '—' },
}

export const STALE_MS = 30 * 60 * 1000

const newestFirst = (a, b) => String(b.created_at).localeCompare(String(a.created_at))

// 에이전트별 지금 상태: 가장 최근 기록으로 정한다.
//   30분 넘게 기록이 없으면 '대기'. 단, 마지막 기록이 실패면 새 기록이 올 때까지 '실패'로 남긴다 (실패를 숨기지 않게).
export function teamStatus(rows, now = Date.now()) {
  const sorted = [...(rows ?? [])].sort(newestFirst)
  return TEAM.map((member) => {
    const last = sorted.find((row) => row.agent === member.id) ?? null
    if (!last) return { ...member, state: 'none', last: null }
    const stale = now - Date.parse(last.created_at) > STALE_MS
    const state = last.status === 'fail' ? 'fail' : stale ? 'idle' : last.status
    return { ...member, state, last }
  })
}

// 가장 최근 기록 시각 (없으면 null)
export const lastLogAt = (rows) => [...(rows ?? [])].sort(newestFirst)[0]?.created_at ?? null

// "방금" / "N분 전" / "N시간 전" / "N일 전"
export function agoLabel(iso, now = Date.now()) {
  const ms = now - Date.parse(iso ?? '')
  if (Number.isNaN(ms)) return ''
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

// 로그 목록: 에이전트 필터(all 또는 id) 후 최신순
export const filterLog = (rows, agent = 'all') =>
  [...(rows ?? [])].filter((row) => agent === 'all' || row.agent === agent).sort(newestFirst)

// ref → 링크. 커밋 해시는 GitHub 커밋 주소, https 주소는 그대로. 그 밖은 null
export function refLink(ref) {
  if (typeof ref !== 'string') return null
  if (/^[0-9a-f]{7,40}$/.test(ref)) return { href: `https://github.com/leejongsoo91-create/LEE0011/commit/${ref}`, label: ref.slice(0, 7) }
  if (/^https:\/\/\S+$/.test(ref)) return { href: ref, label: '링크' }
  return null
}

// 업무 탭 요약 띠: 할 일 · 진행 중 · 오늘 마감(완료 제외) · 최근 7일 회의
export function workSummary(work, meetings, today, now = Date.now()) {
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000
  return {
    todo: work.filter((row) => row.status === 'Todo').length,
    doing: work.filter((row) => row.status === 'In Progress').length,
    dueToday: work.filter((row) => row.due_date === today && row.status !== 'Done').length,
    recentMeetings: meetings.filter((row) => Date.parse(row.created_at) >= weekAgo).length,
  }
}
