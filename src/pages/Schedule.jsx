import NotionPage from '../components/NotionPage.jsx'
import CalendarGrid from '../components/CalendarGrid.jsx'

// 상단은 노션 에디터, 하단은 월간 달력
export default function Schedule() {
  return (
    <>
      <NotionPage name="Schedule" columns={['이름', '날짜', '태그']} />
      <CalendarGrid />
    </>
  )
}
