/** Foreground controls own their keys before the Studio canvas does. */
export function shouldHandleStudioCanvasShortcut(event: Pick<KeyboardEvent, 'defaultPrevented' | 'target'> & Partial<Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>>, root: Pick<Document, 'querySelector'> = document): boolean {
  if (event.defaultPrevented) return false
  if (root.querySelector('[data-studio-canvas-covered="true"]')) return false
  if (root.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"]')) return false
  const target = event.target
  // A focused small canvas keeps its native scrolling keys. Normal-size
  // canvas regions still use the existing deck navigation shortcuts.
  const slideSpace = target instanceof Element ? target.closest('[data-studio-slide-space="true"]') : null
  const scrollingKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key || '')
  if (scrollingKey && !event.ctrlKey && !event.metaKey && !event.altKey
    && slideSpace && (slideSpace.scrollWidth > slideSpace.clientWidth || slideSpace.scrollHeight > slideSpace.clientHeight)) return false
  return !(target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="alertdialog"], [role="textbox"], [role="combobox"], [role="menu"], [role="listbox"], [role="tablist"], [role="separator"], [data-studio-v4-panel], [data-studio-drawer-handle], [data-studio-build-footer="true"], [data-studio-file-detail="true"], [data-studio-qa-inspect="true"], [data-studio-edit-guide="true"], [data-studio-director-presence="true"], [data-studio-composer-mentions="true"], [data-studio-director-code="true"], [data-studio-composer-pending-action="true"], [data-studio-workspace-switch="true"], [data-studio-inspector-switch="true"]'))
}
