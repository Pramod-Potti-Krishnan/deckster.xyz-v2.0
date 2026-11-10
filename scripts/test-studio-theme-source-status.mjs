import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'

const path = 'components/generation-panel/shared/theme-source-selector.tsx'
const source = fs.readFileSync(path, 'utf8')
const original = execFileSync('git', ['show', `4b806404:${path}`], { encoding: 'utf8' })
const restored = source.replace("import './studio-theme-source-status.css'\n", '')
  .replace('palette, loading: deckThemeLoading, error: deckThemeError', 'palette')
  .replace('listThemes, loading: savedThemesLoading, error: savedThemesError', 'listThemes')
  .replace(/      \{STUDIO_GENERATION_CONTEXT && \([\s\S]*?      \)\}\n(?=      \{anotherThemeEnabled && mappedProfiles)/, '')
assert.equal(restored, original, 'Original theme reads, cancellation, mapping, options, gates and callbacks stay exact')
const css = fs.readFileSync('components/generation-panel/shared/studio-theme-source-status.css', 'utf8')
postcss.parse(css)
assert(css.includes('max-height: 96px')); assert(css.includes('overflow-wrap: anywhere'))
assert(css.includes(':focus-visible')); assert(css.includes('overscroll-behavior: contain'))
let requests = 0, cases = 0
const node = (type, props) => ({ type, props: props || {} })
function setup(text, flag, anotherTheme, deck, saved, profiles = []) {
  const exports = {}, states = [], effects = [], changes = []; let cursor = 0
  vm.runInNewContext(ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, module: { exports }, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } },
    require(id) {
      if (id.endsWith('.css')) return {}
      if (id === 'react') return {
        useMemo(fn) { return fn() }, useEffect(fn, deps) { effects.push({ fn, deps }) },
        useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value }] },
      }
      if (id === 'react/jsx-runtime') return { jsx: node, jsxs: node, Fragment: 'Fragment' }
      if (id === 'lucide-react') return { Palette: 'Palette' }
      if (id === '@/lib/config') return { features: { enableElementAnotherTheme: anotherTheme } }
      if (id === '@/hooks/use-deck-theme-palette') return { useDeckThemePalette: () => deck }
      if (id === '@/hooks/use-theme-profiles') return { useThemeProfiles: () => ({ ...saved, listThemes: async () => { requests++; return { themes: profiles, count: profiles.length } } }) }
      throw new Error(`Unexpected dependency ${id}`)
    },
    fetch() { throw new Error('No connected request permitted') },
  })
  return { effects, changes, render(presentationId = 'owned-deck', mode = 'deck') { cursor = 0; effects.length = 0; return exports.ThemeSourceSelector({ presentationId, value: { mode, overrides: null }, onChange: selection => changes.push(selection) }) } }
}
function all(tree, predicate, results = []) {
  if (!tree || typeof tree !== 'object') return results
  if (Array.isArray(tree)) { tree.forEach(value => all(value, predicate, results)); return results }
  if (predicate(tree)) results.push(tree)
  all(tree.props.children, predicate, results); return results
}
function canonical(tree) {
  if (tree == null || typeof tree === 'boolean') return []
  if (typeof tree !== 'object') return [String(tree)]
  if (Array.isArray(tree)) return tree.flatMap(canonical)
  if (tree.type === 'Fragment') return canonical(tree.props.children)
  return [{ type: typeof tree.type === 'function' ? tree.type.name : tree.type, props: Object.fromEntries(Object.entries(tree.props).filter(([key, value]) => key !== 'children' && value !== undefined).map(([key, value]) => [key, typeof value === 'function' ? value.toString().replace(/\s+/g, ' ') : value])), children: canonical(tree.props.children) }]
}
const longError = `HTTP 503\n${'Exact supplied native diagnostic '.repeat(150)}[ERROR END]`
for (const flag of ['true', 'false', undefined, '1']) for (const enabled of [false, true]) for (const state of ['idle', 'loading', 'error']) for (const id of [null, 'owned-deck']) {
  const deck = { palette: null, loading: state === 'loading', error: state === 'error' ? longError : null }
  const saved = { loading: state === 'loading', error: state === 'error' ? new Error(`list failed: ${longError}`) : null }
  const run = setup(source, flag, enabled, deck, saved), tree = run.render(id)
  const markers = all(tree, item => item.props['data-studio-theme-source-status'])
  const expected = flag === 'true' && state !== 'idle' ? Number(Boolean(id)) + Number(enabled) : 0
  assert.equal(markers.length, expected)
  assert.equal(run.effects.length, 1, 'No new effects/read cadence')
  const deckButton = all(tree, item => item.type === 'button' && item.props.children === 'Deck theme')[0]
  assert.equal(deckButton.props.disabled, !id)
  if (flag !== 'true') assert.equal(JSON.stringify(canonical(tree)), JSON.stringify(canonical(setup(original, flag, enabled, deck, saved).render(id))), 'Classic markup/props stay exact')
  for (const status of markers) {
    if (state === 'loading') assert.equal(status.props.role, 'status')
    else {
      assert.equal(status.type, 'details'); assert.equal(status.props.open, undefined, 'Errors start compact and closed')
      const region = all(status, item => item.props['data-studio-theme-source-error'])[0]
      assert.equal(region.props.role, 'region'); assert.equal(region.props.tabIndex, 0)
      assert.equal(region.props.children.props.children, status.props['data-studio-theme-source-status'] === 'deck-error' ? longError : `list failed: ${longError}`, 'Full exact error remains readable')
    }
  }
  if (!enabled) assert(!markers.some(item => item.props['data-studio-theme-source-status'].startsWith('saved-')))
  cases++
}
for (const enabled of [false, true]) {
  const theme = { id: 'saved-real', name: 'Full saved theme name', theme_payload: { primary_hex: '#223344' } }
  const run = setup(source, 'true', enabled, { palette: null, loading: false, error: null }, { loading: false, error: null }, [theme])
  run.render(); const before = requests
  const cleanup = run.effects[0].fn(); await Promise.resolve(); await Promise.resolve()
  assert.equal(requests - before, enabled ? 1 : 0, 'Feature gate retains original single list read')
  const tree = run.render(); const selectors = all(tree, item => item.type === 'select')
  assert.equal(selectors.length, enabled ? 1 : 0)
  if (enabled) {
    selectors[0].props.onChange({ target: { value: theme.id } })
    assert.equal(run.changes.length, 1); assert.equal(run.changes[0].mode, 'another'); assert.equal(run.changes[0].overrides.primary, '#223344')
    cleanup()
  }
  cases++
}
console.log(`PASS ${cases} theme-source read/gate/classic cases; zero connected requests, one local mocked list read`)
