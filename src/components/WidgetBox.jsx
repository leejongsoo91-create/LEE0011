// 제목과 내용 영역을 가진 공용 박스. 내용은 children으로 전달받는다.
export default function WidgetBox({ title, children }) {
  return (
    <section className="flex min-h-40 flex-col gap-3 rounded-xl bg-gray-800 p-5">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="text-sm text-gray-400">{children}</p>
    </section>
  )
}
