import { getLayoutViewerOrigin, isTrustedLayoutViewerMessage } from '@/lib/layout-viewer-messaging'
import type { StudioFormatCommand, StudioFormatTarget } from '@/components/builder/studio-format-inspector'
import type { ElementType } from '@/types/elements'

export interface StudioFormatSelectionHandle {
  readonly owner: object
  readonly elementId: string
  readonly presentationId: string
  readonly slideIndex: number
  readonly isCurrent: () => boolean
  /** Monotonic retirement of this selection; sends no native command. */
  retire: () => void
  read: () => Promise<StudioFormatTarget>
  send: (action: StudioFormatCommand, params: Record<string, unknown>, target: StudioFormatTarget) => Promise<unknown>
}

const BOX = ['setTextBoxPadding', 'setTextBoxBorder', 'setTextBoxBackground'] as const
const TEXT = ['setTextBoxFont', 'setTextBoxFontWeight', 'setTextBoxFontSize', 'setTextBoxColor',
  'setTextBoxAlignment', 'setTextBoxVerticalAlignment', 'setTextBoxLineHeight', 'setTextBoxParagraphSpacing'] as const
const record = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const exact = (value: unknown): value is string => typeof value === 'string' && Boolean(value) && value === value.trim()

/** Dedicated strict ACK bridge. Legacy native/chart APIs are unchanged. */
export function sendStudioFormatNativeCommand(iframe: HTMLIFrameElement, action: string,
  params: Record<string, unknown>, isCurrent: () => boolean, timeoutMs: number): Promise<any> {
  const source = iframe.src
  const target = iframe.contentWindow
  const requestId = crypto.randomUUID()
  const active = () => isCurrent() && iframe.src === source && iframe.contentWindow === target
  return new Promise((resolve, reject) => {
    if (!target || !active()) { reject(new Error('Select the element again before formatting.')); return }
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (error?: Error, result?: unknown) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      window.removeEventListener('message', receive)
      if (error) reject(error); else resolve(result)
    }
    const receive = (event: MessageEvent) => {
      if (!isTrustedLayoutViewerMessage(event, iframe, getLayoutViewerOrigin(iframe, ''))
        || event.data?.action !== action || event.data?.requestId !== requestId) return
      if (!active()) { finish(new Error('The selected element changed before confirmation.')); return }
      if (event.data.success !== true) { finish(new Error(typeof event.data.error === 'string' ? event.data.error : 'Formatting was not confirmed.')); return }
      finish(undefined, event.data)
    }
    window.addEventListener('message', receive)
    timer = setTimeout(() => finish(new Error('Formatting confirmation timed out. The change may already have been applied.')), timeoutMs)
    try { target.postMessage({ action, params, requestId }, getLayoutViewerOrigin(iframe, '')) }
    catch (error) { finish(error instanceof Error ? error : new Error('Formatting command could not be sent.')) }
  })
}

const commandFields: Record<string, readonly string[]> = {
  setTextBoxFont: ['fontFamily'], setTextBoxFontWeight: ['fontWeight'], setTextBoxFontSize: ['fontSize'],
  setTextBoxColor: ['color', 'themeBinding'], setTextBoxAlignment: ['alignment'],
  setTextBoxVerticalAlignment: ['verticalAlignment'], setTextBoxLineHeight: ['lineHeight'],
  setTextBoxParagraphSpacing: ['marginTop', 'marginBottom'], setTextBoxPadding: ['padding'],
  setTextBoxBorder: ['borderStyle', 'borderWidth', 'borderColor', 'borderRadius'],
  setTextBoxBackground: ['color', 'backgroundColor', 'themeBinding'],
}
export function validateStudioFormatParams(action: StudioFormatCommand, params: Record<string, unknown>, target: StudioFormatTarget): boolean {
  const fields = commandFields[action]
  if (!fields || !record(params) || params.elementId !== target.elementId
    || !target.supportedCommands.includes(action) || Object.keys(params).some(key => key !== 'elementId' && !fields.includes(key))) return false
  const values = Object.entries(params).filter(([key]) => key !== 'elementId')
  if (!values.length || values.some(([key, value]) => key === 'themeBinding' ? value !== null
    : typeof value === 'number' ? !Number.isFinite(value) : typeof value !== 'string' || !value.trim())) return false
  if (action === 'setTextBoxAlignment' && !['left', 'center', 'right', 'justify'].includes(String(params.alignment))) return false
  if (action === 'setTextBoxVerticalAlignment' && !['top', 'middle', 'bottom'].includes(String(params.verticalAlignment))) return false
  if (action === 'setTextBoxFontSize' && !/^(?:[1-9]\d?|1\d\d|200)pt$/.test(String(params.fontSize))) return false
  for (const [key, value] of values) {
    if (['padding', 'borderWidth', 'borderRadius', 'lineHeight', 'marginTop', 'marginBottom'].includes(key)
      && (typeof value !== 'string' || !/^(?:normal|(?:\d+(?:\.\d+)?(?:px|pt|em|rem|%)?)(?:\s+\d+(?:\.\d+)?(?:px|pt|em|rem|%)?){0,3})$/.test(value))) return false
  }
  return true
}

/** Selection identity and operation admission remain owned by the Viewer/page. */
export function createStudioFormatSelectionHandle(input: {
  iframe: HTMLIFrameElement; elementId: string; presentationId: string; sessionId: string | null;
  slideIndex: number; eventKind: 'textBoxSelected' | 'elementSelected'; elementType?: ElementType;
  owner: object; isCurrent: () => boolean;
}): StudioFormatSelectionHandle | null {
  if (!exact(input.elementId) || !exact(input.presentationId) || !Number.isSafeInteger(input.slideIndex) || input.slideIndex < 0) return null
  let admitted: StudioFormatTarget | null = null
  let pending = false
  let retired = false
  const isCurrent = () => !retired && input.isCurrent()
  const check = () => { if (!isCurrent()) throw new Error('Select the element again before formatting.') }
  const native = async (action: string, params: Record<string, unknown>, timeout = 8000) => {
    check(); const result = await sendStudioFormatNativeCommand(input.iframe, action, params, isCurrent, timeout); check(); return result
  }
  return {
    owner: input.owner, elementId: input.elementId, presentationId: input.presentationId, slideIndex: input.slideIndex,
    isCurrent,
    retire: () => { retired = true; admitted = null },
    async read() {
      check(); if (pending) throw new Error('Wait for the current formatting operation.')
      pending = true
      try {
        const membership = await native('getSlideGenerationContext', { slideIndex: input.slideIndex, targetElementId: input.elementId })
        if (membership.slide_index !== input.slideIndex || membership.target_element_id !== input.elementId) throw new Error('The selected element is not confirmed on this slide.')
        const geometry = await native('getElementGeometry', { elementId: input.elementId })
        if (geometry.elementId !== input.elementId || !exact(geometry.component_type)) throw new Error('The selected element identity was not confirmed.')
        const component = geometry.component_type.toUpperCase()
        const ordinary = geometry.regeneration_mode !== 'recreate' && !geometry.render_spec
        const selection = { selectionOwner: input.owner, elementId: input.elementId, presentationId: input.presentationId,
          slideIndex: input.slideIndex, sessionId: input.sessionId, properties: null }
        if (input.eventKind === 'textBoxSelected') {
          // Geometry omits retained custom HTML render specs. The existing
          // same-slide registry read preserves those raw specs and prevents
          // their fallback TEXT_BOX type from advertising text capabilities.
          const registry = await native('getTextBoxes', { slideIndex: input.slideIndex })
          if (registry.slideIndex !== input.slideIndex || !Array.isArray(registry.textBoxes)) throw new Error('The selected text box was not confirmed on this slide.')
          const matches = registry.textBoxes.filter((value: unknown) => record(value) && value.id === input.elementId)
          if (matches.length !== 1 || matches[0].type !== 'textbox' || matches[0].slideIndex !== input.slideIndex) throw new Error('The selected text box identity was not confirmed.')
          const nativeBox = matches[0]
          const rawSpec = nativeBox.render_spec ?? nativeBox.data?.render_spec
          const ordinaryBox = ordinary && !rawSpec
          const response = await native('getTextBoxFormatting', { elementId: input.elementId })
          if (!record(response.formatting)) throw new Error('Native formatting properties were not returned.')
          const formatting = Object.fromEntries(Object.entries(response.formatting).filter(([, value]) => typeof value === 'string'))
          const box = Object.fromEntries(['padding', 'backgroundColor', 'borderStyle', 'borderWidth', 'borderColor', 'borderRadius'].filter(key => typeof formatting[key] === 'string').map(key => [key, formatting[key]]))
          const text = ordinaryBox && typeof nativeBox.componentType === 'string'
            && nativeBox.componentType.toUpperCase() === component
            && ['TEXT_BOX', 'TEXT', 'TEXTBOX', 'RICH_TEXT', 'RICH_TEXT_BULLETS', 'TITLE', 'HEADING', 'SUBTITLE', 'BODY', 'CAPTION'].includes(component)
          admitted = text ? { ...selection, kind: 'editable-text', formatting, box, supportedCommands: [...TEXT, ...BOX] }
            : { ...selection, kind: 'textbox-shell', box, supportedCommands: ordinaryBox ? [...BOX] : [] }
        } else {
          admitted = { ...selection, kind: 'element', elementType: input.elementType ?? 'image', supportedCommands: [] }
        }
        check(); return admitted
      } finally { pending = false }
    },
    async send(action, params, target) {
      check()
      if (pending || target !== admitted || target.selectionOwner !== input.owner || !validateStudioFormatParams(action, params, target)) throw new Error('This formatting control is unavailable for the current selection.')
      pending = true
      try { return await native(action, { ...params, elementId: input.elementId }, 30000) }
      finally { pending = false }
    },
  }
}
