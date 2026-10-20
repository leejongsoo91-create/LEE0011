import { Draggable, Droppable } from '@hello-pangea/dnd'
import ProgressBar from './ProgressBar.jsx'
import { openItemEditor } from '../utils/itemEditor.js'

// 칸반의 한 열: 제목과 드래그 가능한 카드 목록
export default function KanbanColumn({ column }) {
  return (
    <section aria-label={column.title} className="rounded-xl bg-gray-800 p-3">
      <h3 className="mb-3 px-1 text-sm font-medium text-gray-400">
        {column.title} <span className="text-gray-600">{column.cards.length}</span>
      </h3>
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <ul
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex min-h-24 flex-col gap-2 rounded-lg transition-colors ${
              snapshot.isDraggingOver ? 'bg-gray-700/50' : ''
            }`}
          >
            {column.cards.map((card, index) => (
              <Draggable key={card.id} draggableId={card.id} index={index}>
                {(dragProvided, dragSnapshot) => (
                  <li
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    onClick={() => openItemEditor('work', card)}
                    className={`rounded-lg border border-gray-700 bg-gray-900 p-3 text-sm text-gray-200 ${
                      dragSnapshot.isDragging ? 'border-gray-500 shadow-lg' : ''
                    }`}
                  >
                    <p className="mb-2">{card.title || '제목 없음'}</p>
                    <ProgressBar progress={card.progress} />
                  </li>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </ul>
        )}
      </Droppable>
    </section>
  )
}
