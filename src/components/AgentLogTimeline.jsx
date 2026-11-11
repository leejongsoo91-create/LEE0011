import { useState } from 'react'
import { formatAt } from '../utils/controlTime.js'
import { KIND_LABEL, STATE_LABEL, STATE_STYLE, TEAM, filterLog, refLink } from '../utils/teamStatus.js'

const SHORT = 5
const LONG = 20
const NAME = Object.fromEntries(TEAM.map((member) => [member.id, member.name]))
const FILTERS = [{ id: 'all', name: '전체' }, ...TEAM.map((member) => ({ id: member.id, name: member.name.split('/')[0] }))]

// 개발 팀 작업 로그: 시각 · 에이전트 · 종류 · 요약 · 링크. 에이전트별로 걸러 볼 수 있고, 처음엔 5건만.
export default function AgentLogTimeline({ rows, now }) {
  const [agent, setAgent] = useState('all')
  const [expanded, setExpanded] = useState(false)
  const list = filterLog(rows, agent)
  const shown = list.slice(0, expanded ? LONG : SHORT)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="작업 로그 거르기">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            aria-pressed={agent === filter.id}
            onClick={() => setAgent(filter.id)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              agent === filter.id ? 'border-gray-400 bg-gray-700 text-white' : 'border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {filter.name}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-700 px-3 py-4 text-center text-xs text-gray-400">
          아직 기록이 없어요. 작업 단계마다 Claude Code가 한 줄씩 남겨요.
        </p>
      ) : (
        <ol aria-label="작업 로그" className="flex flex-col border-y border-gray-700">
          {shown.map((row) => {
            const link = refLink(row.ref)
            const style = STATE_STYLE[row.status] ?? STATE_STYLE.info
            return (
              <li
                key={row.id}
                className="flex flex-col gap-0.5 border-b border-gray-700 px-1 py-2 text-sm last:border-b-0 lg:flex-row lg:items-baseline lg:gap-3"
              >
                <span className="flex shrink-0 items-center gap-2 text-xs text-gray-400 tabular-nums">
                  <time dateTime={row.created_at}>{formatAt(row.created_at, new Date(now))}</time>
                  <span className="text-gray-300">{NAME[row.agent] ?? row.agent}</span>
                  <span>{KIND_LABEL[row.kind] ?? row.kind}</span>
                  <span className={style.text}>
                    <span aria-hidden="true">{style.icon}</span>
                    <span className="sr-only">{STATE_LABEL[row.status] ?? row.status}</span>
                  </span>
                </span>
                <span className="min-w-0 flex-1 break-words text-gray-100">
                  {row.summary}
                  {link && (
                    <a href={link.href} target="_blank" rel="noreferrer" className="ml-2 text-xs text-gray-400 underline hover:text-white">
                      {link.label}
                    </a>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      {list.length > SHORT && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="self-start text-xs text-gray-400 underline hover:text-white"
        >
          {expanded ? '접기' : `더 보기 (최근 ${Math.min(list.length, LONG)}건)`}
        </button>
      )}
    </div>
  )
}
