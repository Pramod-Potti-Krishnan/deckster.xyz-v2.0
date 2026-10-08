import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'

const path = 'components/builder/composer-library-dialog.tsx'
const source = fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const original = execFileSync('git', ['show', `49053ce:${path}`], { encoding: 'utf8' })
const css = fs.readFileSync(new URL('../components/builder/studio-composer-library.css', import.meta.url), 'utf8')
postcss.parse(css)
// BASE-J5 (long brief): the import-free helper is loaded for real; the generic @/lib/ Proxy below would return its names.
const longBriefHelper = (() => {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../lib/composer-long-brief.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { module, exports: module.exports })
  return module.exports
})()
// Pin the reviewed pre-adaptation source: native attributes/wrapper are the only change.
const start = source.indexOf('  const body = <>\n'), end = source.indexOf('  </>\n\n  return (', start)
assert(start > 0 && end > start)
const body = source.slice(start + '  const body = <>\n'.length, end)
let restored = source.slice(0, start) + source.slice(end + '  </>\n\n'.length)
restored = restored.replace(/        \{studioShell \? <div data-studio-composer-body="true" tabIndex=\{0\} role="region" aria-label="Template upload and library">\{body\}<\/div> : body\}\n/, body)
restored = restored.replace(/ (?:data-studio-composer[\w-]*|tabIndex|aria-label|role)=\{studioShell \? [^}]+ : undefined\}/g, '')
restored = restored.replace("import './studio-composer-library.css'\n", '').replace("  const studioShell = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'\n", '')
// BASE-J5 (long brief): the flag-gated limit is the only other change to the reviewed classic source.
for (const [addition, classic] of [
  ["import { composerBriefLengthValid, composerBriefLimitMessage, composerBriefMax } from '@/lib/composer-long-brief'\n", ''],
  ["  const longBriefEnabled = process.env.NEXT_PUBLIC_COMPOSER_LONG_BRIEF_ENABLED === 'true'\n", ''],
  ['!composerBriefLengthValid(brief, longBriefEnabled)', '(brief.trim().length < 20 || brief.trim().length > 4000)'],
  ['setError(composerBriefLimitMessage(longBriefEnabled))', "setError('Describe the new presentation in 20 to 4,000 characters.')"],
  ['maxLength={composerBriefMax(longBriefEnabled)}', 'maxLength={4000}'],
]) { assert(restored.includes(addition), addition); restored = restored.replace(addition, classic) }
assert.equal(restored, original, 'Every original handler/effect/payload/condition/default/copy and classic markup must remain exact')

let actions = 0
const node = (type, props) => ({ type, props: props || {} })
const templates = [
  { id: 'supplied-one', name: 'A very long supplied template name with no fabricated readiness or design claims '.repeat(5), slide_count: 4, stage_template_summary: { slide_count: 6 } },
  { id: 'supplied-two', name: 'Legacy slide count', slide_count: 8 },
  { id: 'supplied-three', name: 'No supplied count' },
]
function runtime(text, flag, topicFlag, auth, initial) {
  const state = [...initial], effects = [], exports = {}; let cursor = 0
  vm.runInNewContext(ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, module: { exports }, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag, NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: topicFlag } },
    require(id) {
      if (id === 'react') return {
        useState(init) { const i = cursor++; if (!(i in state)) state[i] = typeof init === 'function' ? init() : init; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }] },
        useRef(value) { return { current: value } }, useCallback(fn) { return fn }, useEffect(fn, deps) { effects.push({ fn, deps }) },
      }
      if (id === 'react/jsx-runtime') return { jsx: node, jsxs: node, Fragment: 'Fragment' }
      if (id === '@/hooks/use-auth') return { useAuth: () => ({ user: auth ? { id: 'local-owner' } : null }) }
      if (id === '@/hooks/use-chat-sessions') return { useChatSessions: () => ({ createSession() { actions++; throw new Error('No session creation allowed') } }) }
      if (id === '@/lib/composer-library') return {
        validateComposerFile(file) { return !file.name.toLowerCase().endsWith('.pptx') ? 'Choose a PowerPoint .pptx file.' : !file.size ? 'The presentation is empty.' : file.size > 100 * 1024 * 1024 ? 'The presentation must be 100 MB or smaller.' : null },
        composerRequest() { actions++; throw new Error('No service allowed') }, waitForComposerJob() { actions++; throw new Error('No jobs allowed') },
        requireComposerServiceUrl() { actions++; throw new Error('No service configuration allowed') },
      }
      if (id === '@/lib/composer-long-brief') return longBriefHelper
      if (id === '@/lib/utils') return { cn: (...args) => args.filter(Boolean).join(' ') }
      if (id.endsWith('.css')) return {}
      if (id.startsWith('@/components/') || id.startsWith('@/lib/') || id === 'lucide-react') return new Proxy({}, { get: (_target, key) => key })
      throw new Error(`Unexpected dependency ${id}`)
    },
    fetch() { actions++; throw new Error('No fetch allowed') }, console,
  })
  return { effects, render(props) { cursor = 0; effects.length = 0; return exports.ComposerLibraryDialog(props) } }
}
function all(tree, predicate, found = []) {
  if (!tree || typeof tree !== 'object') return found
  if (Array.isArray(tree)) { tree.forEach(value => all(value, predicate, found)); return found }
  if (predicate(tree)) found.push(tree)
  all(tree.props.children, predicate, found)
  return found
}
function visible(tree) { return tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : Array.isArray(tree) ? tree.map(visible).join(' ') : visible(tree.props.children) }
function canonical(tree) {
  if (tree == null || typeof tree === 'boolean') return []
  if (typeof tree !== 'object') return [String(tree)]
  if (Array.isArray(tree)) return tree.flatMap(canonical)
  if (tree.type === 'Fragment') return canonical(tree.props.children)
  const props = Object.fromEntries(Object.entries(tree.props).filter(([key, value]) => key !== 'children' && value !== undefined).map(([key, value]) => [key, typeof value === 'function' ? value.toString().replace(/\s+/g, ' ') : value]))
  return [{ type: tree.type, props, children: canonical(tree.props.children) }]
}
const find = (tree, predicate) => { const matches = all(tree, predicate); assert.equal(matches.length, 1); return matches[0] }
let cases = 0
for (const flag of ['true', 'false', undefined, '1']) for (const topic of ['true', 'false']) for (const auth of [true, false]) for (const busy of [true, false]) {
  const initial = [templates, false, busy, 'Supplied preparing status', 'Complete supplied failed-read detail '.repeat(30), { name: 'valid.pptx', size: 1024 }, 'A meaningful local presentation brief', 'supplied-one']
  const run = runtime(source, flag, topic, auth, initial), tree = run.render({ open: true, onOpenChange() {} })
  assert.equal(run.effects.length, 1)
  assert.equal(all(tree, item => item.type === 'Button' && visible(item) === 'Use original').length, 3)
  assert.equal(all(tree, item => item.type === 'Button' && visible(item) === 'New topic').length, topic === 'true' ? 3 : 0)
  assert(visible(tree).includes(templates[0].name)); const readable = visible(tree).replace(/\s+/g, ' '); assert(readable.includes('6 slides')); assert(readable.includes('8 slides')); assert(readable.includes('0 slides'))
  for (const button of all(tree, item => item.type === 'Button' && ['Use original', 'New topic'].includes(visible(item)))) assert.equal(button.props.disabled, busy || !auth)
  assert.equal(find(tree, item => item.props.id === 'composer-template-file').props.disabled, busy || !auth)
  if (flag === 'true') {
    assert.equal(find(tree, item => item.props['data-studio-composer-body']).props.tabIndex, 0)
    assert.equal(find(tree, item => item.props['data-studio-composer-error']).props.tabIndex, 0)
    assert.equal(find(tree, item => item.props['data-studio-composer-progress']).props.tabIndex, 0)
    assert.equal(all(tree, item => item.props['data-studio-composer-record']).length, 3)
  } else {
    const before = runtime(original, flag, topic, auth, initial).render({ open: true, onOpenChange() {} })
    assert.equal(JSON.stringify(canonical(tree)), JSON.stringify(canonical(before)), 'Classic trees/callbacks are exact with the fragment flattened')
  }
  let closed = 0
  const closeTree = run.render({ open: true, onOpenChange() { closed++ } })
  closeTree.props.onOpenChange(false); assert.equal(closed, busy ? 0 : 1)
  cases++
}
for (const loading of [true, false]) {
  const tree = runtime(source, 'true', 'false', true, [[], loading, false, null, null, null, '', null]).render({ open: true, onOpenChange() {} })
  assert(visible(tree).includes(loading ? 'Loading templates…' : 'Your uploaded templates will appear here.'))
  assert.equal(all(tree, item => item.props['data-studio-composer-topic']).length, 0)
}
const local = runtime(source, 'true', 'true', true, [templates, false, false, null, null, null, '', null])
let tree = local.render({ open: true, onOpenChange() {} })
find(tree, item => item.props['data-studio-composer-record'] === 'supplied-one').props.children[0].props.children[1].props.children[1].props.onClick()
tree = local.render({ open: true, onOpenChange() {} })
const brief = find(tree, item => item.props.id === 'composer-new-brief'); assert.equal(brief.props.maxLength, 4000)
brief.props.onChange({ target: { value: 'Local unsent brief retained in the native field' } }); tree = local.render({ open: true, onOpenChange() {} })
assert.equal(find(tree, item => item.props.id === 'composer-new-brief').props.value, 'Local unsent brief retained in the native field')
assert.equal(find(tree, item => item.props['data-studio-composer-action'] === 'create').props.disabled, false)
assert.equal(actions, 0)
console.log(`Composer native ${cases} flag/topic/auth/busy states, exact source/classic parity, full names/count fallbacks, close guards, loading/empty and local new-topic draft passed; zero services/uploads/use/jobs/actions.`)
