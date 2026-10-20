import DataState from './DataState.jsx'
import useRows from '../hooks/useRows.js'

// hobbies 테이블의 항목을 보여주는 목록
export default function HobbyList() {
  const { rows, isLoading } = useRows('hobbies')

  return (
    <section aria-label="취미 목록" className="mx-auto max-w-4xl pb-8">
      <h2 className="mb-4 text-xl font-bold text-gray-100">취미 목록</h2>
      <DataState isLoading={isLoading} isEmpty={rows.length === 0} message="등록된 취미가 없어요" hint="오른쪽 아래 + 버튼을 눌러 Hobbies 페이지에서 첫 항목을 추가해 보세요.">
        <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id} className="min-w-0 rounded-lg border border-gray-700 bg-gray-800 p-3 text-sm text-gray-200">
              <p className="truncate font-medium">{row.title || '제목 없음'}</p>
              {row.details && <p className="mt-1 truncate text-xs text-gray-400">{row.details}</p>}
            </li>
          ))}
        </ul>
      </DataState>
    </section>
  )
}
