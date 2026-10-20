const inputClass =
  'w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 outline-none placeholder:text-gray-600 focus:border-gray-500'

// 투자 항목 입력칸: 티커, 평균 단가, 수량 (종목명은 모달의 제목 입력칸을 쓴다)
export default function InvestmentFields({ values, onChange }) {
  const fields = [
    { key: 'ticker', label: '티커', placeholder: '예: QQQM', type: 'text' },
    { key: 'avg_price', label: '평균 단가', placeholder: '0', type: 'number' },
    { key: 'quantity', label: '수량', placeholder: '0', type: 'number' },
  ]

  return (
    <section aria-label="투자 정보" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {fields.map((field) => (
        <label key={field.key} className="flex flex-col gap-1 text-xs text-gray-400">
          {field.label}
          <input
            type={field.type}
            inputMode={field.type === 'number' ? 'decimal' : undefined}
            min={field.type === 'number' ? 0 : undefined}
            placeholder={field.placeholder}
            value={values[field.key]}
            onChange={(event) => onChange({ ...values, [field.key]: event.target.value })}
            className={inputClass}
          />
        </label>
      ))}
    </section>
  )
}
