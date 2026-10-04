/** Native chooser dismissal/selection precedes the slide panel's global shortcuts. */
export function shouldYieldStudioSlidePanelShortcut(event: Pick<KeyboardEvent, 'defaultPrevented' | 'target'>): boolean {
  return event.defaultPrevented || (event.target instanceof Element && Boolean(event.target.closest('[data-studio-slide-menu]')))
}
