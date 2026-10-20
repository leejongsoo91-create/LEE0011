import NotionPage from '../components/NotionPage.jsx'
import HobbyList from '../components/HobbyList.jsx'

// 상단은 노션 에디터, 하단은 취미 목록
export default function Hobbies() {
  return (
    <>
      <NotionPage name="Hobbies" columns={['이름', '태그', '날짜']} />
      <HobbyList />
    </>
  )
}
