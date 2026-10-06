import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { readAtlasBaseline } from './atlas-witness-baseline.mjs'
import ts from 'typescript'
import postcss from 'postcss'

// Actual public Help page and support leaf. All mail/network/navigation/timers
// refuse. Clipboard requests use a local counter, never the system clipboard.
const root = new URL('../', import.meta.url), checkpoint = 'fffd023'
const read = path => fs.readFileSync(new URL(path, root), 'utf8')
const pageSource = read('app/help/page.tsx'), supportSource = read('components/help/studio-help.tsx')
const baseline = readAtlasBaseline(`${checkpoint}:app/help/page.tsx`)
const jsx = (type, props, key) => ({ type, props, key })
const flat = v => Array.isArray(v) ? v.flatMap(flat) : !v || typeof v !== 'object' ? [] : [v, ...flat(v.props?.children)]
const text = v => Array.isArray(v) ? v.map(text).join('') : v == null || typeof v === 'boolean' ? '' : typeof v === 'object' ? text(v.props?.children) : String(v)
const refuse = () => assert.fail('No external request, programmatic email opening, navigation or timer is allowed')
const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j }); return { promise, resolve, reject } }
const compile = source => {
  const out = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  assert.equal(out.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
  return out.outputText
}
function evaluate(code, imports, extra = {}) {
  const mod = { exports: {} }
  vm.runInNewContext(compile(code), { module: mod, exports: mod.exports, fetch: refuse, setTimeout: refuse, window: { location: { assign: refuse } }, require: id => { assert.ok(id in imports, id); return imports[id] }, ...extra })
  return mod.exports
}
function stateRuntime() {
  const cells = [], effects = []
  let cursor = 0, scheduled = false, retired = false, writes = 0
  const react = {
    useState(initial) { const i = cursor++; cells[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [cells[i].value, next => { assert.equal(retired, false, 'no retired component writes'); writes++; const value = typeof next === 'function' ? next(cells[i].value) : next; if (!Object.is(value, cells[i].value)) scheduled = true; cells[i].value = value }] },
    useRef(initial) { const i = cursor++; return cells[i] ??= { current: initial } },
    useEffect(effect, deps) { const i = cursor++, old = cells[i]; if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) { cells[i] = { deps, effect, cleanup: old?.cleanup }; effects.push(() => { old?.cleanup?.(); cells[i].cleanup = effect() }) } },
  }
  return { react,
    render(fn) { let tree, attempts = 0; do { assert.ok(attempts++ < 10); cursor = 0; scheduled = false; tree = fn(); while (effects.length) effects.shift()() } while (scheduled); return tree },
    retire() { retired = true; cells.forEach(c => c?.cleanup?.()) },
    replay() { retired = false; cells.forEach(c => { if (c?.effect) c.cleanup = c.effect() }) },
    get writes() { return writes },
  }
}
const ui = names => Object.fromEntries(names.map(name => [name, name]))
function supportHarness() {
  const state = stateRuntime(), calls = [], context = { navigator: { clipboard: { writeText: value => { calls.push(value); return api.write(value) } } } }
  const api = { write: async () => {} }
  const imports = { react: state.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/link': { default: 'Link' }, 'lucide-react': ui(['Copy', 'Mail']), '@/components/layout/studio-rail': { StudioRail: 'StudioRail' }, '@/components/layout/app-header': { BackToBuilderButton: 'BackToBuilderButton' }, '@/components/ui/input': { Input: 'Input' }, '@/components/ui/label': { Label: 'Label' }, '@/components/ui/textarea': { Textarea: 'Textarea' }, './studio-help.css': {} }
  // Access test-only handler from the same persistent module context.
  const exposed = { value: null }
  const module = { exports: {} }
  vm.runInNewContext(compile(supportSource.replace('  return (\n    <div data-studio-help-part="support-draft">', '  exposed.value = copyDraft\n  return (\n    <div data-studio-help-part="support-draft">')), { module, exports: module.exports, exposed, navigator: context.navigator, fetch: refuse, require: id => { assert.ok(id in imports); return imports[id] } })
  let props = { subject: 'Issue & café?', message: 'First line\nKeep my details #1' }, tree
  const h = { api, calls, context, helpers: module.exports,
    render(next = props) { props = { ...next, onSubjectChange: subject => h.render({ ...props, subject }), onMessageChange: message => h.render({ ...props, message }) }; tree = state.render(() => module.exports.StudioSupportDraft(props)); return tree },
    copy: () => exposed.value(), get copyHandler() { return exposed.value }, retire: () => state.retire(), replay() { state.replay(); h.render() },
    get props() { return props }, get tree() { return tree }, get writes() { return state.writes },
  }
  h.render(); return h
}
const helperHarness = supportHarness(), helpers = helperHarness.helpers
function pageHarness(code = pageSource, flag) {
  if (arguments.length < 2) flag = 'true'
  const state = stateRuntime(), auth = { user: null, isLoading: false }
  const imports = { react: state.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '@/hooks/use-auth': { useAuth: () => auth }, 'next/navigation': { useRouter: () => ({ push: refuse }) }, '@/components/help/studio-help': { ...helpers, StudioHelpFrame: 'StudioHelpFrame', StudioSupportDraft: 'StudioSupportDraft' }, 'next/link': { default: 'Link' }, 'framer-motion': { motion: { div: 'motion.div' } }, '@/components/layout': ui(['Header', 'Footer']), '@/components/marketing/PageHeader': { PageHeader: 'PageHeader' }, '@/components/marketing/Section': { Section: 'Section' }, 'lucide-react': ui(['BookOpen', 'MessageSquare', 'Video', 'FileQuestion', 'Mail', 'ExternalLink', 'Search', 'ChevronRight', 'Sparkles', 'Users', 'Zap', 'Shield']) }
  for (const [name, exports] of [['button', ['Button']], ['card', ['Card', 'CardContent', 'CardDescription', 'CardHeader', 'CardTitle']], ['input', ['Input']], ['label', ['Label']], ['textarea', ['Textarea']], ['tabs', ['Tabs', 'TabsContent', 'TabsList', 'TabsTrigger']], ['alert', ['Alert', 'AlertDescription']], ['badge', ['Badge']]]) imports[`@/components/ui/${name}`] = ui(exports)
  const mod = evaluate(code, imports, { process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } } })
  let tree
  const h = { auth,
    render() { tree = state.render(() => mod.default()); return tree },
    input(id, value) { flat(tree).find(n => n.type === 'Input' || n.type === 'Textarea' ? n.props.id === id : false).props.onChange({ target: { value } }); h.render() },
    get tree() { return tree },
  }
  h.render(); return h
}
let cases = 0
// Actual old loading branch removed every public content descendant.
{
  const h = pageHarness(baseline); h.auth.isLoading = true; h.render()
  assert.equal(flat(h.tree).filter(n => n.type === 'Tabs').length, 0); assert.match(text(h.tree), /Loading Help/); cases++
}
for (const user of [null, { id: 'local-user', email: 'local@example.invalid' }]) {
  const h = pageHarness(); h.auth.user = user; h.render()
  const tabs = () => flat(h.tree).find(n => n.type === 'Tabs')
  const search = () => flat(h.tree).find(n => n.type === 'Input' && n.props['aria-label'] === 'Search FAQ')
  assert.equal(flat(h.tree).filter(n => n.props['data-studio-help-part'] === 'faq-item').length, 24)
  search().props.onChange({ target: { value: 'attachments' } }); h.render()
  assert.equal(flat(h.tree).filter(n => n.props['data-studio-help-part'] === 'faq-item').length, 1)
  tabs().props.onValueChange('contact'); h.render()
  let draft = flat(h.tree).find(n => n.type === 'StudioSupportDraft')
  draft.props.onSubjectChange('Keep this draft'); draft.props.onMessageChange('Auth refresh must retain this'); h.render()
  const childPath = h.tree.props.children.type
  for (const loading of [true, false, true, false]) {
    h.auth.isLoading = loading; h.render()
    assert.equal(h.tree.type, 'StudioHelpFrame'); assert.equal(h.tree.props.children.type, childPath)
    assert.equal(h.tree.props.accountLoading, loading); assert.equal(h.tree.props.signedIn, Boolean(user))
    assert.equal(tabs().props.value, 'contact'); assert.equal(search().props.value, 'attachments')
    draft = flat(h.tree).find(n => n.type === 'StudioSupportDraft')
    assert.equal(draft.props.subject, 'Keep this draft'); assert.equal(draft.props.message, 'Auth refresh must retain this')
    assert.equal(flat(h.tree).filter(n => n.type === 'form').length, 0)
  }
  tabs().props.onValueChange('faq'); h.render()
  flat(h.tree).find(n => n.type === 'button' && text(n) === 'Clear filters').props.onClick(); h.render()
  assert.equal(flat(h.tree).filter(n => n.props['data-studio-help-part'] === 'faq-item').length, 24)
  cases++
}
for (const flag of [undefined, 'false', 'TRUE', '1']) {
  const current = pageHarness(pageSource, flag), prior = pageHarness(baseline, flag)
  current.auth.isLoading = prior.auth.isLoading = true; current.render(); prior.render()
  assert.equal(JSON.stringify(current.tree), JSON.stringify(prior.tree), 'classic loading tree is exact')
  current.auth.isLoading = false; current.render()
  current.input('subject', 'Classic draft & details'); current.input('message', 'Authored message\nSecond line')
  let prevented = false; flat(current.tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() { prevented = true } }); current.render()
  assert.equal(prevented, true)
  assert.equal(flat(current.tree).find(n => n.props.id === 'subject').props.value, 'Classic draft & details')
  assert.equal(flat(current.tree).find(n => n.props.id === 'message').props.value, 'Authored message\nSecond line')
  assert.match(text(current.tree), /This page has not sent a message/); assert.doesNotMatch(text(current.tree), /Your message has been sent|Sending\.\.\./)
  const link = flat(current.tree).find(n => n.type === 'a' && text(n) === 'Open email draft')
  assert.equal(link.props.href, helpers.supportEmailDraftHref('Classic draft & details', 'Authored message\nSecond line'))
  assert.ok(flat(current.tree).find(n => n.type === 'Textarea' && n.props.readOnly))
  cases++
}
for (const state of [{ signedIn: false }, { signedIn: true }, { signedIn: false, accountLoading: true }, { signedIn: true, accountLoading: true }]) {
  const child = { type: 'retained-public-content', props: {} }, tree = helpers.StudioHelpFrame({ ...state, children: child })
  assert.equal(flat(tree).find(n => n.type === 'main').props.children, child)
  assert.equal(flat(tree).some(n => n.type === 'StudioRail'), state.signedIn)
  if (state.accountLoading) assert.match(text(tree), /Loading account/)
  else if (!state.signedIn) assert.equal(flat(tree).find(n => n.type === 'Link').props.href, '/auth/signin')
  cases++
}
for (const outcome of ['success', 'failure', 'missing']) {
  const h = supportHarness(); if (outcome === 'failure') h.api.write = async () => { throw new Error('Local clipboard refusal') }; if (outcome === 'missing') h.context.navigator.clipboard.writeText = undefined
  assert.equal(h.calls.length, 0); const original = h.props
  const link = flat(h.tree).find(n => n.props['data-studio-help-part'] === 'email-draft')
  const url = new URL(link.props.href)
  assert.equal(url.protocol, 'mailto:'); assert.equal(url.pathname, 'support@deckster.xyz'); assert.equal(url.searchParams.get('subject'), original.subject); assert.equal(url.searchParams.get('body'), original.message)
  await h.copy(); h.render(); assert.equal(h.props.subject, original.subject); assert.equal(h.props.message, original.message)
  const manual = flat(h.tree).find(n => n.type === 'Textarea' && n.props.readOnly)
  assert.equal(manual.props.value, helpers.supportEmailDraftText(original.subject, original.message))
  let selected = false; manual.props.onFocus({ currentTarget: { select() { selected = true } } }); assert.equal(selected, true)
  if (outcome === 'success') assert.match(text(h.tree), /Draft copied.*review before sending/)
  else { assert.match(text(h.tree), /Copy was unavailable/); assert.equal(flat(h.tree).find(n => n.type === 'details').props.open, true) }
  assert.equal(h.calls.length, outcome === 'missing' ? 0 : 1); cases++
}
for (const retirement of ['change', 'unmount', 'replay']) {
  const h = supportHarness(), d = deferred(); h.api.write = () => d.promise
  const captured = h.copyHandler, task = captured(); await captured(); assert.equal(h.calls.length, 1)
  if (retirement === 'change') h.render({ ...h.props, message: 'New unsent message' })
  else { h.retire(); if (retirement === 'replay') h.replay() }
  const writes = h.writes; d.resolve(); await task
  if (retirement === 'change') { h.render(); assert.doesNotMatch(text(h.tree), /Draft copied/); assert.equal(h.props.message, 'New unsent message') }
  else assert.equal(h.writes, writes)
  cases++
}
// Retrying local clipboard refusal is deliberate; editing invalidates both old
// receipt text and captured callbacks before a new intentional copy.
{
  const h = supportHarness()
  h.api.write = async () => { throw new Error('Refused') }
  await h.copy(); h.render(); assert.match(text(h.tree), /Copy was unavailable/)
  h.api.write = async () => {}
  await h.copy(); h.render(); assert.match(text(h.tree), /Draft copied/)
  const stale = h.copyHandler, count = h.calls.length
  h.render({ ...h.props, subject: 'Replacement draft' })
  assert.doesNotMatch(text(h.tree), /Draft copied|Copy was unavailable/)
  await stale(); assert.equal(h.calls.length, count)
  await h.copy(); h.render(); assert.equal(h.calls.length, count + 1)
  assert.match(h.calls.at(-1), /Subject: Replacement draft/); cases++
}
{
  assert.equal(helpers.supportEmailDraftHref('', ''), 'mailto:support@deckster.xyz?subject=Deckster%20support&body=')
  assert.equal(helpers.supportEmailDraftText('', ''), 'To: support@deckster.xyz\nSubject: Deckster support\n\n'); cases++
}
{
  const h = pageHarness()
  for (const [label, value] of [['Getting started', 'guides'], ['Contact support', 'contact'], ['Find an answer', 'faq']]) {
    flat(h.tree).find(n => n.type === 'button' && text(n).startsWith(label)).props.onClick(); h.render()
    assert.equal(flat(h.tree).find(n => n.type === 'Tabs').props.value, value)
  }
  flat(h.tree).find(n => n.type === 'Button' && text(n) === 'Troubleshooting').props.onClick(); h.render()
  assert.equal(flat(h.tree).filter(n => n.props['data-studio-help-part'] === 'faq-item').length, 5)
  assert.equal(flat(h.tree).find(n => n.type === 'Button' && text(n) === 'Troubleshooting').props['aria-pressed'], true)
  assert.equal(flat(h.tree).find(n => n.type === 'Link' && n.props.href === '/builder').props.href, '/builder'); cases++
}
// Exact FAQ/filter/guide/access material remains; only classic contact truth and
// Studio loading continuity intentionally differ from this pinned Help source.
const ast = code => ts.createSourceFile('help.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const find = (node, predicate) => { if (predicate(node)) return node; let found; ts.forEachChild(node, n => { if (!found) found = find(n, predicate) }); return found }
const currentAst = ast(pageSource), oldAst = ast(baseline), printer = ts.createPrinter({ removeComments: true })
for (const [label, predicate] of [
  ...['faqItems', 'filteredFAQ', 'categories'].map(name => [name, n => ts.isVariableDeclaration(n) && n.name.getText() === name]),
  ...['email', 'subject', 'message'].map(id => [id + ' original field', n => ts.isJsxSelfClosingElement(n) && n.attributes.properties.some(a => a.name?.getText() === 'id' && a.initializer?.getText() === JSON.stringify(id))]),
  ['complete guide', n => ts.isJsxElement(n) && n.openingElement.tagName.getText() === 'TabsContent' && n.openingElement.attributes.properties.some(a => a.name?.getText() === 'value' && a.initializer?.getText() === '"guides"')],
  ['FAQ content/options', n => ts.isJsxElement(n) && n.openingElement.tagName.getText() === 'TabsContent' && n.openingElement.attributes.properties.some(a => a.name?.getText() === 'value' && a.initializer?.getText() === '"faq"')],
]) {
  const current = find(currentAst, predicate), old = find(oldAst, predicate); assert.ok(current && old, label)
  assert.equal(printer.printNode(ts.EmitHint.Unspecified, current, currentAst), printer.printNode(ts.EmitHint.Unspecified, old, oldAst), label)
}
assert.doesNotMatch(pageSource, /setTimeout|setShowSuccess|setIsSubmitting|window\.location|TODO: Implement actual support/)
assert.equal(read('app/help/layout.tsx'), readAtlasBaseline(`${checkpoint}:app/help/layout.tsx`))
postcss.parse(read('components/help/studio-help.css'))
console.log(`Atlas Help recovery: ${cases} actual-page/leaf offline cases passed; public loading continuity, exact FAQ/guides/classic loading, deliberate unsent classic draft and clipboard/manual recovery; no email/network/timer/system clipboard/visual acceptance.`)
