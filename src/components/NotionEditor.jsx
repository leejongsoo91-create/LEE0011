import { useEffect } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import { ko } from '@blocknote/core/locales'
import { syntaxHighlighter } from '@blocknote/code-block'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { editorSchema } from './editorSchema.jsx'
import EditorToolbar from './EditorToolbar.jsx'
import EditorSlashMenu from './EditorSlashMenu.jsx'
import useTheme from '../hooks/useTheme.js'
import { readJson, writeStorage } from '../utils/storage.js'
import { extractHeadings } from '../utils/headings.js'

const hint = "명령어를 사용하려면 '/'를 입력하세요..."

// 한국어 메뉴를 쓰되, 빈 블록 안내 문구는 기존 디자인의 문구로 바꾼다.
const dictionary = {
  ...ko,
  placeholders: { ...ko.placeholders, default: hint, emptyDocument: hint },
}

// 제목 크기 구분(H1~H3), 코드 블록 색, 서식 툴바 크기를 다크/라이트 모두에서 잡아 주는 Tailwind 규칙
const wrapperClass = [
  '[&_.bn-editor]:bg-transparent! [&_.bn-editor]:px-0! [&_.bn-block-content]:after:not-italic!',
  '[&_h1]:text-4xl! [&_h1]:font-extrabold! [&_h1]:text-gray-50!',
  '[&_h2]:text-2xl! [&_h2]:font-bold! [&_h2]:text-indigo-600! dark:[&_h2]:text-indigo-300!',
  '[&_h3]:text-lg! [&_h3]:font-semibold! [&_h3]:text-violet-600! dark:[&_h3]:text-violet-300!',
].join(' ')

// 서식 툴바, 코드/토글 블록, 자동저장(localStorage)을 갖춘 노션 스타일 블록 에디터.
// storageKey가 있으면 입력 내용이 브라우저에만 임시 저장되어 새로고침해도 유지된다.
export default function NotionEditor({ storageKey, onHeadingsChange }) {
  const theme = useTheme()
  const saved = storageKey ? readJson(storageKey, null) : null
  const editor = useCreateBlockNote({
    schema: editorSchema,
    dictionary,
    extensions: [syntaxHighlighter],
    initialContent: Array.isArray(saved) && saved.length > 0 ? saved : undefined,
  })

  useEffect(() => {
    onHeadingsChange?.(extractHeadings(editor.document))
  }, [editor, onHeadingsChange])

  const handleChange = () => {
    if (storageKey) writeStorage(storageKey, JSON.stringify(editor.document))
    onHeadingsChange?.(extractHeadings(editor.document))
  }

  return (
    <div className={wrapperClass}>
      <BlockNoteView editor={editor} theme={theme} formattingToolbar={false} onChange={handleChange} slashMenu={false}>
        <EditorToolbar />
        <EditorSlashMenu />
      </BlockNoteView>
    </div>
  )
}
