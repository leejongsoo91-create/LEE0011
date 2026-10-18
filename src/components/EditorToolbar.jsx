import { FormattingToolbar, FormattingToolbarController, getFormattingToolbarItems } from '@blocknote/react'
import FontSizeSelect from './FontSizeSelect.jsx'

// 글자를 드래그하면 뜨는 플로팅 툴바: 기본 서식 + 글자색 + 형광펜(배경색) + 폰트 크기
export default function EditorToolbar() {
  return (
    <FormattingToolbarController
      formattingToolbar={() => (
        <FormattingToolbar>
          {getFormattingToolbarItems()}
          <FontSizeSelect key="fontSize" />
        </FormattingToolbar>
      )}
    />
  )
}
