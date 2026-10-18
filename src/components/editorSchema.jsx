import { BlockNoteSchema, createCodeBlockSpec, defaultBlockSpecs, defaultStyleSpecs } from '@blocknote/core'
import { createReactStyleSpec } from '@blocknote/react'
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

// 기본 블록(토글 포함)에 문법 색이 입혀지는 코드 블록과 폰트 크기 스타일을 더한 스키마
export const editorSchema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, codeBlock: createCodeBlockSpec(codeBlockOptions) },
  styleSpecs: { ...defaultStyleSpecs, fontSize },
})
