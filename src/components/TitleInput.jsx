// 크기별 클래스 (Tailwind가 인식하도록 전체 클래스명을 그대로 적는다)
const sizeClasses = {
  page: 'text-4xl lg:text-5xl',
  modal: 'text-3xl lg:text-4xl',
}

// 노션 페이지처럼 배경이 투명하고 글씨가 큰 제목 입력칸 (상태 관리 없음)
export default function TitleInput({ size = 'page' }) {
  return (
    <input
      type="text"
      aria-label="제목"
      placeholder="제목 없음"
      className={`w-full bg-transparent font-bold text-white outline-none placeholder:text-gray-600 ${sizeClasses[size]}`}
    />
  )
}
