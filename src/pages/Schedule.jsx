import CalendarGrid from '../components/CalendarGrid.jsx'
import CollapsibleMemo from '../components/CollapsibleMemo.jsx'

// 일정 탭: 월간 달력 → 메모(노션 본문, 기본은 접힘)
export default function Schedule() {
  return (
    <>
      <CalendarGrid />
      <CollapsibleMemo path="/schedule" name="일정" storageKey="schedule-memo-open" className="mx-auto max-w-4xl" />
    </>
  )
}
