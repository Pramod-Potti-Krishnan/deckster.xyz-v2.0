"use client"

import './studio-edit-mode-guide.css'

const STUDIO_EDIT_GUIDE = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

/** Exact native instructions; this leaf does not enter edit mode or send commands. */
export function EditModeGuide() {
  return (
    <div
      data-studio-edit-guide={STUDIO_EDIT_GUIDE ? 'true' : undefined}
      role={STUDIO_EDIT_GUIDE ? 'region' : undefined}
      aria-label={STUDIO_EDIT_GUIDE ? 'Edit mode instructions' : undefined}
      tabIndex={STUDIO_EDIT_GUIDE ? 0 : undefined}
      className="absolute bottom-0 left-0 right-0 px-3 py-1 text-[10px] text-stone-400"
    >
      <span className="font-semibold text-stone-300">Edit Mode:</span> Click on any text to edit. Select text for formatting toolbar.
      <span className="ml-1.5 text-[9px] text-stone-500">
        Ctrl+B (Bold), Ctrl+I (Italic), Ctrl+U (Underline), Ctrl+S (Save)
      </span>
    </div>
  )
}
