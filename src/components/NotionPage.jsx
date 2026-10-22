import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import TitleInput from './TitleInput.jsx'
import NotionTable from './NotionTable.jsx'
import NotionEditor from './NotionEditor.jsx'
import TocPanel from './TocPanel.jsx'
import Skeleton from './Skeleton.jsx'
import usePageDoc from '../hooks/usePageDoc.js'
import { saveTitle } from '../utils/pageTitle.js'

// 제목, 에디터, 표 블록, 우측 목차로 이루어진 노션 스타일 페이지.
// 제목과 본문은 입력을 멈추면 Supabase에 자동 저장되고, 다른 기기에서도 같은 내용으로 열린다.
export default function NotionPage({ name, columns }) {
  const { pathname } = useLocation()
  // 페이지가 바뀌면 불러오기·저장 상태를 새로 시작한다.
  return <PageBody key={pathname} path={pathname} name={name} columns={columns} />
}

function PageBody({ path, name, columns }) {
  const [headings, setHeadings] = useState([])
  const { status, doc, saveState, change, reload } = usePageDoc(path)

  // 저장된 제목을 빵부스러기에도 반영한다.
  useEffect(() => {
    if (status === 'ready') saveTitle(path, doc?.title ?? '')
  }, [status, doc, path])

  const handleTitle = (value) => {
    saveTitle(path, value)
    change('title', value)
  }

  if (status !== 'ready') {
    return (
      <article className="relative mx-auto flex max-w-4xl flex-col gap-8 py-4 lg:py-8">
        {status === 'loading' ? (
          <div role="status" aria-label="불러오는 중" className="flex flex-col gap-4">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-5/6" />
          </div>
        ) : (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-gray-700 p-6 text-sm">
            <p className="text-gray-300">저장된 내용을 불러오지 못했습니다. 내용을 지키기 위해 편집을 잠시 막았어요.</p>
            <button type="button" onClick={reload} className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-900 hover:bg-white">
              다시 불러오기
            </button>
          </div>
        )}
        <NotionTable name={name} columns={columns} />
      </article>
    )
  }

  return (
    <article className="relative mx-auto flex max-w-4xl flex-col gap-8 py-4 lg:py-8">
      <SaveStatus state={saveState} />
      <header>
        <TitleInput size="page" defaultValue={doc?.title ?? ''} onValueChange={handleTitle} />
      </header>
      <section aria-label="본문">
        <NotionEditor
          initialContent={doc?.content}
          onDocumentChange={(document) => change('content', document)}
          onHeadingsChange={setHeadings}
        />
      </section>
      <NotionTable name={name} columns={columns} />
      <TocPanel headings={headings} />
    </article>
  )
}

const statusText = { saving: '저장 중...', saved: '저장됨', error: '저장 실패' }

// 우측 상단에 작게 보이는 자동 저장 상태 (위쪽 여백에 놓여 다른 내용을 밀지 않는다)
function SaveStatus({ state }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={`pointer-events-none absolute right-0 top-0 text-xs lg:top-2 ${state === 'error' ? 'text-red-400' : 'text-gray-400'}`}
    >
      {statusText[state] ?? ''}
    </p>
  )
}
