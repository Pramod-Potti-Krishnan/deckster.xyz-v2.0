export function SlideChip({ number, total = 10, label }: { number: number; total?: number; label: string }) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return (
    <div className="slide__chip">
      <b>{pad(number)}</b><span>/ {pad(total)}</span><i />{label}
    </div>
  )
}
