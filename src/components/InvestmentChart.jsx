import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

// 종목 순서대로 돌려 쓰는 파랑/인디고/보라 계열 색 (차트 색, 범례 점 클래스)
const palette = [
  { color: '#3b82f6', dot: 'bg-blue-500' },
  { color: '#6366f1', dot: 'bg-indigo-500' },
  { color: '#8b5cf6', dot: 'bg-violet-500' },
  { color: '#a78bfa', dot: 'bg-violet-400' },
]

// investments 테이블의 수량 비중을 보여주는 도넛 차트와 범례
export default function InvestmentChart({ rows }) {
  const holdings = rows.map((row, index) => ({
    ticker: row.ticker,
    quantity: Number(row.quantity) || 0,
    ...palette[index % palette.length],
  }))
  const total = holdings.reduce((sum, item) => sum + item.quantity, 0) || 1

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-40 w-40 shrink-0" role="img" aria-label="종목별 수량 비중 도넛 차트">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={holdings}
              dataKey="quantity"
              nameKey="ticker"
              innerRadius="60%"
              outerRadius="100%"
              paddingAngle={3}
              stroke="none"
            >
              {holdings.map((item, index) => (
                <Cell key={index} fill={item.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex w-full min-w-0 flex-col gap-2">
        {holdings.map((item, index) => (
          <li key={index} className="flex items-center gap-2 text-sm">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.dot}`} aria-hidden="true" />
            <span className="text-gray-200">{item.ticker}</span>
            <span className="ml-auto text-gray-400">
              {item.quantity}주 · {Math.round((item.quantity / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
