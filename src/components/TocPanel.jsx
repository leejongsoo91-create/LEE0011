const indentClasses = { 1: 'pl-0', 2: 'pl-3', 3: 'pl-6' }

// 에디터 우측 여백에 고정되는 목차 패널 (현재 문서의 H1~H3)
export default function TocPanel({ headings }) {
  const handleClick = (id) => {
    document.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <aside
      aria-label="목차"
      className="absolute top-0 left-full ml-3 hidden h-full w-32 @min-[1112px]:block"
    >
      <nav className="sticky top-24 rounded-xl border border-gray-700 p-3">
        <p className="mb-2 text-xs font-semibold text-gray-400">목차</p>
        {headings.length === 0 ? (
          <p className="text-xs text-gray-400">제목(H1~H3)을 추가하면 여기에 표시됩니다.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {headings.map((heading) => (
              <li key={heading.id} className={indentClasses[heading.level]}>
                <button
                  type="button"
                  onClick={() => handleClick(heading.id)}
                  className="block w-full truncate text-left text-xs text-gray-300 transition-colors hover:text-white"
                >
                  {heading.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  )
}
