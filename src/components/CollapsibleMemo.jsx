import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import NotionPage from './NotionPage.jsx'
import { loadPage } from '../lib/db.js'
import { loadTitle, saveTitle } from '../utils/pageTitle.js'
import { readStorage, writeStorage } from '../utils/storage.js'

// 탭 아래쪽의 "메모" (노션 본문, 기본은 접힘). 업무·일정·취미 탭이 같이 쓴다.
// 열었는지만 기기에 기억한다(storageKey). 접혀 있으면 에디터를 아예 불러오지 않는다.
// 메모 아래의 빈 표 블록은 쓰지 않는다 (탭마다 목록·달력이 위에 따로 있음).
// path는 그 탭의 라우트 주소와 같아야 한다: NotionPage는 현재 주소(useLocation)로 본문을 열고, 제목은 path로 읽는다.
export default function CollapsibleMemo({ path, name, storageKey, className = '' }) {
  const [open, setOpen] = useState(() => readStorage(storageKey) === '1')
  const toggle = () => {
    const next = !open
    writeStorage(storageKey, next ? '1' : '0')
    setOpen(next)
  }

  // 메모가 접혀 있으면 NotionPage가 제목을 알려 주지 않으므로, 빵부스러기용 제목만 따로 읽는다
  useEffect(() => {
    // 이미 기억된 제목이 있으면 읽지 않는다 (메모를 막 접을 때 저장과 겹쳐 옛 제목을 받는 것을 막는다)
    if (open || loadTitle(path)) return
    let cancelled = false
    loadPage(path)
      .then((page) => !cancelled && saveTitle(path, page?.title ?? ''))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, path])

  return (
    <section aria-label="메모" className={`flex flex-col gap-2 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center gap-2 self-start rounded-lg px-1 py-1 text-lg font-bold text-gray-100 hover:text-white"
      >
        <ChevronDown className={`h-5 w-5 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
        메모
      </button>
      {open && <NotionPage name={name} table={false} />}
    </section>
  )
}
