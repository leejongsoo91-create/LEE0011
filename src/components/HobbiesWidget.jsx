import WidgetBox from './WidgetBox.jsx'

// 제목은 진하게, 요약은 작은 회색 글씨로 보여주는 카드 리스트 위젯
export default function HobbiesWidget({ items }) {
  return (
    <WidgetBox title="Hobbies">
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg bg-gray-700/40 p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-white">{item.title}</p>
              <time dateTime={item.date} className="shrink-0 text-xs text-gray-500">
                {item.date.slice(5).replace('-', '/')}
              </time>
            </div>
            <p className="mt-1 text-xs text-gray-400">{item.details}</p>
          </li>
        ))}
      </ul>
    </WidgetBox>
  )
}
