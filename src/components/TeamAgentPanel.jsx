import { KIND_LABEL, STATE_LABEL, STATE_STYLE, agoLabel, lastLogAt, teamStatus } from '../utils/teamStatus.js'
import AgentLogTimeline from './AgentLogTimeline.jsx'
import Skeleton from './Skeleton.jsx'
import { scrollToSection } from '../utils/scrollToSection.js'

// 같은 화면 맨 위 전체 현황(#control-overview)으로 돌아가는 링크. 현황판 머리와 작업 로그 끝에 둔다.
function BackToOverview({ className = '' }) {
  return (
    <a
      href="#control-overview"
      onClick={scrollToSection}
      className={`text-xs text-gray-400 underline underline-offset-2 hover:text-white ${className}`}
    >
      <span aria-hidden="true">↑ </span>전체 현황으로
    </a>
  )
}

// 중앙관제 "개발 팀" 현황판: Lead Coder · QA/Reviewer · DevOps/Monitor 카드 3장 + 작업 로그.
// 실시간 연결이 아니라, Claude Code가 단계마다 남긴 기록(dev_log)으로 상태를 계산한다.
// 기록은 관제 화면이 useDevLog()로 한 번 읽어 넘긴다 (요약 카드와 같은 값을 쓰도록).
export default function TeamAgentPanel({ log }) {
  const { rows, isLoading, now } = log
  const members = teamStatus(rows, now)
  const last = lastLogAt(rows)

  return (
    <section id="dev-team" aria-labelledby="team-heading" className="flex scroll-mt-20 flex-col gap-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="team-heading" className="text-lg font-semibold text-white">
          개발 팀
        </h3>
        <div className="flex items-baseline gap-3">
          <p className="text-xs text-gray-400">{last ? `마지막 기록 ${agoLabel(last, now)}` : '기록 없음'}</p>
          {/* 보이는 크기는 그대로, 누르는 영역만 위아래로 넓힘 */}
          <BackToOverview className="-my-2 py-2" />
        </div>
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
          {/* 로그를 다 읽고 내려온 자리에서도 바로 올라가게. 폰에서 누르기 쉽게 높이를 넉넉히 */}
          <BackToOverview className="flex min-h-11 items-center self-center px-4" />
        </>
      )}
    </section>
  )
}
