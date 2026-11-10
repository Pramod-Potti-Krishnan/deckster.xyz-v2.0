"use client"

import { Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SaveStatus } from './save-status-indicator'
import './studio-toolbar-save-feedback.css'

const STUDIO_SAVE_FEEDBACK = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

interface ToolbarSaveFeedbackProps {
  saveStatus: SaveStatus
  isSaving: boolean
  viewerIsReady: boolean
  onSave: () => void
  toolbarButtonClass: string
  toolbarLabelClass: string
}

/** Pure presentation of native save state; no save, retry or acknowledgement logic lives here. */
export function StudioToolbarSaveFeedback({ saveStatus, isSaving, viewerIsReady, onSave, toolbarButtonClass, toolbarLabelClass }: ToolbarSaveFeedbackProps) {
  return saveStatus === 'saving' || isSaving ? (
    <div
      data-studio-v4-shell={STUDIO_SAVE_FEEDBACK ? 'true' : undefined}
      data-studio-toolbar-save={STUDIO_SAVE_FEEDBACK ? 'true' : undefined}
      data-save-state={STUDIO_SAVE_FEEDBACK ? 'saving' : undefined}
      role={STUDIO_SAVE_FEEDBACK ? 'status' : undefined}
      aria-live={STUDIO_SAVE_FEEDBACK ? 'polite' : undefined}
      aria-label={STUDIO_SAVE_FEEDBACK ? 'Saving changes' : undefined}
      className={cn(toolbarButtonClass, "text-slate-600 dark:text-slate-300 cursor-default")}
      title="Saving…"
    >
      <div className="h-5 w-5 flex items-center justify-center">
        <div className="h-3.5 w-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
      </div>
      <span className={toolbarLabelClass}>Saving</span>
    </div>
  ) : saveStatus === 'unsaved' || saveStatus === 'error' ? (
    <button
      data-studio-v4-shell={STUDIO_SAVE_FEEDBACK ? 'true' : undefined}
      data-studio-toolbar-save={STUDIO_SAVE_FEEDBACK ? 'true' : undefined}
      data-save-state={STUDIO_SAVE_FEEDBACK ? saveStatus : undefined}
      aria-live={STUDIO_SAVE_FEEDBACK ? 'polite' : undefined}
      aria-label={STUDIO_SAVE_FEEDBACK ? saveStatus === 'error' ? 'Save failed. Save changes now' : 'Unsaved changes. Save changes now' : undefined}
      onClick={onSave}
      disabled={isSaving || !viewerIsReady}
      className={cn(toolbarButtonClass, "bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 dark:text-amber-200")}
      title="Save changes now"
    >
      <Save className="h-5 w-5" />
      <span className={toolbarLabelClass}>{STUDIO_SAVE_FEEDBACK ? saveStatus === 'error' ? 'Save failed' : 'Unsaved' : 'Save'}</span>
    </button>
  ) : null
}
