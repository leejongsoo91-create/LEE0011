import { DragDropContext } from '@hello-pangea/dnd'
import { toast } from 'sonner'
import KanbanColumn from './KanbanColumn.jsx'
import Skeleton from './Skeleton.jsx'
import EmptyState from './EmptyState.jsx'
import useRows from '../hooks/useRows.js'
import { updateRow } from '../lib/db.js'

// 열 id는 DB의 status 값과 같다.
const statusColumns = [
  { id: 'Todo', title: '할 일' },
  { id: 'In Progress', title: '진행 중' },
  { id: 'Done', title: '완료' },
]

// Supabase의 work 테이블을 읽어 상태별로 보여주는 칸반 보드.
// 카드를 다른 열로 끌면 status가 DB에 저장된다.
export default function KanbanBoard() {
  const { rows, setRows, isLoading, reload } = useRows('work')

  const handleDragEnd = async ({ source, destination, draggableId }) => {
    if (!destination || destination.droppableId === source.droppableId) return
    const status = destination.droppableId
    setRows((prev) => prev.map((row) => (row.id === draggableId ? { ...row, status } : row)))
    try {
      await updateRow('work', draggableId, { status })
    } catch {
      toast.error('변경 사항을 저장하지 못했습니다')
      reload()
    }
  }

  return (
    <section aria-label="칸반 보드" className="mx-auto max-w-4xl pb-8">
      <h2 className="mb-4 text-xl font-bold text-gray-100">칸반 보드</h2>
      {isLoading ? (
        <div role="status" aria-label="불러오는 중" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {statusColumns.map((column) => (
            <div key={column.id} className="flex flex-col gap-2 rounded-xl bg-gray-800 p-3">
              <Skeleton className="mb-1 h-4 w-16" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState message="아직 등록된 업무가 없어요" hint="오른쪽 아래 + 버튼을 눌러 Work 페이지에서 첫 업무를 추가해 보세요." />
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {statusColumns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={{ ...column, cards: rows.filter((row) => row.status === column.id) }}
              />
            ))}
          </div>
        </DragDropContext>
      )}
    </section>
  )
}
