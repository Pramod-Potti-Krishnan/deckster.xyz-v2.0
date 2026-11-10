/** Keep a native field's focus ring inside its existing Inspector scroll body. */
export function studioInspectorScrollDelta(field: Pick<DOMRect, 'top' | 'bottom' | 'height'>, viewport: Pick<DOMRect, 'top' | 'bottom' | 'height'>, clearance = 8): number {
  if (field.height <= 0 || viewport.height <= clearance * 2 || field.height > viewport.height - clearance * 2) return 0
  if (field.top < viewport.top + clearance) return field.top - viewport.top - clearance
  if (field.bottom > viewport.bottom - clearance) return field.bottom - viewport.bottom + clearance
  return 0
}

export function keepStudioScrollFocusVisible(target: EventTarget | null, viewportSelector: string): void {
  if (!(target instanceof HTMLElement)) return
  const viewport = target.closest(viewportSelector)
  if (!(viewport instanceof HTMLElement) || viewport === target) return
  const delta = studioInspectorScrollDelta(target.getBoundingClientRect(), viewport.getBoundingClientRect())
  if (delta) viewport.scrollTop += delta
}

export function keepStudioInspectorFocusVisible(target: EventTarget | null): void {
  keepStudioScrollFocusVisible(target, '[data-studio-v4-panel-fields]')
}
