import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useBlockNoteEditor,
} from '@blocknote/react'
import { filterSuggestionItems } from '@blocknote/core'

// 위키용 블록(코드 블록, 토글 목록)을 슬래시 메뉴 맨 위 '위키 블록' 묶음에 명시적으로 올린다.
const wikiKeys = ['code_block', 'toggle_list']

export default function EditorSlashMenu() {
  const editor = useBlockNoteEditor()

  const getItems = async (query) => {
    const items = getDefaultReactSlashMenuItems(editor)
    const wiki = items
      .filter((item) => wikiKeys.includes(item.key))
      .map((item) => ({ ...item, group: '위키 블록' }))
    const rest = items.filter((item) => !wikiKeys.includes(item.key))
    return filterSuggestionItems([...wiki, ...rest], query)
  }

  return <SuggestionMenuController triggerCharacter="/" getItems={getItems} />
}
