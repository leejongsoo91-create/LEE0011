import { BlockNoteSchema, createCodeBlockSpec, defaultBlockSpecs, defaultStyleSpecs } from '@blocknote/core'
import { createReactBlockSpec, createReactStyleSpec } from '@blocknote/react'
import { Lightbulb } from 'lucide-react'
import { codeBlockOptions } from '@blocknote/code-block'

// 글자 크기 값 → Tailwind 클래스 (전체 클래스명을 그대로 적어야 Tailwind가 인식한다)
export const fontSizeClasses = {
  small: 'text-sm',
  large: 'text-xl',
  huge: 'text-3xl',
}

// 선택한 글자에만 적용되는 '폰트 크기' 스타일
const fontSize = createReactStyleSpec(
  { type: 'fontSize', propSchema: 'string' },
  {
    render: ({ value, contentRef }) => (
      <span ref={contentRef} className={fontSizeClasses[value]} />
    ),
  },
)

// 강조 패널(콜아웃) 블록: 전구 아이콘과 함께 내용을 눈에 띄는 상자에 담는다.
// 색은 대시보드 톤(bg-gray-800 계열 + 인디고 포인트)에 맞추고, 라이트 모드에서는 gray 스케일이 자동으로 뒤집힌다.
const callout = createReactBlockSpec(
  { type: 'callout', propSchema: {}, content: 'inline' },
  {
    render: ({ contentRef }) => (
      <div className="callout-block flex w-full items-start gap-3 rounded-lg border border-gray-700 border-l-4 border-l-indigo-400 bg-gray-800 px-4 py-3">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-indigo-300" aria-hidden="true" contentEditable={false} />
        <div ref={contentRef} className="min-w-0 flex-1 text-gray-100" />
      </div>
    ),
  },
)

// 기본 블록(토글 포함)에 문법 색이 입혀지는 코드 블록과 폰트 크기 스타일을 더한 스키마
export const editorSchema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, codeBlock: createCodeBlockSpec(codeBlockOptions), callout: callout() },
  styleSpecs: { ...defaultStyleSpecs, fontSize },
})
