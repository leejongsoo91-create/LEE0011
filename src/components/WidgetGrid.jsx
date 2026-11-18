import { useEffect, useState } from 'react'
import { DragDropContext } from '@hello-pangea/dnd'
import WidgetColumn from './WidgetColumn.jsx'
import { readStorage, writeStorage } from '../utils/storage.js'
import { parseWidgetOrder } from '../utils/today.js'

// 데스크톱은 2개 열, 모바일은 1개 열로 보여준다. (lg = 1024px)
const query = '(min-width: 1024px)'

// 두 열을 위에서부터 번갈아 합쳐 모바일용 한 줄 목록을 만든다.
const interleave = ([left, right]) =>
  Array.from({ length: Math.max(left.length, right.length) }).flatMap((_, i) =>
    [left[i], right[i]].filter(Boolean),
  )

const DEFAULT_ORDER = [
  ['Schedule', 'Hobbies'],
  ['Work', 'Investments'],
]
// 상자 순서는 이 기기에만 저장한다 (폰과 노트북은 화면 모양이 달라서, 보고서 11)
const ORDER_KEY = 'home-widget-order'

// 위젯 제목을 잡고 끌어서 순서를 바꿀 수 있는 그리드. 바꾼 순서는 새로고침해도 남는다.
export default function WidgetGrid() {
  const [columns, setColumnsState] = useState(() => parseWidgetOrder(readStorage(ORDER_KEY), DEFAULT_ORDER))
  const setColumns = (next) => {
    setColumnsState(next)
    writeStorage(ORDER_KEY, JSON.stringify(next))
  }
  const [isWide, setIsWide] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const handleChange = (event) => setIsWide(event.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  const lists = isWide ? columns : [interleave(columns)]

  const handleDragEnd = ({ source, destination }) => {
    if (!destination) return
    const next = lists.map((list) => [...list])
    const [moved] = next[Number(source.droppableId)].splice(source.index, 1)
    next[Number(destination.droppableId)].splice(destination.index, 0, moved)
    if (isWide) return setColumns(next)
    // 모바일에서는 한 줄 순서를 다시 두 열로 나눠 데스크톱 배치와 맞춘다.
    setColumns([next[0].filter((_, i) => i % 2 === 0), next[0].filter((_, i) => i % 2 === 1)])
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {lists.map((titles, index) => (
          <WidgetColumn key={index} id={String(index)} titles={titles} />
        ))}
      </div>
    </DragDropContext>
  )
}
