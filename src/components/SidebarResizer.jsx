const minWidth = 200
const maxWidth = 400
const step = 16

export const clampWidth = (value) => Math.min(maxWidth, Math.max(minWidth, value))

// 사이드바 우측 경계선: 마우스로 끌거나 방향키로 너비를 조절한다.
export default function SidebarResizer({ width, onChange }) {
  const handlePointerDown = (event) => event.currentTarget.setPointerCapture(event.pointerId)

  const handlePointerMove = (event) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    onChange(clampWidth(event.clientX))
  }

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowLeft') onChange(clampWidth(width - step))
    if (event.key === 'ArrowRight') onChange(clampWidth(width + step))
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="사이드바 너비 조절"
      aria-valuenow={width}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onKeyDown={handleKeyDown}
      className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none select-none transition-colors hover:bg-indigo-500/40 focus-visible:bg-indigo-500/60 active:bg-indigo-500/60"
    />
  )
}
