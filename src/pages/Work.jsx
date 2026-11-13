import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import NotionPage from '../components/NotionPage.jsx'
import WorkLogList from '../components/WorkLogList.jsx'
import WorkSummaryBar from '../components/WorkSummaryBar.jsx'
import { loadPage } from '../lib/db.js'
import { loadTitle, saveTitle } from '../utils/pageTitle.js'
import { readStorage, writeStorage } from '../utils/storage.js'

const MEMO_KEY = 'work-memo-open'

// 업무 탭: 요약 → 업무 기록(날짜별 제목, 누르면 상세) → 메모(노션 본문, 기본은 접힘)
export default function Work() {
  // 메모는 열었는지만 기기에 기억한다. 접혀 있으면 에디터를 아예 불러오지 않는다.
  const [memoOpen, setMemoOpen] = useState(() => readStorage(MEMO_KEY) === '1')
  const toggleMemo = () => {
    const next = !memoOpen
    writeStorage(MEMO_KEY, next ? '1' : '0')
    setMemoOpen(next)
  }

  // 메모가 접혀 있으면 NotionPage가 제목을 알려 주지 않으므로, 빵부스러기용 제목만 따로 읽는다
  useEffect(() => {
    // 이미 기억된 제목이 있으면 읽지 않는다 (메모를 막 접을 때 저장과 겹쳐 옛 제목을 받는 것을 막는다)
    if (memoOpen || loadTitle('/work')) return
    let cancelled = false
    loadPage('/work')
      .then((page) => !cancelled && saveTitle('/work', page?.title ?? ''))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [memoOpen])

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <WorkSummaryBar />
      <WorkLogList />
      <section aria-label="메모" className="-mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={toggleMemo}
          aria-expanded={memoOpen}
          className="flex items-center gap-2 self-start rounded-lg px-1 py-1 text-lg font-bold text-gray-100 hover:text-white"
        >
          <ChevronDown className={`h-5 w-5 transition-transform ${memoOpen ? '' : '-rotate-90'}`} aria-hidden="true" />
          메모
        </button>
        {/* table={false}: 메모 아래의 빈 표 블록은 업무 탭에서 쓰지 않는다 (업무 기록이 위에 따로 있음) */}
        {memoOpen && <NotionPage name="업무" columns={['이름', '태그', '상태']} table={false} />}
      </section>
    </div>
  )
}
