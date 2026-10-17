import { Draggable, Droppable } from '@hello-pangea/dnd'
import WidgetBox from './WidgetBox.jsx'
import InvestmentChart from './InvestmentChart.jsx'

const widgetContents = {
  Schedule: '여기에 Schedule 데이터 영역',
  Work: '여기에 Work 데이터 영역',
  Hobbies: '여기에 Hobbies 데이터 영역',
  Investments: <InvestmentChart />,
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
