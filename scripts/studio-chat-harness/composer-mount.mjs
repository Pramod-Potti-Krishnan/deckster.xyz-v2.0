// FRONTEND-1, chat parity chain (#611 / #614 / #619): the REAL composer (components/builder/chat-input.tsx with the "/" and "@" hook) on the offline React host (mini-react), for the chain's proofs.
// The shape of scripts/test-studio-chat-commands.mjs' mountComposer (the Radix pieces, the template popup, the theme menu and the model gauge are recorders), with two additions the chain needs:
//   - `read`: (rel, text) => text, applied to every repo file the loader reads, so a proof can mount the composer as dev had it (the chain's strips put dev's files back) next to the composer as the chain has it;
//   - `page`: the page props the composer is given (slides, the current slide, the note function), and `user`, so the hand-off's account can be told.
// Test-only: nothing under app/, components/, hooks/ or lib/ imports this file. Load it AFTER process.env.NODE_ENV is set to 'production' (React is loaded here, lazily).
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createModuleLoader } from './module-loader.mjs'
import { Root, hostNodes, toElements } from './mini-react.mjs'

export const ON = Object.freeze({ NEXT_PUBLIC_STUDIO_CHAT_COMMANDS: 'true', NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true', NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' })
export const SLIDES = Object.freeze([
  { index: 0, title: 'Title', slide_id: 'L0' }, { index: 1, title: 'Market size', slide_id: 'L1' }, { index: 2, title: 'Revenue plan', slide_id: 'L2' },
  { index: 3, title: 'Team', slide_id: 'L3' }, { index: 4, title: 'Risks', slide_id: 'L4' }, { index: 5, title: 'Roadmap', slide_id: 'L5' }, { index: 6, title: 'Ask', slide_id: 'L6' },
])
const FILES = [
  { id: 'f1', name: 'q3 report.pdf', size: 1, type: 'application/pdf', status: 'success', uploadProgress: 100 },
  { id: 'f2', name: 'notes.docx', size: 1, type: 'application/msword', status: 'processing', uploadProgress: 100 },
]
export const ROUTES = Object.freeze({
  '/api/templates': { templates: [{ id: 't1', name: 'Board update' }, { id: 't2', name: 'Pitch deck' }], count: 2 },
  '/api/themes': { themes: [{ id: 'u-77', name: 'Midnight sun', theme_payload: { mode: 'preset', preset_id: 'corporate_light' } }], count: 1 },
})
const macrotask = () => new Promise(resolve => setImmediate(resolve))
const INPUT = 'components/builder/chat-input.tsx'

const FILE_STUBS = records => ({
  'components/builder/studio-composer-hint': { StudioComposerHint: ({ children }) => children },
  'components/ui/dropdown-menu': { DropdownMenu: props => { records.menus.push(props); return props.children }, DropdownMenuTrigger: ({ children }) => children, DropdownMenuContent: props => props.children },
  'components/ui/switch': { Switch: () => null }, 'components/file-chip': { FileChip: () => null },
  'components/ui/textarea': { Textarea: globalThis.__chatParityReact.forwardRef((props, ref) => { records.textareaRef = ref; return globalThis.__chatParityReact.createElement('textarea', props) }) },
  'components/model-choice/model-picker': { ModelPicker: props => globalThis.__chatParityReact.createElement('button', { type: 'button', 'data-mpick': 'gauge', disabled: Boolean(props.disabled), onClick: () => records.calls.push(['gauge']) }) },
  'components/builder/studio-theme-menu': { StudioThemeMenu: () => null },
  'components/builder/template-picker': { TemplatePicker: props => { records.pickers.push(props); return null } },
})

/**
 * Mount the composer. `env` is the build-time environment (undefined removes a name); `read(rel, text)` rewrites a repo file as the loader reads it; `page` overrides the page props; `user` is the signed-in user the composer is given.
 * The returned `api` types into the field, presses keys, lists the menu's rows and the note, and records what the composer called (records.calls).
 */
export async function mountComposer(opts = {}) {
  const root = opts.root
  const require = createRequire(path.join(root, 'package.json'))
  const React = require('react')
  globalThis.__chatParityReact = React
  const records = { menus: [], pickers: [], fetches: [], calls: [], notes: [], opened: [] }
  const doc = { find: () => [] }
  const env = { NODE_ENV: 'production', ...ON, NEXT_PUBLIC_CHAT_MENTIONS: 'true', NEXT_PUBLIC_STUDIO_CHAT_UNDO: 'true', NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true', ...(opts.env ?? {}) }
  for (const [name, value] of Object.entries(env)) if (value === undefined) delete env[name]
  const fetchFn = async url => {
    records.fetches.push(String(url))
    const route = (opts.routes ?? ROUTES)[String(url)]
    return route ? { ok: true, status: 200, json: async () => route } : { ok: false, status: 500, json: async () => ({}) }
  }
  const store = new Map()
  const storage = { getItem: key => (store.has(key) ? store.get(key) : null), setItem: (key, value) => { store.set(key, String(value)) }, removeItem: key => { store.delete(key) } }
  const win = { localStorage: storage, open: (...args) => { records.opened.push(args); return null }, location: { assign: path => records.opened.push(['assign', path]) } }
  const fsReal = fs.readFileSync
  const read = opts.read ?? null
  fs.readFileSync = function (file, ...rest) {
    const out = fsReal.call(this, file, ...rest)
    const rel = typeof file === 'string' ? path.relative(root, file) : null
    return read && rel && typeof out === 'string' ? read(rel, out) : out
  }
  let mod, cleanLib, loader
  try {
    loader = createModuleLoader({
      root,
      globals: { process: { env }, console, setTimeout, clearTimeout, setInterval, clearInterval, Date, Symbol, Promise, Math, JSON, Object, Array, Error, Map, Set, Number, String, Boolean, RegExp, TextEncoder, TextDecoder, URL, queueMicrotask,
        fetch: fetchFn, window: win, document: { querySelectorAll: sel => doc.find(sel), getElementById: id => ({ scrollIntoView: options => records.calls.push(['scroll', id, options]) }) }, ...(opts.globals ?? {}) },
      stubs: opts.stubs ?? {}, fileStubs: { ...FILE_STUBS(records), ...(opts.fileStubs ?? {}) },
    })
    mod = loader.load(INPUT); cleanLib = loader.load('lib/studio-chat-clean.ts')
  } finally { fs.readFileSync = fsReal }
  const composer = over => cleanLib.chatCleanComposerState({ enabled: true, active: false, phase: 'idle', control: 'idle', slidesDone: 0, slideCount: 0, controlEnabled: true, ackKey: null, ackLine: '', ...over })
  const state = { text: opts.text ?? '', extra: { ...(opts.props ?? {}) }, set: null }
  const page = { slides: SLIDES, currentSlide: 3, getElement: () => null, exportDeck: async format => { records.calls.push(['export', format]); return { status: 'done', error_code: null } },
    parity: { addNote: text => { records.notes.push(text) } }, ...(opts.page ?? {}) }
  function Wrapper() {
    const [value, setValue] = React.useState(state.text)
    state.text = value; state.set = setValue
    const props = {
      inputMessage: value, onInputChange: v => { state.text = v; setValue(v) }, onSubmit: () => records.calls.push(['submit', state.text]), uploadedFiles: FILES, onFilesSelected() {}, onRemoveFile() {}, onClearAllFiles() {}, pendingActionInput: null, onCancelAction() {},
      researchEnabled: false, onResearchEnabledChange: v => records.calls.push(['deep', v]), webSearchEnabled: false, onWebSearchEnabledChange: v => records.calls.push(['web', v]), knowledgeGraphEnabled: false, onKnowledgeGraphEnabledChange() {}, showKnowledgeGraphToggle: false,
      knowledgeGraphAccess: 'unavailable', onKnowledgeGraphAccessClick() {}, isReady: true, isLoadingSession: false, connected: true, connecting: false, user: opts.user === undefined ? { id: 'u1' } : opts.user, currentSessionId: 's1', onRequestSession: async () => {}, buildTheme: { mode: 'auto' },
      onBuildThemeChange: theme => records.calls.push(['theme', theme]), templateBuilderEnabled: true, onSelectTemplate: template => records.calls.push(['select-template', template?.id ?? null]), onOpenComposerLibrary: undefined,
      studioChatClean: { composer: composer(opts.composer ?? {}), onStop: () => records.calls.push(['stop']), onSendDirections() {}, sessionId: 's1' },
      studioChatCommands: page, ...state.extra,
    }
    return React.createElement(mod.ChatInput, props)
  }
  const rootNode = new Root()
  rootNode.setElement(React.createElement(Wrapper))
  const settle = async () => { for (let quiet = 0, rounds = 0; quiet < 2; rounds++) { if (rounds > 80) throw new Error('did not settle'); await macrotask(); quiet = rootNode.flush() ? 0 : quiet + 1 } }
  await settle()
  const fakeTextarea = { focused: 0, selection: null, style: {}, scrollHeight: 20, getBoundingClientRect: () => ({ width: 300 }), focus() { this.focused++ }, setSelectionRange(a, b) { this.selection = [a, b] }, closest: () => ({ querySelectorAll: sel => doc.find(sel, 'composer') }), get value() { return state.text } }
  const api = {
    records, state, doc, rootNode, settle, page, loader, store, storage, win,
    nodes: () => hostNodes(rootNode.tree),
    ta() { const node = hostNodes(rootNode.tree).find(n => n.type === 'textarea'); if (records.textareaRef && typeof records.textareaRef === 'object') records.textareaRef.current = fakeTextarea; return node },
    async type(value) { api.ta().props.onChange({ target: { value } }); await settle() },
    async key(key, extra = {}) { const event = { key, shiftKey: false, nativeEvent: {}, prevented: 0, preventDefault() { this.prevented++ }, ...extra }; api.ta().props.onKeyDown(event); await settle(); return event },
    menu: () => hostNodes(rootNode.tree).find(n => n.props?.['data-studio-chat-commands-menu']) ?? null,
    rows: () => hostNodes(rootNode.tree).filter(n => n.type === 'button' && n.props.role === 'option'),
    note: () => hostNodes(rootNode.tree).find(n => n.props?.['data-studio-chat-commands-note']) ?? null,
    labels: () => api.rows().map(n => n.props['aria-label']),
    text: () => state.text,
    markup: () => require('react-dom/server').renderToStaticMarkup(toElements(rootNode.tree)),
    unmount: () => rootNode.unmount(),
  }
  return api
}

// ---- scripted sessions, shared by the chain's three proofs ------------------------------------------------------------------------------------------------------------------------------------

/** The chain's one flag, on. */
export const PARITY = Object.freeze({ NEXT_PUBLIC_STUDIO_CHAT_PARITY_COMMANDS: 'true' })
/** React's generated ids differ by the order of hooks in a render: what a person sees does not. */
export const normaliseIds = text => text.replace(/:r[0-9a-z]+:/g, ':id:').replace(/\bradix-[:\w-]+/g, 'radix-id')

/**
 * dev's file reader for `mountComposer({ read })`: every chat parity change registered so far (the viewer's, and any stacked on it), newest first, takes its lines out of the file it is given; what is left is dev's file.
 * `registry` is scripts/studio-later-changes.mjs (a strip is found by its name, so a proof run at an older step sees only the strips that exist there).
 */
export const chainDev = registry => {
  const strips = registry.LATER_STRIPS.filter(fn => /^stripChatParity(Viewer|Workspace|More)$/.test(fn.name)).reverse()
  return (rel, text) => strips.reduce((out, fn) => fn(rel, out), text)
}

/**
 * One scripted session on a mounted composer: [['type', text] | ['key', name]] steps. After every step it records what a person could see (the composer's whole markup, the menu's labels) and what the composer did
 * (the calls it made, the notes it was given, the windows it opened, the hand-off storage): two sessions that log the same are the same composer.
 */
export async function driveComposer({ root, env = {}, read = null, steps, ...extra }) {
  const c = await mountComposer({ root, env, read, ...extra })
  const log = []
  try {
    for (const [kind, value] of steps) {
      if (kind === 'type') await c.type(value); else await c.key(value)
      log.push({ step: [kind, value], text: c.text(), menu: c.menu() ? c.labels() : null, calls: c.records.calls.map(call => JSON.stringify(call)), notes: c.records.notes.slice(), opened: c.records.opened.map(call => JSON.stringify(call)), storage: [...c.store.entries()], markup: normaliseIds(c.markup()) })
    }
  } finally { c.unmount() }
  return log
}

/** The menu's labels (aria-labels) after typing `text` into a fresh composer; null when no menu opens. */
export async function labelsOf({ root, env = {}, read = null, text, ...extra }) {
  const c = await mountComposer({ root, env, read, ...extra })
  try { await c.type(text); return c.menu() ? c.labels() : null } finally { c.unmount() }
}
