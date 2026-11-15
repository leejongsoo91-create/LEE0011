import { ExternalLink, ChartLine } from 'lucide-react'
import { STOCKVIEW_URL } from '../utils/stockview.js'

// 주식 탭의 StockView 입구. StockView는 PC에서 켜 둔 때만 열리므로 새 탭으로 연다.
// 폰·태블릿 세로(lg 미만)에서는 열리지 않으니 버튼 대신 안내만 보여 준다.
export default function StockViewCard() {
  return (
    <section aria-labelledby="stockview-title" className="mx-auto max-w-4xl rounded-xl border border-gray-700 bg-gray-800 p-6">
      <h2 id="stockview-title" className="flex items-center gap-2 text-xl font-bold text-white">
        <ChartLine className="h-5 w-5 text-gray-400" aria-hidden="true" />
        StockView
      </h2>
      <p className="mt-1 text-sm text-gray-400">미국·국내 주식 분석 (내 PC 전용)</p>
      <a
        href={STOCKVIEW_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 hidden items-center gap-2 lg:inline-flex rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-[white] transition-colors hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        StockView 열기
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">(새 탭)</span>
      </a>
      <p className="mt-5 rounded-lg border border-gray-700 px-4 py-2.5 text-sm text-gray-300 lg:hidden">PC에서 열어 주세요</p>
      <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-gray-400">
        <li>PC에서 StockView 서버를 켜 둔 때만 열려요</li>
        <li>폰에서는 열리지 않아요</li>
        <li>
          주소: <code className="text-gray-300">{STOCKVIEW_URL}</code>
        </li>
      </ul>
    </section>
  )
}
