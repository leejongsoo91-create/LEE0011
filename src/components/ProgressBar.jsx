// 진행 바 색상 톤별 클래스 (webkit, firefox 모두 지원)
const barToneClasses = {
  indigo: '[&::-webkit-progress-value]:bg-indigo-500 [&::-moz-progress-bar]:bg-indigo-500',
  emerald: '[&::-webkit-progress-value]:bg-emerald-500 [&::-moz-progress-bar]:bg-emerald-500',
  gray: '[&::-webkit-progress-value]:bg-gray-500 [&::-moz-progress-bar]:bg-gray-500',
}

// 인라인 스타일 없이 시맨틱 progress 요소로 만든 백분율 바
export default function ProgressBar({ value, tone = 'indigo', label }) {
  return (
    <progress
      value={value}
      max={100}
      aria-label={label}
      className={`h-2 w-full appearance-none overflow-hidden rounded-full bg-gray-700 [&::-webkit-progress-bar]:bg-gray-700 [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:rounded-full ${barToneClasses[tone]}`}
    />
  )
}
