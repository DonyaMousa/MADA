export function GlobeMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="none" stroke="#c6a667" strokeWidth="1.6" />
      <ellipse cx="32" cy="32" rx="12" ry="28" fill="none" stroke="#c6a667" strokeWidth="1.2" />
      <path d="M6 32h52M12 18h40M12 46h40" fill="none" stroke="#c6a667" strokeWidth="1.2" />
      <path d="M32 4c8 10 8 46 0 56" fill="none" stroke="#e4d4a8" strokeWidth="1" />
    </svg>
  )
}

export function ArchitectureMotif() {
  return (
    <svg className="motif" viewBox="0 0 1200 400" preserveAspectRatio="xMaxYMin meet" aria-hidden="true">
      <g fill="none" stroke="#c6a667" strokeWidth="1.2">
        <path d="M820 380 V140 h80 v240" />
        <path d="M860 140 c0-50 80-50 80 0" />
        <path d="M940 380 V160 h70 v220" />
        <path d="M1020 380 V180 h90 v200" />
        <path d="M820 220 h290 M820 280 h290" />
        <circle cx="1100" cy="90" r="46" />
        <ellipse cx="1100" cy="90" rx="18" ry="46" />
        <path d="M1054 90h92 M1100 44v92" />
      </g>
    </svg>
  )
}
