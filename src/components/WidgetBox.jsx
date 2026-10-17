// 제목과 내용 영역을 가진 공용 박스. 내용은 children으로 전달받는다.
// handleProps를 받으면 제목 부분이 드래그 손잡이가 된다.
export default function WidgetBox({ title, children, handleProps }) {
  const titleClass = handleProps
    ? 'cursor-grab touch-manipulation select-none text-base font-semibold text-white active:cursor-grabbing'
    : 'text-base font-semibold text-white'

  return (
    <section className="flex h-full min-h-40 flex-col gap-3 rounded-xl bg-gray-800 p-5">
      <h2 className={titleClass} {...handleProps}>
        {title}
      </h2>
      <div className="text-sm text-gray-400">{children}</div>
    </section>
  )
}
