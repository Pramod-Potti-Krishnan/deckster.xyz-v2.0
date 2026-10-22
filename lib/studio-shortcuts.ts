// PASS2 ACC-16/17 (flag NEXT_PUBLIC_STUDIO_P2_ACCOUNT, default off). Import-free: the words of the shortcuts page, nothing else.
//
// The old /shortcuts page listed about 36 combinations; only a handful have a handler. This list holds ONLY the keys that do, each one proven against the
// handler that reads it (scripts/test-studio-p2-account.mjs pins every entry to its source, so a new row without a handler, or a handler that goes away, fails).
// Not listed, because nothing handles them: Ctrl+K, Ctrl+B (sidebar), undo / redo, "?", Ctrl+\ and Ctrl+/. The mockup's "M" for the element borders is B here.
//
// Keys are written as the mockup writes them: alternatives with " / ", combinations with " + ", and "⌘ / Ctrl" where the Mac and PC key differ.

export interface StudioShortcut {
  id: string
  label: string
  keys: string
}

export interface StudioShortcutGroup {
  id: string
  label: string
  shortcuts: readonly StudioShortcut[]
}

export const STUDIO_SHORTCUTS_WORDS = {
  title: 'Keyboard shortcuts',
  lede: 'Shortcuts that keep you in the flow.',
} as const

export const STUDIO_SHORTCUT_GROUPS: readonly StudioShortcutGroup[] = [
  {
    id: 'chat',
    label: 'Chat',
    shortcuts: [
      { id: 'send', label: 'Send a message', keys: 'Enter' },
      { id: 'newline', label: 'New line in the message box', keys: 'Shift + Enter' },
      { id: 'stop', label: 'Stop waiting for a reply or cancel an action', keys: 'Esc' },
    ],
  },
  {
    id: 'presentation',
    label: 'Presentation',
    shortcuts: [
      { id: 'next', label: 'Next slide', keys: '→ / ↓' },
      { id: 'previous', label: 'Previous slide', keys: '← / ↑' },
      { id: 'edit', label: 'Edit mode', keys: 'E' },
      { id: 'grid', label: 'Alignment grid', keys: 'G' },
      { id: 'borders', label: 'Element borders', keys: 'B' },
      { id: 'strip', label: 'Show or hide the slide strip', keys: 'Esc' },
      { id: 'save', label: 'Save now (in edit mode)', keys: '⌘ / Ctrl + S' },
    ],
  },
  {
    id: 'strip',
    label: 'Slide strip',
    shortcuts: [
      { id: 'strip-delete', label: 'Delete the selected slides', keys: 'Delete / Backspace' },
      { id: 'strip-all', label: 'Select all slides', keys: '⌘ / Ctrl + A' },
      { id: 'strip-clear', label: 'Clear the selection', keys: 'Esc' },
    ],
  },
  {
    id: 'panels',
    label: 'Panels',
    shortcuts: [
      { id: 'panel-generate', label: 'Generate', keys: '⌘ / Ctrl + Enter' },
      { id: 'panel-close', label: 'Close the panel', keys: 'Esc' },
      { id: 'divider-resize', label: 'Resize a side panel (divider selected)', keys: '← / →' },
      { id: 'divider-reset', label: 'Reset a side panel\'s width', keys: 'Home / Double-click divider' },
    ],
  },
]

/** Every shortcut in page order. */
export function studioShortcutList(): StudioShortcut[] {
  return STUDIO_SHORTCUT_GROUPS.flatMap(group => group.shortcuts)
}
