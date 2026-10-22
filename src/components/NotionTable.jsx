import { openAddModal } from '../utils/itemEditor.js'

// 빈 행 3개를 보여주기 위한 자리표시용 배열
const emptyRows = [0, 1, 2]

// 노션의 인라인 표(데이터베이스 블록)처럼 생긴 빈 표 UI
export default function NotionTable({ name, columns }) {
  return (
    <section aria-label={`${name} 데이터베이스`}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-gray-700 text-left text-gray-400">
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="border-r border-gray-700 px-3 py-2 font-medium last:border-r-0"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {emptyRows.map((row) => (
              <tr
                key={row}
                className="border-b border-gray-700 transition-colors hover:bg-gray-800/60"
              >
                {columns.map((column) => (
                  <td
                    key={column}
                    className="h-9 border-r border-gray-700 px-3 last:border-r-0"
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => openAddModal()}
        className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
      >
        + 새로 만들기
      </button>
    </section>
  )
}
