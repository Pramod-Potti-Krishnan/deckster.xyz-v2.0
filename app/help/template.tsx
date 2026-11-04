import type { ReactNode } from 'react';
import '@/components/help/studio-p2-help.css';

// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off; it also needs the Studio shell, the only place /help has the frame the finishing rules style): the page sits in one display: contents element that studio-p2-help.css hangs on.
// Off: the page is handed through untouched. (A template, not the layout: app/help/layout.tsx is pinned byte for byte by scripts/test-atlas-help-recovery.mjs.)
const STUDIO_P2_HELP = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true';

export default function HelpTemplate({ children }: { children: ReactNode }) {
  if (STUDIO_P2_HELP) return <div data-studio-p2-help="true" style={{ display: 'contents' }}>{children}</div>;
  return children;
}
