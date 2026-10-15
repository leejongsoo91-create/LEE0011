import TitleInput from './TitleInput.jsx'
import NotionTable from './NotionTable.jsx'
import NotionEditor from './NotionEditor.jsx'

// 제목, 본문 안내, 표 블록으로 이루어진 노션 스타일 페이지 뼈대
export default function NotionPage({ name, columns }) {
  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-8 py-4 lg:py-8">
      <header>
        <TitleInput size="page" />
      </header>
      <section aria-label="본문">
        <NotionEditor />
      </section>
      <NotionTable name={name} columns={columns} />
    </article>
  )
}
