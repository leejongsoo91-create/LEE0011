import NotionPage from '../components/NotionPage.jsx'
import KanbanBoard from '../components/KanbanBoard.jsx'
import MeetingList from '../components/MeetingList.jsx'

// 상단은 노션 에디터 + 회의 기록(Plaud), 하단은 칸반 보드
export default function Work() {
  return (
    <>
      <NotionPage name="업무" columns={['이름', '태그', '상태']} table={<MeetingList />} />
      <KanbanBoard />
    </>
  )
}
