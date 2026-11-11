import useDevLog from '../hooks/useDevLog.js'
import { KIND_LABEL, STATE_LABEL, STATE_STYLE, agoLabel, lastLogAt, teamStatus } from '../utils/teamStatus.js'
import AgentLogTimeline from './AgentLogTimeline.jsx'
import Skeleton from './Skeleton.jsx'

// 업무 탭 "개발 팀" 현황판: Lead Coder · QA/Reviewer · DevOps/Monitor 카드 3장 + 작업 로그.
// 실시간 연결이 아니라, Claude Code가 단계마다 남긴 기록(dev_log)으로 상태를 계산한다.
export default function TeamAgentPanel() {
  const { rows, isLoading, now } = useDevLog()
  const members = teamStatus(rows, now)
  const last = lastLogAt(rows)

  return (
    <section aria-labelledby="team-heading" className="flex flex-col gap-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="team-heading" className="text-lg font-bold text-gray-100">
          개발 팀
        </h2>
        <p className="text-xs text-gray-400">{last ? `마지막 기록 ${agoLabel(last, now)}` : '기록 없음'}</p>
      </header>
      {isLoading ? (
        <div role="status" aria-label="불러오는 중" className="grid grid-cols-1 gap-2 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-3">
            {members.map((member) => {
              const style = STATE_STYLE[member.state]
              return (
                <li key={member.id} className="flex flex-col gap-1 rounded-xl border border-gray-700 bg-gray-800 p-4">
                  <p className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold text-white">
                      <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
                      {member.name}
                    </span>
                    <span className={`text-xs font-medium ${style.text}`}>
                      {style.icon} {STATE_LABEL[member.state]}
                    </span>
                  </p>
                  <p className="text-xs text-gray-400">{member.role}</p>
                  <p className="min-h-5 break-words text-sm text-gray-200">
                    {member.last ? `${KIND_LABEL[member.last.kind] ?? ''} · ${member.last.summary}` : '아직 기록이 없어요'}
                  </p>
                  {member.last && <p className="text-xs text-gray-400 tabular-nums">{agoLabel(member.last.created_at, now)}</p>}
                </li>
              )
            })}
          </ul>
          <AgentLogTimeline rows={rows} now={now} />
        </>
      )}
    </section>
  )
}
