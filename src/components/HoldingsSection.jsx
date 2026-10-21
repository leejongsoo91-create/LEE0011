import DataState from './DataState.jsx'
import InvestmentChart from './InvestmentChart.jsx'
import DeleteButton from './DeleteButton.jsx'
import useRowDelete from '../hooks/useRowDelete.js'
import useRows from '../hooks/useRows.js'

// investments 테이블의 보유 종목 비중을 보여주는 섹션
export default function HoldingsSection() {
  const { rows, setRows, isLoading } = useRows('investments')
  const handleDelete = useRowDelete('investments', setRows)

  return (
    <section aria-label="보유 종목" className="mx-auto max-w-4xl pb-8">
      <h2 className="mb-4 text-xl font-bold text-gray-100">보유 종목</h2>
      <DataState isLoading={isLoading} isEmpty={rows.length === 0} message="아직 등록된 항목이 없습니다" hint="오른쪽 아래 + 버튼을 눌러 Investments 페이지에서 첫 종목을 추가해 보세요.">
        <InvestmentChart rows={rows} />
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">보유 종목 목록</caption>
            <thead>
              <tr className="border-y border-gray-700 text-left text-gray-400">
                <th scope="col" className="px-3 py-2 font-medium">티커</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">평단가</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">수량</th>
                <th scope="col" className="w-10 px-1 py-2"><span className="sr-only">삭제</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="group border-b border-gray-700 text-gray-200 transition-colors hover:bg-gray-800/60">
                  <td className="px-3 py-2 font-medium">{row.ticker}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-300">
                    {row.avg_price == null ? '-' : Number(row.avg_price).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-300">{Number(row.quantity) || 0}주</td>
                  <td className="px-1 py-2 text-right">
                    <DeleteButton onDelete={() => handleDelete(row.id)} label={`${row.ticker} 삭제`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
    </section>
  )
}
