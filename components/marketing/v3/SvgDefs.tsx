export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="lgv" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7C6EFF" />
          <stop offset="1" stopColor="#4433E6" />
        </linearGradient>
        {/* Logo L-B "Zoom" (PK, 3 Oct): a deck tile holding a slide holding a coral element — deck → slide → element. */}
        <symbol id="logo" viewBox="0 0 64 64">
          <rect x="4" y="4" width="56" height="56" rx="15" fill="url(#lgv)" />
          <rect x="17" y="19" width="38" height="28" rx="5.5" fill="#fff" />
          <rect x="21.5" y="23.5" width="14" height="3" rx="1.5" fill="#B9B1FF" />
          <rect x="21.5" y="29" width="9" height="2.4" rx="1.2" fill="#DAD6FF" />
          <rect x="35" y="31" width="15" height="11" rx="2.5" fill="#FF6A4D" />
          <path d="M9.5 17V12.5a3 3 0 0 1 3-3H17M47 9.5h4.5a3 3 0 0 1 3 3V17" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2.4" strokeLinecap="round" />
        </symbol>
        <symbol id="arrow" viewBox="0 0 24 24">
          <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
      </defs>
    </svg>
  )
}
