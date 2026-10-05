"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Sparkles, Loader2 } from 'lucide-react'
import type { TextBoxFormatting } from '@/components/presentation-viewer'
import type { BaseElementProperties, ElementType } from '@/types/elements'
import type { DeckThemeToken } from '@/hooks/use-deck-theme-palette'
import { PanelSection, ButtonGroup, Divider } from '@/components/ui/panel'
import { cn } from '@/lib/utils'
import { ArrangeTab } from '@/components/element-format-panel/tabs/arrange-tab'
import '@/components/builder/studio-panels.css'
import '@/components/builder/studio-format-failures.css'

export const STUDIO_FORMAT_COMMANDS = {
  appearance: ['applyTextFormatCommand', 'setTextBoxFont', 'setTextBoxFontWeight', 'setTextBoxFontSize',
    'setTextBoxColor', 'setTextHighlightColor', 'setTextBoxAlignment', 'setTextBoxVerticalAlignment',
    'setTextBoxLineHeight', 'setTextBoxParagraphSpacing', 'setTextBoxPadding', 'setTextBoxBorder',
    'setTextBoxBackground', 'setTextBoxTextTransform', 'setElementClasses'],
  content: ['generateTextBoxContent'],
  arrange: ['bringToFront', 'sendToBack', 'bringForward', 'sendBackward', 'alignElement',
    'resizeElement', 'positionElement', 'rotateElement', 'flipElement', 'lockElement', 'setElementClasses'],
  box: ['setTextBoxPadding', 'setTextBoxBorder', 'setTextBoxBackground'],
} as const
export type StudioFormatCommand = typeof STUDIO_FORMAT_COMMANDS[keyof typeof STUDIO_FORMAT_COMMANDS][number]

export interface StudioFormatBoxProperties {
  padding?: string
  backgroundColor?: string
  borderStyle?: string
  borderWidth?: string
  borderColor?: string
  borderRadius?: string
}
interface StudioFormatSelection {
  /** Root must replace this exact object on selection/frame/session/generation ABA. */
  selectionOwner: object
  elementId: string
  presentationId: string
  slideIndex: number
  sessionId?: string | null
  /** Explicit native capability admission for this target; absence enables nothing. */
  supportedCommands: readonly StudioFormatCommand[]
  /** Actual current deck palette supplied by root; no service fetch or guessed token. */
  themeTokens?: readonly DeckThemeToken[]
  /** Actual native read only; never manufacture bounds to open Arrange. */
  properties: BaseElementProperties | null
}
export type StudioFormatTarget = StudioFormatSelection & (
  | { kind: 'editable-text'; formatting: TextBoxFormatting | null; textRangeOwner?: object | null; box?: StudioFormatBoxProperties | null }
  | { kind: 'textbox-shell'; box: StudioFormatBoxProperties | null }
  | { kind: 'element'; elementType: ElementType }
)
export interface StudioFormatInspectorProps {
  isOpen: boolean
  target: StudioFormatTarget | null
  /** Build/generation busy state is controlled by root. */
  busy: boolean
  /** Optional exact root-admitted read object; refreshes drafts without retiring selection or tabs. */
  readSnapshot?: object
  onClose: () => void
  /** Root admits the exact captured owner and forwards these original native params. */
  onSendCommand: (action: StudioFormatCommand, params: Record<string, any>, target: StudioFormatTarget) => Promise<any>
  onError?: (error: unknown, target: StudioFormatTarget) => void
}

interface StudioAIContentDraft { prompt: string; tone: string | null; style: string | null; revision: number; unconfirmed?: boolean }
interface StudioAIContentDraftEntry { elementId: string; presentationId: string; slideIndex: number; sessionId?: string | null; draft: StudioAIContentDraft }
type Tab = 'content' | 'appearance' | 'arrange'
const validTarget = (target: StudioFormatTarget | null): target is StudioFormatTarget => Boolean(target
  && target.selectionOwner && typeof target.selectionOwner === 'object' && !Array.isArray(target.selectionOwner)
  && typeof target.elementId === 'string' && target.elementId && target.elementId === target.elementId.trim()
  && typeof target.presentationId === 'string' && target.presentationId && target.presentationId === target.presentationId.trim()
  && ['editable-text', 'textbox-shell', 'element'].includes(target.kind)
  && Number.isSafeInteger(target.slideIndex) && target.slideIndex >= 0 && Array.isArray(target.supportedCommands))
const describeFailure = (error: unknown): string => {
  if (error instanceof Error) return error.message || 'Formatting command failed.'
  if (typeof error === 'string' && error) return error
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return 'Formatting change was not confirmed.'
}

export function StudioFormatInspector(props: StudioFormatInspectorProps) {
  const latest = useRef(props)
  latest.current = props
  const mounted = useRef(false)
  const mountRevision = useRef(0)
  const scopeRef = useRef({ owner: props.target?.selectionOwner, id: props.target?.elementId,
    presentation: props.target?.presentationId, slide: props.target?.slideIndex,
    kind: props.target?.kind, session: props.target?.sessionId, open: props.isOpen, revision: 0 })
  const old = scopeRef.current
  if (old.owner !== props.target?.selectionOwner || old.id !== props.target?.elementId
    || old.presentation !== props.target?.presentationId || old.slide !== props.target?.slideIndex
    || old.kind !== props.target?.kind || old.session !== props.target?.sessionId || old.open !== props.isOpen) {
    scopeRef.current = { owner: props.target?.selectionOwner, id: props.target?.elementId,
      presentation: props.target?.presentationId, slide: props.target?.slideIndex,
      kind: props.target?.kind, session: props.target?.sessionId, open: props.isOpen, revision: old.revision + 1 }
  }
  const scope = scopeRef.current
  const inFlight = useRef<{ scope: object; request: object } | null>(null)
  const [pending, setPending] = useState<object | null>(null)
  const [failure, setFailure] = useState<{ scope: object; message: string } | null>(null)
  useEffect(() => { mounted.current = true; mountRevision.current++; return () => { mounted.current = false; mountRevision.current++ } }, [])
  const readSnapshotRef = useRef({ snapshot: props.readSnapshot, revision: 0 })
  if (readSnapshotRef.current.snapshot !== props.readSnapshot) {
    readSnapshotRef.current = { snapshot: props.readSnapshot, revision: readSnapshotRef.current.revision + 1 }
  }
  const target = validTarget(props.target) ? props.target : null
  // Drafts stay local to the exact opaque selection owner; no storage or cross-scope copy.
  const contentDrafts = useRef(new WeakMap<object, StudioAIContentDraftEntry>())
  let contentDraft: StudioAIContentDraft | null = null
  if (target?.kind === 'editable-text') {
    let entry = contentDrafts.current.get(target.selectionOwner)
    if (!entry || entry.elementId !== target.elementId || entry.presentationId !== target.presentationId
      || entry.slideIndex !== target.slideIndex || entry.sessionId !== target.sessionId) {
      entry = { elementId: target.elementId, presentationId: target.presentationId, slideIndex: target.slideIndex,
        sessionId: target.sessionId, draft: { prompt: '', tone: null, style: null, revision: 0 } }
      contentDrafts.current.set(target.selectionOwner, entry)
    }
    contentDraft = entry.draft
  }
  const send = useCallback(async (action: string, params: Record<string, any>) => {
    const mount = mountRevision.current
    const current = () => mounted.current && mountRevision.current === mount && scopeRef.current === scope && latest.current.isOpen
    const refuse = (message: string) => { if (current()) setFailure({ scope, message }); return { success: false, error: message } }
    if (!current() || !target) return { success: false, error: 'Formatting target changed.' }
    if (latest.current.busy) return refuse('Formatting is unavailable while generation is in progress.')
    if (inFlight.current?.scope === scope) return refuse('A formatting change is already pending.')
    const admitted = latest.current.target
    if (!admitted || admitted.selectionOwner !== target.selectionOwner || params.elementId !== target.elementId
      || (params.presentationId !== undefined && params.presentationId !== target.presentationId)
      || (params.slideIndex !== undefined && params.slideIndex !== target.slideIndex)) return refuse('Formatting target changed.')
    const commands = target.kind === 'editable-text'
      ? [...STUDIO_FORMAT_COMMANDS.appearance, ...STUDIO_FORMAT_COMMANDS.content, ...STUDIO_FORMAT_COMMANDS.arrange]
      : target.kind === 'textbox-shell' ? [...STUDIO_FORMAT_COMMANDS.box, ...STUDIO_FORMAT_COMMANDS.arrange] : STUDIO_FORMAT_COMMANDS.arrange
    if ((action === 'applyTextFormatCommand' || action === 'setTextHighlightColor') && (admitted.kind !== 'editable-text' || !admitted.textRangeOwner || admitted.textRangeOwner !== (target.kind === 'editable-text' ? target.textRangeOwner : null))) return refuse('The editable text selection must be confirmed before using this action.')
    if (!commands.includes(action as never) || !admitted.supportedCommands.includes(action as StudioFormatCommand)) {
      return refuse('This formatting command is not available for the selected element.')
    }
    const request = {}
    inFlight.current = { scope, request }; setPending(scope); setFailure(null)
    try {
      const result = await latest.current.onSendCommand(action as StudioFormatCommand, params, target)
      if (!current()) return { success: false, error: 'Formatting target changed.' }
      if (action === 'generateTextBoxContent' && result?.success === true && (result.contentEffectConfirmed !== true || typeof result.contentChanged !== 'boolean')) {
        const error = 'The text box change was not confirmed. Your prompt has been kept.'
        setFailure({ scope, message: error }); latest.current.onError?.(error, target)
        return { success: false, error }
      }
      if (result?.success !== true) {
        const error = result?.error ?? 'Formatting change was not confirmed.'
        setFailure({ scope, message: describeFailure(error) }); latest.current.onError?.(error, target)
      }
      return result ?? { success: false, error: 'Formatting change was not confirmed.' }
    } catch (error) {
      if (current()) { setFailure({ scope, message: describeFailure(error) }); latest.current.onError?.(error, target) }
      return { success: false, error: describeFailure(error) }
    } finally {
      if (current() && inFlight.current?.request === request) { inFlight.current = null; setPending(null) }
    }
  }, [scope, target])
  if (!props.isOpen) return null
  return <div data-studio-v4-shell="true" className="h-full min-h-0 min-w-0"><section data-studio-v4-panel="inspector-format" aria-label="Format selected element"
    className="relative flex h-full min-h-0 min-w-0 flex-col bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100">
    <header data-studio-v4-panel-header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
      <div className="min-w-0"><h2>Format</h2><p>{target?.kind === 'editable-text' ? 'Selected text' : target?.kind === 'textbox-shell' ? 'Selected graphic box' : target ? 'Selected element' : 'No element selected'}</p></div>
      <button type="button" onClick={props.onClose} aria-label="Close Format inspector" className="rounded-md p-2"><X size={16}/></button>
    </header>
    {props.busy && <p role="status" className="px-4 py-2 text-xs">Formatting is unavailable while generation is in progress.</p>}
    {failure?.scope === scope && <div data-studio-format-failure="true" role="alert"><strong>Formatting change not confirmed</strong><p>{failure.message}</p><small>Attempted control values do not confirm that the slide changed.</small></div>}
    {target ? <InspectorControls key={scope.revision} target={target} send={send} disabled={props.busy || pending === scope} readRevision={readSnapshotRef.current.revision} contentDraft={contentDraft} externalBusy={props.busy}/>
      : <p className="px-4 py-4 text-sm">Select an element on the slide to format it.</p>}
  </section></div>
}

function InspectorControls({ target, send, disabled, readRevision, contentDraft, externalBusy }: { readRevision: number; target: StudioFormatTarget; send: (action: string, params: Record<string, any>) => Promise<any>; disabled: boolean; contentDraft: StudioAIContentDraft | null; externalBusy: boolean }) {
  const [tab, setTab] = useState<Tab>(target.kind === 'editable-text' ? 'content' : target.kind === 'textbox-shell' ? 'appearance' : 'arrange')
  const tabs: Tab[] = target.kind === 'editable-text' ? ['content', 'appearance', 'arrange'] : target.kind === 'textbox-shell' ? ['appearance', 'arrange'] : ['arrange']
  const supported = (catalog: readonly StudioFormatCommand[]) => catalog.every(command => target.supportedCommands.includes(command))
  const content = target.kind === 'editable-text' && supported(STUDIO_FORMAT_COMMANDS.content)
  const nativeProperties = target.properties && target.properties.elementId === target.elementId
    && [target.properties.position?.x,target.properties.position?.y,target.properties.size?.width,target.properties.size?.height,target.properties.rotation,target.properties.zIndex].every(value=>typeof value === 'number' && Number.isFinite(value))
    && target.properties.size.width > 0 && target.properties.size.height > 0 && typeof target.properties.locked === 'boolean' ? target.properties : null
  const arrange = Boolean(nativeProperties && supported(STUDIO_FORMAT_COMMANDS.arrange))
  return <>
    <div role="tablist" aria-label="Selected element properties" className="flex shrink-0 gap-1 border-b px-3 py-2">
      {tabs.map(value=><button key={value} type="button" role="tab" aria-selected={tab === value} onClick={()=>setTab(value)}
        className="min-w-0 flex-1 rounded-md px-2 py-2 text-xs font-medium" style={tab === value ? { background: 'var(--sp-active)', color: 'var(--sp-ink)' } : { color: 'var(--sp-muted)' }}>{value === 'content' ? 'Content' : value === 'appearance' ? 'Appearance' : 'Arrange'}</button>)}
    </div>
    <div data-studio-v4-panel-fields className="min-h-0 flex-1 overflow-y-auto">
      {target.kind === 'editable-text' && <>
        <div role="tabpanel" aria-label="Content" hidden={tab !== 'content'}>
          <p className="px-4 pt-3 text-xs">Edit text directly on the slide, or use the existing AI text actions below.</p>
          {!content && <p className="px-4 pt-2 text-xs" role="status">AI text actions are unavailable for this selection.</p>}
          <fieldset disabled={!content} className="min-w-0 border-0 p-0">{contentDraft && <StudioAIContent target={target} draft={contentDraft} onSendCommand={send} enabled={content} isApplying={disabled || !content} externalBusy={externalBusy}/>}</fieldset>
        </div>
        <div role="tabpanel" aria-label="Appearance" hidden={tab !== 'appearance'}>
          <CompactAppearance key={`appearance-${readRevision}`} target={target} send={send} disabled={disabled}/>
          <ThemeColors key={`theme-${readRevision}`} target={target} send={send} disabled={disabled}/>
          <BoxControls key={`box-${readRevision}`} target={{...target,box:target.box ?? {padding:target.formatting?.padding,backgroundColor:target.formatting?.backgroundColor}}} send={send} disabled={disabled}/>
        </div>
      </>}
      {target.kind === 'textbox-shell' && <div role="tabpanel" aria-label="Appearance" hidden={tab !== 'appearance'}>
        <p className="px-4 pt-3 text-xs">Box properties affect the surrounding container. Text and artwork inside it keep their rendered appearance.</p>
        <BoxControls key={`box-${readRevision}`} target={target} send={send} disabled={disabled}/>
        <ThemeColors key={`theme-${readRevision}`} target={target} send={send} disabled={disabled}/>
      </div>}
      <div role="tabpanel" aria-label="Arrange" hidden={tab !== 'arrange'}>
        {!arrange && <p className="px-4 pt-3 text-xs" role="status">Arrangement is unavailable until native properties and commands are confirmed for this selection.</p>}
        {nativeProperties && <fieldset disabled={disabled || !arrange} className="min-w-0 border-0 p-0"><ArrangeTab properties={nativeProperties} elementId={target.elementId} onSendCommand={send} isApplying={disabled || !arrange}/></fieldset>}
      </div>
    </div>
  </>
}

// Studio owns prompt lifetime here; the shared AITab and Classic behavior remain unchanged.
const STUDIO_AI_QUICK_ACTIONS = [
  { label: 'Shorten', action: 'shorten' }, { label: 'Expand', action: 'expand' },
  { label: 'Fix Grammar', action: 'grammar' }, { label: 'Add Bullets', action: 'bulletize' },
  { label: 'Simplify', action: 'simplify' }, { label: 'Professional', action: 'professional' },
]
const STUDIO_AI_TONES = [
  { value: 'professional', label: 'Prof' }, { value: 'casual', label: 'Casual' },
  { value: 'persuasive', label: 'Pers' }, { value: 'technical', label: 'Tech' },
]
const STUDIO_AI_STYLES = [
  { value: 'expand', label: 'Expand' }, { value: 'summarize', label: 'Summary' }, { value: 'rewrite', label: 'Rewrite' },
]
function StudioAIContent({ target, draft, onSendCommand, enabled, isApplying, externalBusy }: {
  target: Extract<StudioFormatTarget, { kind: 'editable-text' }>; draft: StudioAIContentDraft;
  onSendCommand: (action: string, params: Record<string, any>) => Promise<any>;
  enabled: boolean; isApplying: boolean; externalBusy: boolean;
}) {
  const [view, setView] = useState(() => ({ ...draft }))
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(() => draft.unconfirmed ? { error: true, text: 'The previous text box change was not confirmed. Your prompt has been kept.' } : null)
  const mounted = useRef(false), requestRef = useRef<object | null>(null)
  const latest = useRef({ target, draft, enabled, externalBusy })
  latest.current = { target, draft, enabled, externalBusy }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; requestRef.current = null } }, [])
  const update = (field: 'prompt' | 'tone' | 'style', value: string | null) => {
    if (!mounted.current) return
    if (field === 'prompt') draft.prompt = value ?? ''
    else draft[field] = value
    draft.revision += 1
    setView({ ...draft })
  }
  const run = async (action?: string) => {
    if (!mounted.current || !enabled || isApplying || requestRef.current) return
    const captured = { ...draft }
    if (!action && !captured.prompt.trim()) { setMessage({ error: true, text: 'Please enter a prompt' }); return }
    const request = {}, owner = target.selectionOwner
    requestRef.current = request; setGenerating(true); setMessage(null)
    const current = () => mounted.current && requestRef.current === request
      && latest.current.target.selectionOwner === owner && latest.current.draft === draft
      && latest.current.enabled && !latest.current.externalBusy
    try {
      const result = await onSendCommand('generateTextBoxContent', action
        ? { action, elementId: target.elementId, presentationId: target.presentationId, slideIndex: target.slideIndex }
        : { prompt: captured.prompt.trim(), tone: captured.tone || undefined, style: captured.style || undefined,
            elementId: target.elementId, presentationId: target.presentationId, slideIndex: target.slideIndex })
      if (!current()) { draft.unconfirmed = true; return }
      if (result?.success !== true || result.contentEffectConfirmed !== true || typeof result.contentChanged !== 'boolean') {
        draft.unconfirmed = true
        setMessage({ error: true, text: describeFailure(result?.error ?? 'The text box change was not confirmed. Your prompt has been kept.') })
        return
      }
      draft.unconfirmed = false
      if (result.contentChanged !== true) {
        setMessage({ error: false, text: 'The text box already matches. Your prompt has been kept.' })
        return
      }
      // A successful older request cannot clear a newer prompt/tone/style draft.
      if (!action && draft.revision === captured.revision && draft.prompt === captured.prompt
        && draft.tone === captured.tone && draft.style === captured.style) {
        draft.prompt = ''; draft.revision += 1; setView({ ...draft })
      }
      setMessage({ error: false, text: 'Text box updated.' })
    } catch (error) {
      draft.unconfirmed = true
      if (current()) setMessage({ error: true, text: describeFailure(error) })
    } finally {
      if (mounted.current && requestRef.current === request) {
        requestRef.current = null; setGenerating(false)
      }
    }
  }
  return <div className="p-4 space-y-5">
    <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-400"/><span className="text-[11px] font-medium text-gray-300" style={{ color: 'var(--sp-ink)' }}>AI Content Assistant</span></div>
    <PanelSection title="Quick Actions"><div className="flex flex-wrap gap-1.5">{STUDIO_AI_QUICK_ACTIONS.map(({ label, action }) => <button key={action} type="button" onClick={() => run(action)} disabled={generating || isApplying}
      className={cn('px-3 py-1.5 rounded-full', 'bg-gray-800/60 border border-gray-700/50', 'text-[10px] text-gray-300', 'hover:bg-gray-700/50 hover:border-gray-600 hover:text-white', 'transition-all duration-150', 'disabled:opacity-50 disabled:cursor-not-allowed')}>{label}</button>)}</div></PanelSection>
    <Divider label="or generate new"/>
    <div className="space-y-3"><textarea aria-label="AI content prompt" value={view.prompt} onChange={event => update('prompt', event.target.value)} placeholder="Describe what you want to write..." disabled={!enabled}
      className={cn('w-full h-20 px-3 py-2.5 rounded-lg', 'bg-gray-800/60 border border-gray-700/50', 'text-[11px] text-white placeholder:text-gray-500', 'resize-none', 'focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20', 'transition-all duration-150')}/></div>
    <PanelSection title="Tone"><ButtonGroup options={STUDIO_AI_TONES} value={view.tone} onChange={value => update('tone', view.tone === value ? null : value)} disabled={!enabled} accentColor="indigo"/></PanelSection>
    <PanelSection title="Style"><ButtonGroup options={STUDIO_AI_STYLES} value={view.style} onChange={value => update('style', view.style === value ? null : value)} disabled={!enabled} accentColor="purple"/></PanelSection>
    {message && <div role={message.error ? 'alert' : 'status'} style={{ color: 'var(--sp-ink)' }} className={cn('px-3 py-2 rounded-lg text-[10px]', message.error ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'text-gray-300')}>{message.text}</div>}
    <button type="button" onClick={() => run()} disabled={generating || isApplying || !view.prompt.trim()} className={cn('w-full flex items-center justify-center gap-2', 'h-10 rounded-lg', 'text-[11px] font-medium', 'transition-all duration-150', generating || isApplying || !view.prompt.trim() ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-900/20 hover:shadow-xl hover:shadow-indigo-900/30')}>
      {generating ? <><Loader2 className="h-3.5 w-3.5 animate-spin"/>Generating...</> : <><Sparkles className="h-3.5 w-3.5"/>Generate Content</>}
    </button>
    <p className="text-[9px] text-gray-600 text-center">AI generates styled HTML content</p>
  </div>
}

function fontSizeInPoints(value: string | undefined): string {
  if (typeof value !== 'string') return ''
  const match = /^([0-9]+(?:\.[0-9]+)?)(px|pt)$/.exec(value.trim())
  if (!match) return ''
  const size = Number(match[1]) * (match[2] === 'px' ? 0.75 : 1)
  return Number.isFinite(size) && size > 0 ? String(size) : ''
}

function CompactAppearance({ target, send, disabled }: { target: Extract<StudioFormatTarget, {kind:'editable-text'}>; send:(action:string,params:Record<string,any>)=>Promise<any>; disabled:boolean }) {
  const [draft,setDraft]=useState({fontFamily:target.formatting?.fontFamily ?? '',fontWeight:target.formatting?.fontWeight ?? '',fontSize:fontSizeInPoints(target.formatting?.fontSize),color:target.formatting?.color ?? '',backgroundColor:target.formatting?.backgroundColor ?? '',lineHeight:target.formatting?.lineHeight ?? '',before:'',after:''})
  const allowed=(command:StudioFormatCommand)=>!disabled && target.supportedCommands.includes(command) && (!['applyTextFormatCommand','setTextHighlightColor'].includes(command) || Boolean(target.textRangeOwner))
  const update=(field:keyof typeof draft,value:string)=>setDraft(previous=>({...previous,[field]:value}))
  const call=(action:StudioFormatCommand,params:Record<string,any>)=>send(action,{elementId:target.elementId,...params})
  return <div className="space-y-4 p-4">
    <h3 className="text-xs font-semibold">Typography</h3>
    <label className="block space-y-1 text-xs"><span>Font</span><select aria-label="Text font" className="w-full border px-2 py-1.5" value={draft.fontFamily} disabled={!allowed('setTextBoxFont')} onChange={event=>{update('fontFamily',event.target.value);void call('setTextBoxFont',{fontFamily:event.target.value})}}>
      <option value="" disabled>Not read</option>{draft.fontFamily && !['Inter','Arial','Helvetica','Georgia','Times New Roman','Verdana','Roboto','Open Sans','Helvetica Neue'].includes(draft.fontFamily) && <option value={draft.fontFamily}>{draft.fontFamily}</option>}{['Inter','Arial','Helvetica','Georgia','Times New Roman','Verdana','Roboto','Open Sans','Helvetica Neue'].map(font=><option key={font} value={font}>{font}</option>)}
    </select></label>
    <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-xs"><span>Weight</span><select aria-label="Text weight" className="w-full border px-2 py-1.5" value={draft.fontWeight} disabled={!allowed('setTextBoxFontWeight')} onChange={event=>{update('fontWeight',event.target.value);void call('setTextBoxFontWeight',{fontWeight:event.target.value})}}><option value="" disabled>Not read</option>{draft.fontWeight && !['400','500','600','700'].includes(draft.fontWeight) && <option value={draft.fontWeight}>{draft.fontWeight}</option>}{[['400','Regular'],['500','Medium'],['600','Semibold'],['700','Bold']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label className="space-y-1 text-xs"><span>Size (pt)</span><input aria-label="Text size" type="number" min={1} max={200} className="w-full border px-2 py-1.5" value={draft.fontSize} placeholder="Not read" disabled={!allowed('setTextBoxFontSize')} onChange={event=>update('fontSize',event.target.value)} onBlur={()=>{const value=parseInt(draft.fontSize,10);if(draft.fontSize !== fontSizeInPoints(target.formatting?.fontSize) && Number.isFinite(value)&&value>=1){update('fontSize',String(Math.min(value,200)));void call('setTextBoxFontSize',{fontSize:`${Math.min(value,200)}pt`})}}}/></label></div>
    <div className="flex flex-wrap gap-1">{[['bold','Bold'],['italic','Italic'],['underline','Underline'],['strikeThrough','Strike'],['insertUnorderedList','Bullets'],['insertOrderedList','Numbered']].map(([command,label])=><button type="button" key={command} className="rounded-md border px-2 py-1.5 text-xs" disabled={!allowed('applyTextFormatCommand')} onClick={()=>void call('applyTextFormatCommand',{command})}>{label}</button>)}</div>
    <div className="space-y-2">{[['color','Text color','setTextBoxColor'],['backgroundColor','Highlight','setTextHighlightColor'],['lineHeight','Line height','setTextBoxLineHeight']].map(([field,label,command])=><label key={field} className="flex min-w-0 items-center gap-2 text-xs"><span className="w-24 shrink-0">{label}</span><input type="text" aria-label={label} className="min-w-0 flex-1 border px-2 py-1.5" value={draft[field as keyof typeof draft]} placeholder="Not read" disabled={!allowed(command as StudioFormatCommand)} onChange={event=>update(field as keyof typeof draft,event.target.value)} onBlur={()=>{const value=draft[field as keyof typeof draft];if(value.trim() && value !== (target.formatting?.[field as 'color'|'backgroundColor'|'lineHeight'] ?? ''))void call(command as StudioFormatCommand,field==='lineHeight'?{lineHeight:value}:{color:value,themeBinding:null})}}/></label>)}</div>
    <div className="grid grid-cols-2 gap-2">{(['before','after'] as const).map(field=><label key={field} className="space-y-1 text-xs"><span>{field === 'before' ? 'Before paragraph (pt)' : 'After paragraph (pt)'}</span><input aria-label={`${field} paragraph spacing`} type="number" className="w-full border px-2 py-1.5" value={draft[field]} placeholder="Not read" disabled={!allowed('setTextBoxParagraphSpacing')} onChange={event=>update(field,event.target.value)} onBlur={()=>{if(draft.before.trim() && draft.after.trim())void call('setTextBoxParagraphSpacing',{marginTop:`${draft.before}pt`,marginBottom:`${draft.after}pt`})}}/></label>)}</div>
    <h3 className="text-xs font-semibold">Alignment</h3><div className="flex flex-wrap gap-1">{['left','center','right','justify'].map(alignment=><button key={alignment} type="button" aria-label={`Align text ${alignment}`} className="rounded-md border px-2 py-1.5 text-xs" disabled={!allowed('setTextBoxAlignment')} onClick={()=>void call('setTextBoxAlignment',{alignment})}>{alignment}</button>)}</div>
    <div className="flex flex-wrap gap-1">{['top','middle','bottom'].map(verticalAlignment=><button key={verticalAlignment} type="button" aria-label={`Align text vertically ${verticalAlignment}`} className="rounded-md border px-2 py-1.5 text-xs" disabled={!allowed('setTextBoxVerticalAlignment')} onClick={()=>void call('setTextBoxVerticalAlignment',{verticalAlignment})}>{verticalAlignment}</button>)}</div>
    <p className="text-xs">Unavailable native options stay disabled for this selection.</p>
    <label className="block text-xs">Text transform<select aria-label="Text transform unavailable" disabled className="mt-1 w-full border px-2 py-1.5"><option>Unavailable</option></select></label>
    <label className="block text-xs">CSS classes<input aria-label="Text CSS classes unavailable" disabled placeholder="Unavailable" className="mt-1 w-full border px-2 py-1.5"/></label>
  </div>
}

function BoxControls({ target, send, disabled }: { target: StudioFormatTarget & {box:StudioFormatBoxProperties|null}; send: (action: string, params: Record<string, any>) => Promise<any>; disabled: boolean }) {
  const [draft, setDraft] = useState<StudioFormatBoxProperties>(()=>Object.fromEntries(Object.entries(target.box ?? {}).filter(([,value])=>typeof value === 'string')))
  const fields = [
    ['padding', 'Padding', 'setTextBoxPadding'], ['backgroundColor', 'Fill', 'setTextBoxBackground'],
    ['borderStyle', 'Border style', 'setTextBoxBorder'], ['borderWidth', 'Border width', 'setTextBoxBorder'],
    ['borderColor', 'Border color', 'setTextBoxBorder'], ['borderRadius', 'Corner radius', 'setTextBoxBorder'],
  ] as const
  return <div className="space-y-3 p-4"><h3 className="text-xs font-semibold">Box</h3>
    {fields.map(([field,label,command])=><label key={field} className="flex min-w-0 items-center gap-3 text-xs">
      <span className="w-24 shrink-0">{label}</span><input type="text" aria-label={`Box ${label.toLowerCase()}`} value={draft[field] ?? ''} placeholder="Not read" disabled={disabled || !target.supportedCommands.includes(command)}
        onChange={event=>setDraft(previous=>({...previous,[field]:event.target.value}))}
        onBlur={()=>{if(draft[field]?.trim() && draft[field] !== target.box?.[field])void send(command,{elementId:target.elementId,[field]:draft[field]})}}
        className="min-w-0 flex-1 border px-2 py-1.5"/>
    </label>)}
    {!STUDIO_FORMAT_COMMANDS.box.some(command=>target.supportedCommands.includes(command)) && <p role="status" className="text-xs">Box commands are unavailable for this selection.</p>}
  </div>
}

function ThemeColors({ target, send, disabled }: { target: StudioFormatTarget; send: (action: string, params: Record<string, any>) => Promise<any>; disabled: boolean }) {
  const tokens = (target.themeTokens ?? []).filter(token => typeof token.id === 'string' && typeof token.color === 'string' && token.color.trim())
  const [bindings, setBindings] = useState<Record<string, string>>(target.kind === 'editable-text' ? target.formatting?.themeBindings ?? {} : {})
  const fields = [
    ['text_color', 'Text color', 'setTextBoxColor', '--theme-text-body'],
    ['highlight', 'Highlight', 'setTextHighlightColor', '--theme-accent-1'],
    ['border', 'Border color', 'setTextBoxBorder', '--theme-primary'],
    ['background', 'Box fill', 'setTextBoxBackground', '--theme-surface'],
  ] as const
  const apply = (property: typeof fields[number][0], command: StudioFormatCommand, token: DeckThemeToken, resetThemeBinding = false) => {
    setBindings(previous => ({ ...previous, [property]: token.id }))
    const params = property === 'background' ? { backgroundColor: token.color } : property === 'border' ? { borderColor: token.color } : { color: token.color }
    void send(command, { elementId: target.elementId, ...params, themeBinding: token.id, resetThemeBinding })
  }
  return <div className="space-y-3 p-4"><h3 className="text-xs font-semibold">Theme colors</h3>
    {fields.filter(([property]) => target.kind === 'editable-text' || property === 'border' || property === 'background').map(([property, label, command, preferred]) => {
      const unavailable = disabled || !tokens.length || !target.supportedCommands.includes(command) || (property === 'highlight' && (target.kind !== 'editable-text' || !target.textRangeOwner))
      return <div key={property} className="space-y-1 text-xs"><label className="block">{label}<select aria-label={`Theme ${label.toLowerCase()}`} className="mt-1 w-full border px-2 py-1.5" value={bindings[property] ?? ''} disabled={unavailable}
        onChange={event => { const token = tokens.find(item => item.id === event.target.value); if (token) apply(property, command, token) }}>
        <option value="" disabled>{tokens.length ? 'Manual or not read' : 'Palette not read'}</option>{tokens.map(token => <option key={token.id} value={token.id}>{token.label}</option>)}
      </select></label><button type="button" aria-label={`Reset theme ${label.toLowerCase()}`} disabled={unavailable} className="rounded-md border px-2 py-1.5" onClick={() => { const token = tokens.find(item => item.id === preferred) ?? tokens[0]; if (token) apply(property, command, token, true) }}>Reset to theme</button></div>
    })}
  </div>
}
