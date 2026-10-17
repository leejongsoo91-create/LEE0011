import { useEffect, useState } from 'react'
import { DragDropContext } from '@hello-pangea/dnd'
import WidgetColumn from './WidgetColumn.jsx'

// 데스크톱은 2개 열, 모바일은 1개 열로 보여준다. (lg = 1024px)
const query = '(min-width: 1024px)'

// 두 열을 위에서부터 번갈아 합쳐 모바일용 한 줄 목록을 만든다.
const interleave = ([left, right]) =>
  Array.from({ length: Math.max(left.length, right.length) }).flatMap((_, i) =>
    [left[i], right[i]].filter(Boolean),
  )

// 위젯 제목을 잡고 끌어서 순서를 바꿀 수 있는 그리드 (새로고침하면 초기화됨)
export default function WidgetGrid() {
  const [columns, setColumns] = useState([
    ['Schedule', 'Hobbies'],
    ['Work', 'Investments'],
  ])
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
