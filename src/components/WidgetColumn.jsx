import { Draggable, Droppable } from '@hello-pangea/dnd'
import WidgetBox from './WidgetBox.jsx'
import { HobbiesSummary, InvestmentsSummary, ScheduleSummary, WorkSummary } from './HomeSummaries.jsx'

// 위젯 제목 → 내용 (Supabase에서 불러온 요약)
const widgetContents = {
  Schedule: <ScheduleSummary />,
  Work: <WorkSummary />,
  Hobbies: <HobbiesSummary />,
  Investments: <InvestmentsSummary />,
}

// 드래그 가능한 위젯들이 세로로 쌓이는 한 개의 열
export default function WidgetColumn({ id, titles }) {
  return (
    <Droppable droppableId={id}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className="flex min-w-0 flex-col gap-4 lg:gap-6"
        >
          {titles.map((title, index) => (
            <Draggable key={title} draggableId={title} index={index}>
              {(dragProvided) => (
                <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                  <WidgetBox title={title} handleProps={dragProvided.dragHandleProps}>
                    {widgetContents[title]}
                  </WidgetBox>
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  )
}
