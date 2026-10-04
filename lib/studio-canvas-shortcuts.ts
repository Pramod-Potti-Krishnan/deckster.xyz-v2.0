/** Foreground controls own their keys before the Studio canvas does. */
export function shouldHandleStudioCanvasShortcut(event: Pick<KeyboardEvent, 'defaultPrevented' | 'target'>, root: Pick<Document, 'querySelector'> = document): boolean {
  if (event.defaultPrevented) return false
  if (root.querySelector('[data-studio-canvas-covered="true"]')) return false
  if (root.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"]')) return false
  const target = event.target
  return !(target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="alertdialog"], [role="textbox"], [role="combobox"], [role="menu"], [role="listbox"], [role="tablist"], [role="separator"], [data-studio-v4-panel], [data-studio-drawer-handle], [data-studio-build-footer="true"], [data-studio-file-detail="true"], [data-studio-qa-inspect="true"], [data-studio-edit-guide="true"], [data-studio-director-presence="true"], [data-studio-composer-mentions="true"], [data-studio-director-code="true"], [data-studio-composer-pending-action="true"], [data-studio-workspace-switch="true"], [data-studio-inspector-switch="true"]'))
}
