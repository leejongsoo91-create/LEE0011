import WidgetBox from './WidgetBox.jsx'
import Badge from './Badge.jsx'
import ProgressBar from './ProgressBar.jsx'

// 상태별 색상 톤
const statusTones = {
  Done: 'emerald',
  'In Progress': 'indigo',
  Todo: 'gray',
}

// 프로젝트 제목과 진행률 바를 보여주는 위젯
export default function WorkWidget({ items }) {
  return (
    <WidgetBox title="Work">
      <ul className="flex flex-col gap-5">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium text-gray-100">{item.title}</span>
              <Badge tone={statusTones[item.status]}>{item.status}</Badge>
            </div>
            <div className="flex items-center gap-3">
              <ProgressBar
                value={item.progress}
                tone={statusTones[item.status]}
                label={`${item.title} 진행률`}
              />
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-gray-400">
                {item.progress}%
              </span>
            </div>
          </li>
        ))}
      </ul>
    </WidgetBox>
  )
}
