import { useComponentsContext, useBlockNoteEditor } from '@blocknote/react'
import { Type } from 'lucide-react'

const options = [
  { label: '작게', value: 'small' },
  { label: '보통', value: undefined },
  { label: '크게', value: 'large' },
  { label: '아주 크게', value: 'huge' },
]

// 선택한 글자의 크기를 바꾸는 플로팅 툴바 버튼
export default function FontSizeSelect() {
  const Components = useComponentsContext()
  const editor = useBlockNoteEditor()
  const current = editor.getActiveStyles().fontSize

  const apply = (value) => {
    if (value) editor.addStyles({ fontSize: value })
    else editor.removeStyles({ fontSize: current ?? 'large' })
    editor.focus()
  }

  return (
    <Components.Generic.Menu.Root>
      <Components.Generic.Menu.Trigger>
        <Components.FormattingToolbar.Button label="글자 크기" mainTooltip="글자 크기">
          <Type size={16} aria-hidden="true" />
        </Components.FormattingToolbar.Button>
      </Components.Generic.Menu.Trigger>
      <Components.Generic.Menu.Dropdown>
        {options.map((option) => (
          <Components.Generic.Menu.Item
            key={option.label}
            checked={current === option.value}
            onClick={() => apply(option.value)}
          >
            {option.label}
          </Components.Generic.Menu.Item>
        ))}
      </Components.Generic.Menu.Dropdown>
    </Components.Generic.Menu.Root>
  )
}
