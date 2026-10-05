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
  if (action === 'generateTextBoxContent') {
    if (target.kind !== 'editable-text' || !record(params) || params.elementId !== target.elementId
      || !target.supportedCommands.includes(action) || params.presentationId !== target.presentationId
      || params.slideIndex !== target.slideIndex
      || Object.keys(params).some(key => !['elementId', 'presentationId', 'slideIndex', 'action', 'prompt', 'tone', 'style'].includes(key))) return false
    const quick = typeof params.action === 'string'
      && ['shorten', 'expand', 'grammar', 'bulletize', 'simplify', 'professional'].includes(params.action)
    if (params.action !== undefined && !quick) return false
    if (params.prompt !== undefined && (typeof params.prompt !== 'string' || !params.prompt.trim())) return false
    if (!quick && typeof params.prompt !== 'string') return false
    if (params.tone !== undefined && (typeof params.tone !== 'string' || !['professional', 'casual', 'persuasive', 'technical'].includes(params.tone))) return false
    if (params.style !== undefined && (typeof params.style !== 'string' || !['expand', 'summarize', 'rewrite'].includes(params.style))) return false
    return true
  }
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
  let settleAfterConfirmed: { fontSizePx?: number } | null = null
  const isCurrent = () => !retired && input.isCurrent()
  const check = () => { if (!isCurrent()) throw new Error('Select the element again before formatting.') }
  const native = async (action: string, params: Record<string, unknown>, timeout = 8000) => {
    check(); const result = await sendStudioFormatNativeCommand(input.iframe, action, params, isCurrent, timeout); check(); return result
  }
  const readWholeTextBoxContent = async () => {
    const membership = await native('getSlideGenerationContext', { slideIndex: input.slideIndex, targetElementId: input.elementId })
    if (membership.slide_index !== input.slideIndex || membership.target_element_id !== input.elementId) throw new Error('The selected text box is not confirmed on this slide.')
    const geometry = await native('getElementGeometry', { elementId: input.elementId })
    if (geometry.elementId !== input.elementId || !exact(geometry.component_type)
      || geometry.regeneration_mode === 'recreate' || geometry.render_spec) throw new Error('The selected editable text box could not be confirmed.')
    const component = geometry.component_type.toUpperCase()
    const registry = await native('getTextBoxes', { slideIndex: input.slideIndex })
    if (registry.slideIndex !== input.slideIndex || !Array.isArray(registry.textBoxes)) throw new Error('The selected text box was not confirmed on this slide.')
    const matches = registry.textBoxes.filter((value: unknown) => record(value) && value.id === input.elementId)
    if (matches.length !== 1 || matches[0].type !== 'textbox' || matches[0].slideIndex !== input.slideIndex
      || matches[0].render_spec || matches[0].data?.render_spec
      || typeof matches[0].componentType !== 'string' || matches[0].componentType.toUpperCase() !== component
      || !['TEXT_BOX', 'TEXT', 'TEXTBOX', 'RICH_TEXT', 'RICH_TEXT_BULLETS', 'TITLE', 'HEADING', 'SUBTITLE', 'BODY', 'CAPTION'].includes(component)) throw new Error('AI content is unavailable for this text box.')
    // An empty content getter alone also represents a missing content node.
    const formatting = await native('getTextBoxFormatting', { elementId: input.elementId })
    if (!record(formatting.formatting)) throw new Error('The editable text content was not confirmed.')
    const content = await native('getTextBoxContent', { elementId: input.elementId })
    if (content.elementId !== input.elementId || typeof content.content !== 'string') throw new Error('The rendered text content could not be read.')
    return content.content as string
  }
  return {
    owner: input.owner, elementId: input.elementId, presentationId: input.presentationId, slideIndex: input.slideIndex,
    isCurrent,
    retire: () => { retired = true; admitted = null; settleAfterConfirmed = null },
    async read() {
      check(); if (pending) throw new Error('Wait for the current formatting operation.')
      pending = true
      const settlement = settleAfterConfirmed
      settleAfterConfirmed = null
      try {
        if (settlement) {
          // The pinned native .editable rule transitions all properties for
          // 0.2s. ACK confirms the setter, before computed styles have settled.
          admitted = null
          await new Promise<void>(resolve => setTimeout(resolve, 250))
          check()
        }
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
          if (settlement?.fontSizePx !== undefined) {
            const value = response.formatting.fontSize
            const computed = typeof value === 'string' && /^\d+(?:\.\d+)?px$/.test(value) ? Number.parseFloat(value) : NaN
            if (!Number.isFinite(computed) || Math.abs(computed - settlement.fontSizePx) > 0.001) {
              throw new Error('The confirmed font size has not settled in the native formatting read. Select the element again.')
            }
          }
          const formatting = Object.fromEntries(Object.entries(response.formatting).filter(([, value]) => typeof value === 'string'))
          const box = Object.fromEntries(['padding', 'backgroundColor', 'borderStyle', 'borderWidth', 'borderColor', 'borderRadius'].filter(key => typeof formatting[key] === 'string').map(key => [key, formatting[key]]))
          const text = ordinaryBox && typeof nativeBox.componentType === 'string'
            && nativeBox.componentType.toUpperCase() === component
            && ['TEXT_BOX', 'TEXT', 'TEXTBOX', 'RICH_TEXT', 'RICH_TEXT_BULLETS', 'TITLE', 'HEADING', 'SUBTITLE', 'BODY', 'CAPTION'].includes(component)
          let contentReadable = false
          if (text) {
            try {
              const content = await native('getTextBoxContent', { elementId: input.elementId })
              contentReadable = content.elementId === input.elementId && typeof content.content === 'string'
            } catch { check() } // Missing AI readback leaves ordinary formatting available.
          }
          admitted = text ? { ...selection, kind: 'editable-text', formatting, box,
            supportedCommands: [...TEXT, ...BOX, ...(contentReadable ? ['generateTextBoxContent' as const] : [])] }
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
      const commandParams: Record<string, unknown> = { ...params, elementId: input.elementId }
      try {
        if (action === 'generateTextBoxContent') {
          const before = await readWholeTextBoxContent()
          try {
            const result = await native(action, commandParams, 30000)
            if (typeof result.content !== 'string' || !result.content.trim()) throw new Error('AI returned no confirmable text content.')
            // The existing native updater changes actual DOM after its 200ms
            // animation; registry data changes earlier and is not effect proof.
            await new Promise<void>(resolve => setTimeout(resolve, 250))
            check()
            const after = await readWholeTextBoxContent()
            if (after !== result.content) throw new Error('AI replied, but the rendered text box does not confirm that content. Check the box before trying again.')
            return { ...result, contentEffectConfirmed: true, contentChanged: before !== after }
          } catch (error) {
            if (!isCurrent()) throw new Error('The AI edit is no longer current and may already have applied to its original text box. Check before trying again; keep your prompt.')
            throw error
          }
        }
        const result = await native(action, commandParams, 30000)
        settleAfterConfirmed = action === 'setTextBoxFontSize'
          ? { fontSizePx: Number.parseFloat(String(commandParams.fontSize)) * 4 / 3 } : {}
        return result
      }
      finally { pending = false }
    },
  }
}
