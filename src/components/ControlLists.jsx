import { ATTENTION_TEXT } from './ControlCard.jsx'
import { formatAt } from '../utils/controlTime.js'

// 중앙관제의 두 목록: 확인 필요, 최근 에이전트 작업. (서버 요약 /api/control-summary 의 attention·recent)

const DEPT_LABELS = { schedule: '일정', invest: '투자', agents: '에이전트 설정', test: '테스트' }
const AREA_LABELS = { agent: '에이전트', schedule: '일정', invest: '투자' }
const STATUS_LABELS = {
  PLANNING: '계획 중',
  VALIDATING: '검증 중',
  PENDING: '결재 대기',
  APPROVED: '승인됨',
  REJECTED: '반려',
  EXECUTING: '실행 중',
  COMPLETED: '완료',
  FAILED: '실패',
}

const listClass = 'divide-y divide-gray-700 rounded-xl border border-gray-700 bg-gray-800'
const rowClass = 'flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm'

function ListSection({ id, title, count, emptyText, children, isEmpty }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-lg font-semibold text-white">
        {title}
        {count !== undefined && <span className="ml-2 text-sm font-normal text-gray-400 tabular-nums">{count}</span>}
      </h3>
      {isEmpty ? <p className="text-sm text-gray-400">{emptyText}</p> : <ul className={listClass}>{children}</ul>}
    </section>
  )
}

export function AttentionList({ summary }) {
  if (!summary) return <ListSection id="control-attention" title="확인 필요" count="—" isEmpty emptyText="불러오는 중이거나 불러오지 못했습니다" />
  return (
    <ListSection
      id="control-attention"
      title="확인 필요"
      count={summary.attention.length}
      isEmpty={summary.attention.length === 0}
      emptyText={`확인할 것 없음 (최근 ${summary.windowDays}일)`}
    >
      {summary.attention.map((item) => (
        <li key={item.id} className={rowClass}>
          <span className={`font-semibold ${ATTENTION_TEXT}`}>{item.reason}</span>
          <span className="text-gray-400">{AREA_LABELS[item.area]}</span>
          <span className="min-w-0 flex-1 truncate text-gray-200">{item.query}</span>
          <span className="text-gray-400 tabular-nums">{formatAt(item.at)}</span>
        </li>
      ))}
    </ListSection>
  )
}

export function RecentTasks({ summary }) {
  if (!summary) return null
  return (
    <ListSection
      id="control-recent"
      title="최근 에이전트 작업"
      isEmpty={summary.recent.length === 0}
      emptyText={`최근 ${summary.windowDays}일 동안 작업이 없습니다`}
    >
      {summary.recent.map((task) => (
        <li key={task.id} className={rowClass}>
          <span className={`w-16 shrink-0 font-medium ${task.flagged ? ATTENTION_TEXT : 'text-gray-300'}`}>
            {STATUS_LABELS[task.status] ?? task.status}
          </span>
          <span className="min-w-0 flex-1 truncate text-gray-200">
            {task.auto && <span className="mr-1 text-gray-400">[자동]</span>}
            {task.query}
          </span>
          <span className="text-gray-400">{task.depts.map((dept) => DEPT_LABELS[dept] ?? dept).join(' · ')}</span>
          <span className="text-gray-400 tabular-nums">{formatAt(task.at)}</span>
        </li>
      ))}
    </ListSection>
  )
}
