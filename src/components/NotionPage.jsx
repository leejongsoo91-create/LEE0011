import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import TitleInput from './TitleInput.jsx'
import NotionTable from './NotionTable.jsx'
import NotionEditor from './NotionEditor.jsx'
import TocPanel from './TocPanel.jsx'
import { loadTitle, saveTitle } from '../utils/pageTitle.js'

// 제목, 에디터, 표 블록, 우측 목차로 이루어진 노션 스타일 페이지
export default function NotionPage({ name, columns }) {
  const { pathname } = useLocation()
  const [headings, setHeadings] = useState([])

  return (
    <article className="relative mx-auto flex max-w-4xl flex-col gap-8 py-4 lg:py-8">
      <header>
        <TitleInput size="page" defaultValue={loadTitle(pathname)} onValueChange={(value) => saveTitle(pathname, value)} />
      </header>
      <section aria-label="본문">
        <NotionEditor onHeadingsChange={setHeadings} />
      </section>
      <NotionTable name={name} columns={columns} />
      <TocPanel headings={headings} />
    </article>
  )
}
