export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="lgg" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#2E2ADB" />
          <stop offset="1" stopColor="#8A5CF6" />
        </linearGradient>
        <symbol id="logo" viewBox="0 0 64 64">
          <g transform="skewY(-7)">
            <rect x="25" y="10" width="34" height="26" rx="7" fill="#C2B4FF" />
            <rect x="15" y="17" width="36" height="27" rx="7" fill="#A084FF" />
            <rect x="4" y="25" width="38" height="29" rx="7" fill="url(#lgg)" />
          </g>
          <path d="M18 28l2.6 7.4 7.4 2.6-7.4 2.6L18 48l-2.6-7.4L8 38l7.4-2.6z" fill="#fff" />
          <path d="M29 24l1.2 3.4 3.4 1.2-3.4 1.2L29 33l-1.2-3.4-3.4-1.2 3.4-1.2z" fill="#fff" opacity=".8" />
          <path d="M28 40l1.2 3.4 3.4 1.2-3.4 1.2L28 49l-1.2-3.4-3.4-1.2 3.4-1.2z" fill="#fff" opacity=".8" />
        </symbol>
        <symbol id="arrow" viewBox="0 0 24 24">
          <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
      </defs>
    </svg>
  )
}
