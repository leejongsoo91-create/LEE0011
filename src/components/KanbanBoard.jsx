import { useState } from 'react'
import { DragDropContext } from '@hello-pangea/dnd'
import KanbanColumn from './KanbanColumn.jsx'

const initialColumns = [
  { id: 'todo', title: '할 일', cards: [
    { id: 'card-1', text: '주간 업무 정리' },
    { id: 'card-2', text: '기획서 초안 작성' },
    { id: 'card-3', text: '디자인 시안 확인' },
  ] },
  { id: 'doing', title: '진행 중', cards: [
    { id: 'card-4', text: '대시보드 화면 구현' },
    { id: 'card-5', text: '고객 미팅 자료 준비' },
  ] },
  { id: 'done', title: '완료', cards: [
    { id: 'card-6', text: '프로젝트 환경 세팅' },
  ] },
]

// 카드를 드래그해 열 사이를 옮길 수 있는 칸반 보드 뼈대 (새로고침하면 초기화됨)
export default function KanbanBoard() {
  const [columns, setColumns] = useState(initialColumns)

  const handleDragEnd = ({ source, destination }) => {
    if (!destination) return
    const next = columns.map((column) => ({ ...column, cards: [...column.cards] }))
    const from = next.find((column) => column.id === source.droppableId)
    const to = next.find((column) => column.id === destination.droppableId)
    const [moved] = from.cards.splice(source.index, 1)
    to.cards.splice(destination.index, 0, moved)
    setColumns(next)
  }

  return (
    <section aria-label="칸반 보드" className="mx-auto max-w-4xl pb-8">
      <h2 className="mb-4 text-xl font-bold text-gray-100">칸반 보드</h2>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {columns.map((column) => (
            <KanbanColumn key={column.id} column={column} />
          ))}
        </div>
      </DragDropContext>
    </section>
  )
}
