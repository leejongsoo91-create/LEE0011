import DataState from './DataState.jsx'
import InvestmentChart from './InvestmentChart.jsx'
import useRows from '../hooks/useRows.js'

// investments 테이블의 보유 종목 비중을 보여주는 섹션
export default function HoldingsSection() {
  const { rows, isLoading } = useRows('investments')

  return (
    <section aria-label="보유 종목" className="mx-auto max-w-4xl pb-8">
      <h2 className="mb-4 text-xl font-bold text-gray-100">보유 종목</h2>
      <DataState isLoading={isLoading} isEmpty={rows.length === 0} message="보유 종목이 없어요" hint="Supabase의 investments 테이블에 종목을 추가하면 비중이 표시됩니다.">
        <InvestmentChart rows={rows} />
      </DataState>
    </section>
  )
}
