import WidgetBox from './WidgetBox.jsx'
import Badge from './Badge.jsx'

// 티커 뱃지, 수량, 평단가를 우측 정렬로 정리한 미니 리스트 위젯
export default function InvestmentsWidget({ items }) {
  return (
    <WidgetBox title="Investments">
      <ul className="flex flex-col divide-y divide-gray-700">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex min-w-0 flex-col items-start gap-1">
              <Badge tone="emerald">{item.ticker}</Badge>
              <span className="max-w-full truncate text-xs text-gray-400">{item.name}</span>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-semibold tabular-nums text-white">{item.quantity}주</p>
              <p className="text-xs tabular-nums text-gray-400">평단 {item.avgPrice}</p>
            </div>
          </li>
        ))}
      </ul>
    </WidgetBox>
  )
}
