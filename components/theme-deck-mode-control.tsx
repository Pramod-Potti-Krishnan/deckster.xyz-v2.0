"use client"

// P2C (flag NEXT_PUBLIC_THEME_DARK_MODE_ENABLED): Light or Dark for the whole deck, drawn for both deck-theme panels (`variant`). The panel renders this
// only with the flag on, and owns the draft, the staged mode and the lock rule. Before the build it is a Light | Dark segment on the draft. On a built deck
// (`locked`) it is one action, "Rebuild in dark" / "Rebuild in light", that only stages the choice: no rebuild exists to run, and a changed theme selection
// would make the page send `set_theme`. The picker's look reads its --stp-* tokens, so no stylesheet changes.
import { cn } from '@/lib/utils'
import {
  existingDeckActionLabel,
  existingDeckNote,
  nextStagedMode,
  otherPaletteMode,
  paletteModeLabel,
  type DeckPaletteMode,
} from '@/lib/studio-theme-dark-toggle'

const DECK_MODE_STYLES = {
  plain: {
    wrap: 'border-b border-gray-200 px-3 py-2',
    label: 'text-[10px] font-semibold uppercase tracking-wider text-gray-500',
    segment: 'mt-1.5 flex rounded-lg bg-gray-100 p-0.5',
    option: 'flex flex-1 items-center justify-center rounded-md px-2 py-1 text-[11px] font-medium transition-all',
    optionOn: 'bg-white text-gray-900 shadow-sm',
    optionOff: 'text-gray-600 hover:text-gray-900',
    rebuild: 'mt-1.5 flex w-full items-center justify-center rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
    rebuildOn: 'border-blue-500 bg-blue-50 text-gray-900',
    rebuildOff: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
    note: 'mt-1.5 text-[10px] leading-4 text-gray-500',
  },
  picker: {
    wrap: 'shrink-0 border-b border-[color:var(--stp-line)] px-5 pb-3 pt-2.5',
    label: 'block text-[11px] font-semibold uppercase tracking-wider text-[color:var(--stp-muted)]',
    segment: 'mt-1.5 inline-flex gap-0.5 rounded-[9px] border border-[color:var(--stp-line)] bg-[color:var(--stp-surface)] p-[3px]',
    option: 'min-w-[84px] rounded-[7px] px-3.5 py-1 text-xs font-semibold transition-colors',
    optionOn: 'bg-[color:var(--stp-panel)] text-[color:var(--stp-text)] shadow-[0_0_0_1px_var(--stp-accent)]',
    optionOff: 'text-[color:var(--stp-muted)] hover:text-[color:var(--stp-text)]',
    rebuild: 'mt-1.5 inline-flex rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors',
    rebuildOn: 'border-[color:var(--stp-accent)] bg-[color:var(--stp-active)] text-[color:var(--stp-text)]',
    rebuildOff: 'border-[color:var(--stp-line)] bg-[color:var(--stp-panel)] text-[color:var(--stp-text)] hover:border-[color:var(--stp-accent)]',
    note: 'mt-1.5 text-[11px] leading-normal text-[color:var(--stp-muted)]',
  },
} as const

export function DeckModeControl({
  variant,
  locked,
  mode,
  staged,
  onChange,
  onStage,
}: {
  variant: 'plain' | 'picker'
  locked: boolean
  /** The draft's mode before the build; the mode the deck was built in once it is locked. */
  mode: DeckPaletteMode
  staged: DeckPaletteMode | null
  onChange: (mode: DeckPaletteMode) => void
  onStage: (mode: DeckPaletteMode | null) => void
}) {
  const styles = DECK_MODE_STYLES[variant]
  const label = <span className={styles.label}>Deck mode</span>
  if (locked) {
    const pending = staged !== null && staged !== mode
    return (
      <div data-studio-theme-part="palette-mode" data-studio-theme-palette-state="built" className={styles.wrap}>
        {label}
        <button
          type="button"
          aria-pressed={pending}
          data-studio-theme-palette-rebuild={otherPaletteMode(mode)}
          onClick={() => onStage(nextStagedMode(mode, staged))}
          className={cn(styles.rebuild, pending ? styles.rebuildOn : styles.rebuildOff)}
        >
          {existingDeckActionLabel(mode)}
        </button>
        <p role="status" className={styles.note}>{existingDeckNote(mode, staged)}</p>
      </div>
    )
  }
  return (
    <div data-studio-theme-part="palette-mode" data-studio-theme-palette-state="draft" className={styles.wrap}>
      {label}
      <div role="group" aria-label="Deck mode" className={styles.segment}>
        {(['light', 'dark'] as const).map(value => (
          <button
            type="button"
            key={value}
            aria-pressed={mode === value}
            data-studio-theme-palette={value}
            onClick={() => onChange(value)}
            className={cn(styles.option, mode === value ? styles.optionOn : styles.optionOff)}
          >
            {paletteModeLabel(value)}
          </button>
        ))}
      </div>
      <p className={styles.note}>Chosen before the build. Switching a built deck later means a rebuild.</p>
    </div>
  )
}
