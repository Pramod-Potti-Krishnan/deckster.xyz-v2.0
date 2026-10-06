import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Render the real native leaves. Explicit dependencies only; all requests refused.
let flag = 'true'
const refuse = () => { throw new Error('Offline Director-header fixture refuses every service request') }
const react = { useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useEffect() {}, useRef: current => ({ current }), useCallback: callback => callback }
const jsx = (type, props, key) => ({ type, props, key })
const imports = {
  react: { ...react, default: react },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'lucide-react': Object.fromEntries(['Sparkles', 'ArrowUpRight', 'BookOpen', 'Lightbulb', 'ListChecks', 'Globe', 'SlidersHorizontal', 'Paperclip', 'ArrowUp', 'Square', 'Loader2', 'Search', 'Brain', 'LayoutTemplate', 'Palette', 'Save', 'Star', 'Trash2', 'X', 'CheckCircle2', 'AlertCircle'].map(name => [name, name])),
  './studio-director-header.css': {},
  '@/components/builder/chat/mention-popover': { SlideMentionPopover: 'SlideMentionPopover' },
  '@/lib/mdc-mentions': { filterMentionSlides: () => [], mentionToken: refuse },
  '@/lib/mdc-flags': { CHAT_MENTIONS: false },
  '@/components/ui/button': { Button: 'Button' },
  '@/components/ui/textarea': { Textarea: 'Textarea' },
  '@/components/file-chip': { FileChip: 'FileChip' },
  '@/components/ui/dropdown-menu': { DropdownMenu: 'DropdownMenu', DropdownMenuContent: 'DropdownMenuContent', DropdownMenuTrigger: 'DropdownMenuTrigger' },
  '@/components/ui/switch': { Switch: 'Switch' },
  '@/lib/config': { config: { api: { themeBuilderUrl: 'fixture.invalid' } }, features: { enableFileUploads: true } },
  '@/lib/theme-builder': { FALLBACK_THEME_PRESETS: [], isValidThemeHex: () => true, normalizeThemePresetId: value => value },
  '@/hooks/use-theme-profiles': { useThemeProfiles: () => ({ loading: false, error: null, listThemes: refuse, saveTheme: refuse, setStandardTheme: refuse, clearStandardTheme: refuse, deleteTheme: refuse }) },
  '@/hooks/use-templates': { isTemplateGenerationReady: () => false, templateGenerationUnavailableReason: () => '' },
  './template-picker': { TemplatePicker: 'TemplatePicker' },
  './studio-theme-menu': { StudioThemeMenu: 'StudioThemeMenu' },
}
function load(relative) {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  assert.equal((compiled.diagnostics || []).filter(entry => entry.category === ts.DiagnosticCategory.Error).length, 0)
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, {
    module: mod, exports: mod.exports, fetch: refuse,
    process: { env: { get NEXT_PUBLIC_STUDIO_V4_SHELL() { return flag } } },
    require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name] },
  })
  return mod.exports
}
const { StudioDirectorHeader } = load('../components/builder/chat/studio-director-header.tsx')
const { StudioWelcome } = load('../components/builder/chat/studio-welcome.tsx')
const { ChatInput } = load('../components/builder/chat-input.tsx')
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : !value || typeof value !== 'object' ? [] : [value, ...nodes(value.props?.children)]
const textOf = value => Array.isArray(value) ? value.map(textOf).join('') : value == null || value === false ? '' : typeof value === 'object' ? textOf(value.props?.children) : String(value)
for (const enabled of ['true', 'false', 'TRUE', undefined]) {
  flag = enabled
  for (const [connectionState, label] of Object.entries({ connected: 'Connected', connecting: 'Connecting…', disconnected: 'Disconnected', error: 'Connection error' })) {
    for (const loading of [false, true]) {
      const tree = StudioDirectorHeader({ connectionState, isLoadingSession: loading })
      if (enabled !== 'true') { assert.equal(tree, null); continue }
      assert.equal(tree.type, 'header')
      assert.equal(tree.props['aria-label'], 'Director conversation')
      assert.equal(nodes(tree).filter(node => node.props?.role === 'status').length, 1)
      const status = nodes(tree).find(node => node.props?.role === 'status')
      assert.equal(status.props['data-connection-state'], loading ? 'loading' : connectionState)
      assert.equal(textOf(status), loading ? 'Loading conversation…' : label)
      assert.doesNotMatch(textOf(tree), /Available|Ready|Voice|Video|call|creative partner/i)
      assert.equal(nodes(tree).some(node => node.type === 'button'), false)
    }
  }
}
flag = 'true'
assert.equal(textOf(StudioDirectorHeader({ connectionState: 'disconnected' })), 'DirectorDisconnected', 'session-loading defaults false; disconnected is never inferred ready')
const baseProps = {
  inputMessage: 'Retained native draft', onInputChange: refuse, onSubmit: refuse,
  uploadedFiles: [], onFilesSelected: refuse, onRemoveFile: refuse, onClearAllFiles: refuse,
  pendingActionInput: null, onCancelAction: refuse, researchEnabled: false, onResearchEnabledChange: refuse,
  webSearchEnabled: false, onWebSearchEnabledChange: refuse, knowledgeGraphEnabled: false, onKnowledgeGraphEnabledChange: refuse,
  showKnowledgeGraphToggle: false, knowledgeGraphAccess: 'unavailable', onKnowledgeGraphAccessClick: refuse,
  isReady: false, isLoadingSession: false, connected: false, connecting: false,
  user: { id: 'offline-props' }, currentSessionId: null, onRequestSession: refuse,
  buildTheme: { mode: 'auto' }, onBuildThemeChange: refuse,
}
for (const variant of [{}, { connected: true, isReady: true }, { connecting: true }, { isLoadingSession: true }, { awaitingReply: true }, { isTemplateReuseRunning: true }, { uploadedFiles: [{ id: 'local-file', name: 'Local synthetic upload.pdf', status: 'uploading', size: 100, type: 'application/pdf' }] }, { pendingActionInput: { action: { label: 'Original pending action' }, messageId: 'local', timestamp: 1 } }]) {
  const regular = ChatInput({ ...baseProps, ...variant })
  const compact = ChatInput({ ...baseProps, ...variant, showConnectionStatus: false })
  const footer = tree => nodes(tree).find(node => node.props?.['data-studio-composer-part'] === 'footer')
  assert.equal(nodes(footer(regular)).filter(node => node.props?.['data-studio-composer-part'] === 'connection').length, 1, 'standalone composer retains connection by default')
  assert.equal(nodes(footer(compact)).filter(node => node.props?.['data-studio-composer-part'] === 'connection').length, 0)
  assert.equal(textOf(footer(regular).props.children[0]), textOf(footer(compact).props.children[0]), 'all keyboard/busy/upload/loading instructions preserved')
  assert.equal(nodes(regular).find(node => node.type === 'Textarea').props.value, baseProps.inputMessage)
  assert.equal(nodes(compact).find(node => node.type === 'Textarea').props.value, baseProps.inputMessage)
  assert.equal(nodes(regular).find(node => node.type === 'Textarea').props.disabled, nodes(compact).find(node => node.type === 'Textarea').props.disabled)
  assert.equal(nodes(regular).find(node => node.props?.type === 'submit')?.props.disabled, nodes(compact).find(node => node.props?.type === 'submit')?.props.disabled)
  const stopControls = tree => nodes(tree).filter(node => node.props?.['aria-label']?.startsWith('Stop')).map(node => [node.props['aria-label'], node.props.disabled])
  assert.deepEqual(stopControls(regular), stopControls(compact), 'native stop controls remain present with original gates')
  if (variant.pendingActionInput) assert.ok(textOf(compact).includes('Original pending action'))
}
assert.equal(nodes(StudioWelcome({})).some(node => node.props?.['data-studio-director-welcome-part'] === 'connection'), false, 'optional welcome status disappears only when owner omits it')
assert.equal(nodes(StudioWelcome({ connectionState: 'disconnected' })).some(node => node.props?.['data-studio-director-welcome-part'] === 'connection'), true, 'standalone welcome still supports supplied status')
flag = 'false'
assert.equal(nodes(ChatInput({ ...baseProps, showConnectionStatus: false })).some(node => node.props?.['data-studio-composer-part'] === 'footer'), false)
const page = fs.readFileSync(new URL('../app/builder/page.tsx', import.meta.url), 'utf8')
assert.match(page, /studioShell && <StudioDirectorHeader connectionState=\{connectionState\} isLoadingSession=\{session\.isLoadingSession\} \/>/)
assert.match(page, /showConnectionStatus=\{!studioShell\}/)
assert.ok(page.indexOf('{studioShell && <StudioDirectorHeader') < page.indexOf('                  <TokenUsageStrip'))
console.log('Persistent Director header passed: actual connection/loading labels and literal flag, no readiness/call claims, no controls, default/hidden composer connection with unchanged drafts/gates/instructions/actions, standalone welcome status and native page wiring. No effects/services/requests ran; root owns geometry captures.')
