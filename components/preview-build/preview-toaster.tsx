// PL-19: the ONE fixed mark of a Vercel PREVIEW build. This module is NOT imported by any source file. next.config.mjs swaps it in for the root layout's
// `import { Toaster } from '@/components/ui/toaster'` ONLY when Vercel's own VERCEL_ENV says "preview" at build time (see the config), so a production-target
// build (UAT, production, local) compiles exactly the modules it did before and never includes this file.
// It renders the real Toaster (imported by a RELATIVE path on purpose: the build's replacement matches only the '@/...' specifier, so this import is never
// swapped back into itself) plus one plain, fixed, click-through note. Inline styles only: no stylesheet, flag or setting is involved.
import { Toaster as BaseToaster } from '../ui/toaster'

export const PREVIEW_BUILD_MARK_TEXT = 'Preview build: not the UAT product'

export function Toaster() {
  return (
    <>
      <BaseToaster />
      <div
        data-studio-preview-build-mark="true"
        role="note"
        style={{
          position: 'fixed',
          left: 12,
          bottom: 12,
          zIndex: 2147483647,
          padding: '4px 10px',
          borderRadius: 6,
          background: '#111827',
          color: '#ffffff',
          font: '600 12px/1.4 system-ui, sans-serif',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {PREVIEW_BUILD_MARK_TEXT}
      </div>
    </>
  )
}
