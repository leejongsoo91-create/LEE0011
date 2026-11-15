import CollapsibleMemo from '../components/CollapsibleMemo.jsx'
import HobbyList from '../components/HobbyList.jsx'

// 취미 탭: 취미 목록 → 메모(노션 본문, 기본은 접힘)
export default function Hobbies() {
  return (
    <>
      <HobbyList />
      <CollapsibleMemo path="/hobbies" name="취미" storageKey="hobbies-memo-open" className="mx-auto max-w-4xl" />
    </>
  )
}
