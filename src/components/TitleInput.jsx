// 크기별 클래스 (Tailwind가 인식하도록 전체 클래스명을 그대로 적는다)
const sizeClasses = {
  page: 'text-4xl lg:text-5xl',
  modal: 'text-3xl lg:text-4xl',
}

// 노션 페이지처럼 배경이 투명하고 글씨가 큰 제목 입력칸.
// defaultValue로 처음 값을, onValueChange로 입력값을 주고받는다.
export default function TitleInput({ size = 'page', defaultValue = '', onValueChange }) {
  return (
    <input
      type="text"
      aria-label="제목"
      placeholder="제목 없음"
      defaultValue={defaultValue}
      onChange={(event) => onValueChange?.(event.target.value)}
      className={`w-full bg-transparent font-bold text-white outline-none placeholder:text-gray-600 ${sizeClasses[size]}`}
    />
  )
}
