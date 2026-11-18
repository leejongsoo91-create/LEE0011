import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Mic } from 'lucide-react'
import DataState from './DataState.jsx'
import useRows from '../hooks/useRows.js'
import { recentMeetings } from '../utils/today.js'
import { STATUS_LABEL, groupByDay, workLogEntries } from '../utils/workLog.js'

// 업무 탭의 "업무 기록": 회의 기록(Plaud)과 직접 만든 업무를 한국 날짜별로 묶어 제목만 보여 준다 (최신순).
// 제목을 누르면 상세 화면(/work/<id>)에서 내용과 할 일을 고친다.
// recentOnly면 최근 7일 회의만 보여 준다 (요약 띠의 "최근 7일 회의"를 눌렀을 때).
// 고르는 기준은 들어온 시각(created_at, 요약 띠 개수와 같음)이고, 묶는 날짜는 녹음 시각이라 7일보다 앞 날짜 아래 보일 수 있다.
export default function WorkLogList({ recentOnly = false, onClear }) {
  const meetings = useRows('work_meetings')
  const work = useRows('work')
  const entries = recentOnly
    ? workLogEntries(recentMeetings(meetings.rows), work.rows).filter((entry) => entry.kind === 'meeting')
    : workLogEntries(meetings.rows, work.rows)
  const groups = groupByDay(entries)
  // 상세의 "업무 목록"이 이 걸러 보기로 돌아오게 지금 주소를 넘긴다 (WorkDetail BackLink)
  const back = { from: `/work${useLocation().search}` }

  return (
    <section aria-label="업무 기록" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-bold text-gray-100">업무 기록</h2>
        {recentOnly && (
          <button type="button" onClick={onClear} className="py-1 text-xs text-gray-400 underline hover:text-white">
            최근 7일 회의만 보는 중 · 전체 보기
          </button>
        )}
      </div>
      <DataState
        isLoading={meetings.isLoading || work.isLoading}
        isEmpty={groups.length === 0}
        message={recentOnly ? '최근 7일 동안 들어온 회의가 없어요 (들어온 날 기준)' : '아직 업무 기록이 없습니다'}
        hint={recentOnly ? '' : 'Plaud 녹음이 텔레그램 결재를 거쳐 들어오거나, 오른쪽 아래 + 버튼으로 직접 추가할 수 있어요.'}
      >
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <section key={group.day || 'none'} aria-label={group.label} className="flex flex-col gap-1">
              <h3 className="px-1 text-sm font-semibold text-gray-400">{group.label}</h3>
              <ul className="flex flex-col border-y border-gray-700">
                {group.items.map((item) => (
                  <li key={item.id} className="border-b border-gray-700 last:border-b-0">
                    <Link
                      to={`/work/${item.id}`}
                      state={back}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-gray-800/60"
                    >
                      {item.kind === 'meeting' ? (
                        <Mic className="h-4 w-4 shrink-0 text-indigo-400" aria-label="회의 기록" />
                      ) : (
                        <span className="h-4 w-4 shrink-0" aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1 break-words text-gray-100">{item.title || '제목 없음'}</span>
                      <span className="shrink-0 text-xs text-gray-400">
                        {item.kind === 'meeting'
                          ? `할 일 ${item.todos.total} · 완료 ${item.todos.done}`
                          : STATUS_LABEL[item.status] ?? ''}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-600" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DataState>
    </section>
  )
}
