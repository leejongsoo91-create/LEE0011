import { summaryBlocks } from '../utils/meetingSummary.js'

const headingClass = {
  1: 'text-lg font-bold text-white',
  2: 'text-base font-bold text-white',
  3: 'text-sm font-semibold text-gray-200',
}

// Plaud가 준 원본 요약(Markdown)을 읽기 전용으로 그린다. HTML을 만들지 않고 글자만 다룬다.
export default function MeetingSummaryView({ markdown }) {
  const blocks = summaryBlocks(markdown)
  if (blocks.length === 0) return <p className="text-sm text-gray-400">원본 요약이 비어 있어요.</p>
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed text-gray-200">
      {blocks.map((block, index) => (
        <SummaryBlock key={index} block={block} />
      ))}
    </div>
  )
}

function SummaryBlock({ block }) {
  if (block.type === 'heading') {
    const Tag = `h${block.level + 2}`
    return <Tag className={`mt-2 break-words ${headingClass[block.level]}`}>{block.text}</Tag>
  }
  if (block.type === 'todo') {
    return (
      <p className={`flex gap-2 break-words ${block.done ? 'text-gray-400 line-through' : ''}`}>
        <span aria-hidden="true">{block.done ? '☑' : '☐'}</span>
        <span className="min-w-0">{block.text}</span>
      </p>
    )
  }
  if (block.type === 'item') {
    return (
      <p className="flex gap-2 break-words">
        <span aria-hidden="true">•</span>
        <span className="min-w-0">{block.text}</span>
      </p>
    )
  }
  if (block.type === 'quote') return <p className="break-words border-l-2 border-gray-600 pl-3 text-gray-300">{block.text}</p>
  return <p className="break-words">{block.text}</p>
}
