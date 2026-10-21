import { DragDropContext } from '@hello-pangea/dnd'
import { toast } from 'sonner'
import KanbanColumn from './KanbanColumn.jsx'
import Skeleton from './Skeleton.jsx'
import EmptyState from './EmptyState.jsx'
import useRows from '../hooks/useRows.js'
import useRowDelete from '../hooks/useRowDelete.js'
import { updateRow } from '../lib/db.js'

// 열 id는 DB의 status 값과 같고, 열마다 진행률(progress)이 정해져 있다.
const statusColumns = [
  { id: 'Todo', title: '할 일', progress: 0 },
  { id: 'In Progress', title: '진행 중', progress: 50 },
  { id: 'Done', title: '완료', progress: 100 },
]

// Supabase의 work 테이블을 읽어 상태별로 보여주는 칸반 보드.
// 카드를 다른 열로 끌면 status와 progress(0/50/100)가 DB에 함께 저장된다.
export default function KanbanBoard() {
  const { rows, setRows, isLoading, reload } = useRows('work')

  const handleDelete = useRowDelete('work', setRows)

  const handleDragEnd = async ({ source, destination, draggableId }) => {
    if (!destination || destination.droppableId === source.droppableId) return
    const target = statusColumns.find((column) => column.id === destination.droppableId)
    const values = { status: target.id, progress: target.progress }
    setRows((prev) => prev.map((row) => (row.id === draggableId ? { ...row, ...values } : row)))
    try {
      await updateRow('work', draggableId, values)
      toast(`'${target.title}'(으)로 이동했습니다`)
    } catch {
      toast.error('변경 사항을 저장하지 못했습니다. 원래 상태로 되돌립니다')
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
        <EmptyState message="아직 등록된 항목이 없습니다" hint="오른쪽 아래 + 버튼을 눌러 Work 페이지에서 첫 업무를 추가해 보세요." />
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {statusColumns.map((column) => (
              <KanbanColumn
                key={column.id}
                onDelete={handleDelete}
                column={{ ...column, cards: rows.filter((row) => row.status === column.id) }}
              />
            ))}
          </div>
        </DragDropContext>
      )}
    </section>
  )
}
