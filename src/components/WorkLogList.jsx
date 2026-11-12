import { Link } from 'react-router-dom'
import { ChevronRight, Mic } from 'lucide-react'
import DataState from './DataState.jsx'
import useRows from '../hooks/useRows.js'
import { STATUS_LABEL, groupByDay, workLogEntries } from '../utils/workLog.js'

// 업무 탭의 "업무 기록": 회의 기록(Plaud)과 직접 만든 업무를 한국 날짜별로 묶어 제목만 보여 준다 (최신순).
// 제목을 누르면 상세 화면(/work/<id>)에서 내용과 할 일을 고친다.
export default function WorkLogList() {
  const meetings = useRows('work_meetings')
  const work = useRows('work')
  const groups = groupByDay(workLogEntries(meetings.rows, work.rows))

  return (
    <section aria-label="업무 기록" className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-gray-100">업무 기록</h2>
      <DataState
        isLoading={meetings.isLoading || work.isLoading}
        isEmpty={groups.length === 0}
        message="아직 업무 기록이 없습니다"
        hint="Plaud 녹음이 텔레그램 결재를 거쳐 들어오거나, 오른쪽 아래 + 버튼으로 직접 추가할 수 있어요."
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
