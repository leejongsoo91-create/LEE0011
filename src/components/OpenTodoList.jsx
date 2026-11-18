import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import DataState from './DataState.jsx'
import useRows from '../hooks/useRows.js'
import { kstDate } from '../utils/controlTime.js'
import { dueLabel, filterOpenWork } from '../utils/today.js'
import { STATUS_LABEL } from '../utils/workLog.js'

const FILTER_LABEL = { todo: '할 일', doing: '진행 중', due: '오늘·지난 마감' }
const FILTER_EMPTY = { todo: '할 일 상태인 업무가 없어요', doing: '진행 중인 업무가 없어요', due: '오늘·지난 마감 업무가 없어요' }
const clearButton = 'py-1 text-xs text-gray-400 underline hover:text-white'

// 업무 탭 "남은 할 일" (보고서 11 2단계): 직접 만든 업무와 회의에서 나온 할 일 중 끝나지 않은 것을 마감 순으로 한데 모은다.
// show(할 일·진행 중·마감)가 있으면 그것만. 누르면 상세로 가고, 회의에서 나온 할 일은 상세 화면이 그 회의로 보낸다.
// 완료 처리는 여기서 하지 않는다 (상세 화면에서).
export default function OpenTodoList({ show, onClear }) {
  const work = useRows('work')
  const meetings = useRows('work_meetings')
  const loading = work.isLoading || meetings.isLoading
  // 상세의 "업무 목록"이 이 걸러 보기로 돌아오게 지금 주소를 넘긴다 (WorkDetail BackLink)
  const back = { from: `/work${useLocation().search}` }
  const today = kstDate()
  const filter = FILTER_LABEL[show] ? show : ''
  const rows = filterOpenWork(work.rows, filter, today)
  const meetingTitle = new Map(meetings.rows.map((row) => [row.id, row.title]))

  return (
    <section aria-label="남은 할 일" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-bold text-gray-100">남은 할 일</h2>
        {!loading && <span className="text-sm text-gray-400 tabular-nums">{rows.length}건</span>}
        {filter && (
          <button type="button" onClick={onClear} className={clearButton}>
            {FILTER_LABEL[filter]}만 보는 중 · 전체 보기
          </button>
        )}
      </div>
      <DataState
        isLoading={loading}
        isEmpty={rows.length === 0}
        message={FILTER_EMPTY[filter] ?? '남은 할 일이 없어요'}
        hint={filter ? '' : '회의에서 나온 할 일과 직접 만든 업무 중 끝나지 않은 것이 여기에 모여요.'}
      >
        <ul className="flex flex-col border-y border-gray-700">
          {rows.map((row) => {
            const due = dueLabel(row.due_date, today)
            const overdue = due.endsWith('지남')
            const meta = [row.assignee, meetingTitle.get(row.meeting_id)].filter(Boolean).join(' · ')
            return (
              <li key={row.id} className="border-b border-gray-700 last:border-b-0">
                <Link to={`/work/${row.id}`} state={back} className="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-gray-800/60">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-gray-100">{row.title || '제목 없음'}</span>
                    {meta && <span className="truncate text-xs text-gray-500">{meta}</span>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs">
                    <span className="text-gray-400">{STATUS_LABEL[row.status] ?? '할 일'}</span>
                    {due && <span className={overdue ? 'text-amber-700 dark:text-amber-400' : 'text-gray-400'}>{due}</span>}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-600" aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      </DataState>
    </section>
  )
}
