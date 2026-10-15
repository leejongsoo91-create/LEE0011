import TitleInput from './TitleInput.jsx'
import NotionTable from './NotionTable.jsx'

// 제목, 본문 안내, 표 블록으로 이루어진 노션 스타일 페이지 뼈대
export default function NotionPage({ name, columns }) {
  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-8 py-4 lg:py-8">
      <header>
        <TitleInput size="page" />
      </header>
      <section aria-label="본문">
        <p className="text-gray-500">명령어를 사용하려면 '/'를 입력하세요...</p>
      </section>
      <NotionTable name={name} columns={columns} />
    </article>
  )
}
