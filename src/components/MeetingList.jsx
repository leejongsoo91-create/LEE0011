import { useState } from 'react'
import DataState from './DataState.jsx'
import DeleteButton from './DeleteButton.jsx'
import MeetingSummaryModal from './MeetingSummaryModal.jsx'
import useRows from '../hooks/useRows.js'
import useRowDelete from '../hooks/useRowDelete.js'
import { meetingTime } from '../utils/meetingSummary.js'

// 업무 페이지의 "회의 기록" 표: Plaud 녹음이 텔레그램 결재를 거쳐 들어온 회의들 (최신순).
// 줄을 누르면 요약을 읽기 전용으로 보여준다. 회의 기록을 지워도 거기서 나온 칸반 카드는 남는다.
export default function MeetingList() {
  const { rows, setRows, isLoading } = useRows('work_meetings')
  const handleDelete = useRowDelete('work_meetings', setRows)
  const [open, setOpen] = useState(null)

  return (
    <section aria-label="회의 기록" className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-gray-100">회의 기록</h2>
      <DataState
        isLoading={isLoading}
        isEmpty={rows.length === 0}
        message="아직 들어온 회의 기록이 없습니다"
        hint="Plaud 녹음 요약이 끝나면 텔레그램으로 결재가 오고, 승인하면 여기에 들어와요."
      >
        <ul className="flex flex-col border-y border-gray-700">
          {rows.map((meeting) => (
            <li key={meeting.id} className="group relative border-b border-gray-700 last:border-b-0">
              <button
                type="button"
                onClick={() => setOpen(meeting)}
                className="flex w-full flex-col gap-1 px-3 py-2.5 pr-10 text-left text-sm transition-colors hover:bg-gray-800/60 lg:flex-row lg:items-center lg:gap-4"
              >
                <span className="min-w-0 flex-1 break-words text-gray-100">{meeting.title}</span>
                <span className="flex shrink-0 gap-3 text-xs text-gray-400">
                  <span>{meetingTime(meeting.recorded_at) || '시각 모름'}</span>
                  <span>할 일 {meeting.todo_count ?? 0}개</span>
                </span>
              </button>
              <DeleteButton
                onDelete={() => handleDelete(meeting.id)}
                label={`${meeting.title} 회의 기록 삭제`}
                className="absolute right-2 top-2.5"
              />
            </li>
          ))}
        </ul>
      </DataState>
      {open && <MeetingSummaryModal meeting={open} onClose={() => setOpen(null)} />}
    </section>
  )
}
