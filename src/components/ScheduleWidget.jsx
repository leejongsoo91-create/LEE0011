import WidgetBox from './WidgetBox.jsx'
import Badge from './Badge.jsx'

// 다가오는 일정을 날짜 뱃지와 함께 보여주는 위젯
export default function ScheduleWidget({ items }) {
  return (
    <WidgetBox title="Schedule">
      <ul className="flex flex-col divide-y divide-gray-700">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
          >
            <Badge tone="indigo">
              <time dateTime={item.date}>{item.date.slice(5).replace('-', '/')}</time>
            </Badge>
            <span className="text-gray-100">{item.title}</span>
          </li>
        ))}
      </ul>
    </WidgetBox>
  )
}
