import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import { ko } from '@blocknote/core/locales'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'

const hint = "명령어를 사용하려면 '/'를 입력하세요..."

// 한국어 메뉴를 쓰되, 빈 블록 안내 문구는 기존 디자인의 문구로 바꾼다.
const dictionary = {
  ...ko,
  placeholders: { ...ko.placeholders, default: hint, emptyDocument: hint },
}

// 다크 테마가 적용된 노션 스타일 블록 에디터 (슬래시 명령어 지원).
// 저장 로직이 없으므로 새로고침하면 내용이 사라진다.
export default function NotionEditor() {
  const editor = useCreateBlockNote({ dictionary })

  return (
    <div className="[&_.bn-editor]:bg-transparent! [&_.bn-editor]:px-0! [&_.bn-block-content]:after:not-italic!">
      <BlockNoteView editor={editor} theme="dark" />
    </div>
  )
}
