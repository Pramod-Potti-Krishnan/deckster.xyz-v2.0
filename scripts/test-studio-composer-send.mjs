// Actual ChatInput callback/DOM-state fixture only. Effects are not run; all
// theme/session/upload/network actions refuse execution. No transport ACKs.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const root = new URL('../', import.meta.url), file = 'components/builder/chat-input.tsx'
const source = fs.readFileSync(new URL(file, root), 'utf8')
const before = execFileSync('git', ['show', `42b5c93:${file}`], { cwd: root, encoding: 'utf8' })
const initializer = '  const isSubmitDisabled = (studio ? !user || isLoadingSession : !isReady) || !inputMessage.trim() || isSendBlocked\n'
assert.equal(source.split(initializer).length, 2)
assert.equal(source.split('disabled={isSubmitDisabled}').length, 3)
function restoreAcceptedComposer(value) {
  const replace = (from, to, count = 1) => {
    assert.equal(value.split(from).length - 1, count, `Named Theme transform ${from.slice(0, 70)}`)
    value = value.replaceAll(from, to)
  }
  replace("import { StudioThemeMenu, type StudioThemeView, type StudioThemeMutationKind, type StudioThemeMutationNotice } from './studio-theme-menu'\n", '')
  for (const name of ['read ownership', 'refresh', 'read recovery', 'mutations']) {
    const pattern = new RegExp(`^  +// Studio theme ${name} START[^\\n]*\\n[\\s\\S]*?^  +// Studio theme ${name} END\\.\\n`, 'gm')
    assert.equal([...value.matchAll(pattern)].length, 1, `One marked ${name} block`)
    value = value.replace(pattern, '')
  }
  const presentation = /^                  \{\/\* Studio theme presentation START \*\/\}\n[\s\S]*?^                  \{\/\* Studio theme classic body START \*\/\}\n([\s\S]*?)^                  \{\/\* Studio theme classic body END \*\/\}\n[\s\S]*?^                  \{\/\* Studio theme presentation END \*\/\}\n/gm
  const matches = [...value.matchAll(presentation)]
  assert.equal(matches.length, 1, 'One named Studio presentation branch with preserved classic body')
  value = value.replace(presentation, (_whole, body) => body)
  replace("data-studio-v4-menu=\"theme\" align=\"start\" className={studio ? 'studio-theme-popover' : 'w-72 p-2'}", 'data-studio-v4-menu="theme" align="start" className="w-72 p-2"')
  for (const kind of ['save', 'set-standard', 'clear-standard', 'delete']) replace(`    if (studio) { await runStudioThemeMutation('${kind}'); return }\n`, '')
  replace('  }, [listThemes, studio, studioThemeOwner])', '  }, [listThemes])')
  replace(`      const pendingRead = refreshSavedThemes(true)
      const readSequence = studioThemeReadSequence.current
      const result = await pendingRead
      if (cancelled || studioThemeOwnerRef.current !== studioThemeOwner
        || studioThemeReadSequence.current !== readSequence || !studioThemeMount.current.active) return
      studioThemeRequestOwner.current = studioThemeOwner`, `      const result = await refreshSavedThemes(true)
      if (cancelled) return`)
  replace(`    : activeSavedThemeRequest && studioThemeRequestOwner.current === studioThemeOwner
      && unavailableSavedThemeRequest?.key === activeSavedThemeRequest.key`, '    : activeSavedThemeRequest && unavailableSavedThemeRequest?.key === activeSavedThemeRequest.key')
  replace('    && (!studio || (activeSavedThemeRequest && studioThemeRequestOwner.current === studioThemeOwner))\n', '')
  replace('visibleSavedThemes', 'savedThemes', 4)
  replace('    if (studio) studioThemeSelection.current.epoch += 1\n', '', 3)
  for (const line of [
    "      recordStudioThemeSelection(null, { mode: 'auto' }, false)",
    "      recordStudioThemeSelection(null, { mode: 'preset', preset_id: normalized }, false)",
    "    recordStudioThemeSelection(null, isValidThemeHex(normalized) ? { mode: 'custom', primary_hex: normalized.toLowerCase() } : buildTheme, false)",
    '      recordStudioThemeSelection(null, buildTheme, false)',
    '    recordStudioThemeSelection(profile.id, profile.theme_payload, false)',
  ]) replace(line + '\n', '')
  replace(`<DropdownMenuContent onKeyDownCapture={studio ? (event) => {
                  // Native form Tab traversal must run before Radix menu key handling.
                  if (event.key === 'Tab') event.stopPropagation()
                } : undefined} data-studio-composer-menu={studio ? 'theme' : undefined}`, `<DropdownMenuContent data-studio-composer-menu={studio ? 'theme' : undefined}`)
  return value
}

assert.equal(restoreAcceptedComposer(source).replace(initializer, '').replaceAll('disabled={isSubmitDisabled}', 'disabled={!isReady || !inputMessage.trim() || isSendBlocked}'), before,
  'Reversing only explicitly named native theme recovery additions and Studio pointer Send availability restores exact historical handlers/pickers/options/effects')
const compile = text => {
  const result = ts.transpileModule(text, { reportDiagnostics: true, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } })
  assert.deepEqual((result.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), [])
  return result.outputText
}
const jsx = (type, props) => ({ type, props: props || {} })
const pure = { exports: {} }
vm.runInNewContext(compile(fs.readFileSync(new URL('lib/mdc-mentions.ts', root), 'utf8')), { module: pure, exports: pure.exports })
const uploadAst = ts.createSourceFile('lib/upload-status.ts', fs.readFileSync(new URL('lib/upload-status.ts', root), 'utf8'), ts.ScriptTarget.Latest, true)
const uploadStatuses = uploadAst.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === 'UploadLifecycleStatus').type.types.map(node => node.literal.text)
assert.deepEqual(uploadStatuses, ['uploading', 'stored', 'processing', 'success', 'degraded', 'error'])
const refuse = () => { throw new Error('Offline composer test refuses services, persistence and application actions') }
const children = tree => Array.isArray(tree) ? tree.flatMap(children) : !tree || typeof tree !== 'object' ? [] : [tree, ...children(tree.props?.children)]
const find = (tree, predicate) => { const matches = children(tree).filter(predicate); assert.equal(matches.length, 1); return matches[0] }
const event = (key, shiftKey = false) => ({ key, shiftKey, prevented: false, preventDefault() { this.prevented = true } })
function harness(options = {}) {
  const { mentions = true, original = false, override = {}, submitResult } = options
  const flag = Object.hasOwn(options, 'flag') ? options.flag : 'true'
  const states = [], refs = [], effects = [], calls = [], changes = [], cancel = [], focus = []; let stateCursor = 0, refCursor = 0
  const defaults = {
    inputMessage: 'A local unsent draft', uploadedFiles: [], pendingActionInput: null,
    awaitingReply: false, user: { id: 'offline-user' }, isReady: false, connected: false,
    connecting: false, isLoadingSession: false, isTemplateReuseRunning: false,
    researchEnabled: false, webSearchEnabled: false, knowledgeGraphEnabled: false,
    showKnowledgeGraphToggle: false, knowledgeGraphAccess: 'locked',
    buildTheme: { mode: 'auto' }, currentSessionId: 'offline-session',
    onInputChange: value => changes.push(value), onSubmit: e => { calls.push(e); return submitResult },
    onCancelAction: () => cancel.push('action'), onStopAwaiting: () => cancel.push('reply'),
    onCancelTemplateReuse: () => cancel.push('template'), onFilesSelected: refuse,
    onRemoveFile: refuse, onClearAllFiles: refuse, onRequestSession: refuse,
    onResearchEnabledChange: refuse, onWebSearchEnabledChange: refuse,
    onKnowledgeGraphEnabledChange: refuse, onKnowledgeGraphAccessClick: refuse,
    onBuildThemeChange: refuse, ...override,
  }
  const imports = {
    react: {
      useState(initial) { const i = stateCursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
      useRef(initial) { const i = refCursor++; if (!(i in refs)) refs[i] = { current: initial }; return refs[i] },
      useCallback: fn => fn, useEffect: fn => effects.push(fn),
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@/lib/mdc-mentions': pure.exports, '@/lib/mdc-flags': { CHAT_MENTIONS: mentions },
    '@/lib/config': { config: { api: { themeBuilderUrl: 'https://offline.invalid' } }, features: { enableFileUploads: true, enableElementAnotherTheme: false } },
    '@/lib/theme-builder': { FALLBACK_THEME_PRESETS: [], isValidThemeHex: () => true, normalizeThemePresetId: value => value },
    '@/hooks/use-theme-profiles': { useThemeProfiles: () => ({ loading: false, error: null, listThemes: refuse, saveTheme: refuse, setStandardTheme: refuse, clearStandardTheme: refuse, deleteTheme: refuse }) },
    '@/hooks/use-templates': { isTemplateGenerationReady: item => !item || item.ready === true, templateGenerationUnavailableReason: () => 'Supplied review-only status' },
  }
  const module = { exports: {} }
  vm.runInNewContext(compile(original ? before : source), {
    module, exports: module.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } }, fetch: refuse,
    console: { log() {}, error() {} },
    require: name => {
      if (name in imports) return imports[name]
      if (name === 'lucide-react' || name.startsWith('@/components/') || name === './template-picker' || name === './studio-theme-menu') return new Proxy({}, { get: (_target, key) => key })
      throw new Error(`Offline composer test refuses dependency ${name}`)
    },
  })
  const render = (extra = {}) => {
    stateCursor = 0; refCursor = 0; effects.length = 0
    Object.assign(defaults, extra)
    const tree = module.exports.ChatInput(defaults), textarea = find(tree, node => node.type === 'Textarea')
    const target = { focus: options => focus.push(options) }
    if (typeof textarea.props.ref === 'function') textarea.props.ref(target)
    else textarea.props.ref.current = target
    return tree
  }
  return { render, calls, changes, cancel, focus, props: defaults }
}
const send = tree => children(tree).find(node => node.props?.['data-studio-v4-send'] === 'true')
const textarea = tree => find(tree, node => node.type === 'Textarea')
const form = tree => find(tree, node => node.type === 'form')
const pointer = (h, tree) => { const button = send(tree); if (button && !button.props.disabled) { const e = event(); form(tree).props.onSubmit(e); return e } }
const keypress = (h, tree, key, shift = false) => { const e = event(key, shift); if (!textarea(tree).props.disabled) textarea(tree).props.onKeyDown(e); return e }
let checks = 1

for (const flag of [undefined, 'false', 'TRUE', '1', 'true']) {
  for (const ready of [false, true]) for (const inputMessage of ['', '  \n ', 'A local unsent draft']) {
    const h = harness({ flag, override: { isReady: ready, connected: ready, inputMessage } }), tree = h.render()
    const b = send(tree), expected = !inputMessage.trim() || (flag !== 'true' && !ready)
    assert.equal(b.props.disabled, expected); assert.equal(b.props['aria-disabled'], expected)
    pointer(h, tree); assert.equal(h.calls.length, expected ? 0 : 1)
    assert.equal(textarea(tree).props.value, inputMessage); assert.deepEqual(h.changes, [])
    if (flag !== 'true') {
      const prior = harness({ flag, original: true, override: { isReady: ready, connected: ready, inputMessage } }).render()
      assert.equal(b.props.disabled, send(prior).props.disabled); assert.equal(b.props['aria-disabled'], send(prior).props['aria-disabled'])
    }
    checks++
  }
}

for (const ready of [false, true]) for (const connecting of [false, true]) {
  const h = harness({ override: { isReady: ready, connected: ready, connecting } }), tree = h.render()
  assert.equal(send(tree).props.disabled, false)
  const e = pointer(h, tree); assert.equal(h.calls[0], e, 'Pointer forwards the original form event through native guardedSubmit')
  keypress(h, tree, 'Enter'); assert.equal(h.calls.length, 2); assert.equal(h.calls[1], undefined, 'Native Enter argument stays unchanged')
  keypress(h, tree, 'Enter', true); assert.equal(h.calls.length, 2)
  assert.deepEqual(h.changes, []); checks++
}

for (const override of [
  { user: null }, { isLoadingSession: true }, { awaitingReply: true },
  { uploadedFiles: [{ id: 'local-upload', name: 'Local source', status: 'uploading' }] },
  { uploadedFiles: [{ id: 'local-upload', name: 'Local source', status: 'error' }] },
]) for (const ready of [false, true]) {
  const h = harness({ override: { ...override, isReady: ready, connected: ready } }), tree = h.render()
  assert.equal(send(tree).props.disabled, true); assert.equal(send(tree).props['aria-disabled'], true)
  pointer(h, tree); keypress(h, tree, 'Enter'); assert.equal(h.calls.length, 0)
  assert.deepEqual(h.changes, []); checks++
}
for (const status of uploadStatuses.filter(value => !['uploading', 'error'].includes(value))) {
  const h = harness({ override: { uploadedFiles: [{ id: 'stored-local-source', name: 'Local source', status }] } }), tree = h.render()
  assert.equal(send(tree).props.disabled, false); pointer(h, tree); keypress(h, tree, 'Enter')
  assert.equal(h.calls.length, 2, 'Stored/background enrichment retains native nonblocking behavior'); checks++
}
{
  const h = harness({ override: { isTemplateReuseRunning: true } }), tree = h.render()
  assert.equal(send(tree), undefined); assert.equal(textarea(tree).props.disabled, true)
  const stop = find(tree, node => node.props?.['aria-label'] === 'Stop template reuse')
  assert.equal(stop.props.onClick, h.props.onCancelTemplateReuse); stop.props.onClick()
  keypress(h, tree, 'Enter'); assert.equal(h.calls.length, 0); assert.deepEqual(h.cancel, ['template']); checks++
}
for (const locked of [false, true]) for (const ready of [false, true]) {
  const h = harness({ override: { activeTemplate: { id: 'local-template', name: 'Local template', ready }, templateSelectionLocked: locked } }), tree = h.render()
  const old = harness({ original: true, override: { ...h.props, isReady: true, connected: true } }).render()
  assert.equal(send(tree).props.disabled, send(old).props.disabled, 'No new template readiness/selection policy is inserted in Send')
  pointer(h, tree); assert.equal(h.calls.length, 1); checks++
}

const slides = [{ index: 0, title: 'Overview', slide_id: 'local-one' }, { index: 1, title: 'Revenue', slide_id: 'local-two' }]
for (const flag of ['true', 'false']) for (const mentions of [true, false]) for (const key of ['Enter', 'Tab']) {
  const h = harness({ flag, mentions, override: { inputMessage: 'Discuss @rev', mentionSlides: slides } }), tree = h.render()
  const e = keypress(h, tree, key)
  if (mentions) {
    assert.equal(e.prevented, true); assert.deepEqual(h.changes, ['Discuss @[Slide 2: Revenue] ']); assert.equal(h.calls.length, 0)
    const updated = h.render({ inputMessage: h.changes[0] })
    assert.equal(send(updated).props.disabled, flag !== 'true')
  } else {
    assert.deepEqual(h.changes, []); assert.equal(h.calls.length, key === 'Enter' ? 1 : 0)
  }
  checks++
}
for (const query of ['@', '@1', '@overview', '@notfound']) {
  const h = harness({ override: { inputMessage: `Discuss ${query}`, mentionSlides: slides } }), tree = h.render()
  const match = pure.exports.filterMentionSlides(slides, query.slice(1))
  keypress(h, tree, 'Enter')
  assert.equal(h.calls.length, match.length ? 0 : 1)
  if (match.length) assert.deepEqual(h.changes, [`Discuss ${pure.exports.mentionToken(match[0])} `])
  const shifted = harness({ override: { inputMessage: `Discuss ${query}`, mentionSlides: slides } }), shiftedTree = shifted.render()
  keypress(shifted, shiftedTree, 'Enter', true); keypress(shifted, shiftedTree, 'Tab', true)
  assert.deepEqual(shifted.changes, []); assert.equal(shifted.calls.length, 0); checks++
}
{
  const h = harness({ override: { inputMessage: 'Discuss @rev', mentionSlides: slides } }), tree = h.render()
  const picker = find(tree, node => node.type === 'SlideMentionPopover')
  picker.props.onSelect(slides[1]); picker.props.onKeyboardSelect()
  assert.deepEqual(h.changes, ['Discuss @[Slide 2: Revenue] ']); assert.equal(h.focus.length, 1); assert.equal(h.focus[0].preventScroll, true); assert.equal(h.calls.length, 0); checks++
}
for (const override of [{ awaitingReply: true }, { pendingActionInput: { action: { label: 'Native action' }, messageId: 'local-action', timestamp: 1 } }]) {
  const h = harness({ override }), tree = h.render(); const e = keypress(h, tree, 'Escape')
  assert.equal(e.prevented, true); assert.deepEqual(h.cancel, [override.awaitingReply ? 'reply' : 'action']); assert.equal(h.calls.length, 0); checks++
}
{
  const h = harness({ submitResult: false }), tree = h.render()
  pointer(h, tree); assert.equal(h.calls.length, 1); assert.equal(textarea(tree).props.value, 'A local unsent draft')
  assert.deepEqual(h.changes, [], 'Leaf does not clear, echo, persist or claim success after callback refusal'); checks++
}
console.log(`PASS ${checks} actual composer flag/send/gate/native-callback/mention/draft/classic/source-preservation cases; effects/services/runtime/transport ACKs refused.`)
