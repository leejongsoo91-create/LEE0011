import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useBlockNoteEditor,
} from '@blocknote/react'
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core'
import { Lightbulb } from 'lucide-react'

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
    const calloutItem = {
      key: 'callout',
      title: '콜아웃',
      subtext: '눈에 띄는 강조 패널',
      aliases: ['callout', 'panel', '콜아웃', '강조', '패널'],
      group: '위키 블록',
      icon: <Lightbulb size={18} />,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: 'callout' }),
    }
    return filterSuggestionItems([calloutItem, ...wiki, ...rest], query)
  }

  return <SuggestionMenuController triggerCharacter="/" getItems={getItems} />
}
