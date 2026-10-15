import NotionPage from '../components/NotionPage.jsx'
import KanbanBoard from '../components/KanbanBoard.jsx'

// 상단은 노션 에디터, 하단은 칸반 보드
export default function Work() {
  return (
    <>
      <NotionPage name="Work" columns={['이름', '태그', '상태']} />
      <KanbanBoard />
    </>
  )
}
