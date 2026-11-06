// R10: Add Element table panel, the manual "Rows" control reads "Data rows" with a header hint, behind
// NEXT_PUBLIC_TABLE_DATA_ROWS_LABEL_ENABLED. Offline: the real form is rendered with react-dom/server (markup) and driven
// through a small hooks runtime (request values); no network, no git.
// Flag-off identity is a digest over the form's rendered HTML in 12 states, frozen from the base
// (studio-v4-dev-preparation-code @ 922ce14) before this change. The change is also run against 15 mutants of the form.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const FLAG = 'NEXT_PUBLIC_TABLE_DATA_ROWS_LABEL_ENABLED'
const BASE_FORM_DIGEST = 'aec94e84808375b6edcb699f6904567515d096d1a22b1e05124585c05fa8dc42'
const FORM = 'components/generation-panel/forms/table-form.tsx'
const root = new URL('../', import.meta.url)
const hostRequire = createRequire(import.meta.url)
const { renderToStaticMarkup } = hostRequire('react-dom/server')
const React = hostRequire('react')
const jsxRuntime = hostRequire('react/jsx-runtime')

function read(relative) { return fs.readFileSync(new URL(relative, root), 'utf8') }
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

// ---- module loader: real sources, transpiled, with react and one heavy child stubbed ------------------------------------
const SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']
function resolveFile(from, id) {
  const base = id.startsWith('@/') ? new URL(id.slice(2), root) : new URL(id, from)
  for (const suffix of SUFFIXES) {
    const url = new URL(base.href + suffix)
    if (fs.existsSync(url) && fs.statSync(url).isFile()) return url
  }
  throw new Error(`Cannot resolve ${id}`)
}
function makeLoader({ env, react, jsx, sources = {} }) {
  const cache = new Map()
  const themeSelectorStub = { ThemeSourceSelector: () => React.createElement('div', { 'data-stub': 'theme-source-selector' }) }
  function load(url) {
    if (cache.has(url.href)) return cache.get(url.href).exports
    const relative = url.href.slice(root.href.length)
    const text = sources[relative] ?? fs.readFileSync(url, 'utf8')
    const output = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
    const module = { exports: {} }
    cache.set(url.href, module)
    vm.runInNewContext(output, { module, exports: module.exports, process: { env }, console, require: id => req(url, id) })
    return module.exports
  }
  function req(from, id) {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return jsx
    if (id === 'lucide-react') return hostRequire('lucide-react')
    if (id.endsWith('.css')) return {}
    if (id.startsWith('.') || id.startsWith('@/')) {
      const url = resolveFile(from, id)
      if (url.href.endsWith('/components/generation-panel/shared/theme-source-selector.tsx')) return themeSelectorStub
      return load(url)
    }
    throw new Error(`Unexpected dependency ${id}`)
  }
  return { form: () => load(new URL(FORM, root)).TableForm }
}

// ---- 1. rendered markup (real React) ------------------------------------------------------------------------------------
const noop = () => {}
const manualDraft = (rows, columns) => ({ formData: { componentType: 'TABLE', tableConfig: { structure_mode: 'MANUAL', rows, columns } } })
const STATES = [
  { name: 'manual 5x4', draft: manualDraft(5, 4) },
  { name: 'manual 10x6', draft: manualDraft(10, 6) },
  { name: 'auto', draft: null },
]
function html(source, flagValue, { draft, advanced, studio }) {
  const env = {
    ...(flagValue === undefined ? {} : { [FLAG]: flagValue }),
    ...(studio ? { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' } : {}),
  }
  const TableForm = makeLoader({ env, react: React, jsx: jsxRuntime, sources: { [FORM]: source } }).form()
  return renderToStaticMarkup(React.createElement(TableForm, {
    onSubmit: noop, registerSubmit: noop, isGenerating: false, prompt: 'Quarterly results', showAdvanced: advanced,
    registerMandatoryConfig: noop, initialDraft: draft,
  }))
}
function allStates(source, flagValue) {
  const out = []
  for (const state of STATES) for (const advanced of [false, true]) for (const studio of [false, true]) {
    out.push({ name: `${state.name}${advanced ? ' advanced' : ''}${studio ? ' studio' : ''}`, html: html(source, flagValue, { draft: state.draft, advanced, studio }) })
  }
  return out
}

// ---- 2. request values (a small hooks runtime over the same source) ---------------------------------------------------
const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
function mountForm(source, flagValue, props) {
  const hooks = []
  let cursor = 0, dirty = false, effects = []
  const runtime = {
    useState(init) {
      const i = cursor++
      if (hooks[i] === undefined) hooks[i] = { value: typeof init === 'function' ? init() : init }
      const slot = hooks[i]
      return [slot.value, next => { const value = typeof next === 'function' ? next(slot.value) : next; if (!Object.is(value, slot.value)) { slot.value = value; dirty = true } }]
    },
    useMemo(fn, deps) {
      const i = cursor++
      if (hooks[i] === undefined || !same(hooks[i].deps, deps)) hooks[i] = { value: fn(), deps }
      return hooks[i].value
    },
    useCallback(fn, deps) {
      const i = cursor++
      if (hooks[i] === undefined || !same(hooks[i].deps, deps)) hooks[i] = { value: fn, deps }
      return hooks[i].value
    },
    useEffect(fn, deps) {
      const i = cursor++
      if (hooks[i] === undefined || !same(hooks[i].deps, deps)) { hooks[i] = { deps }; effects.push(fn) }
    },
    useRef(value) { const i = cursor++; if (hooks[i] === undefined) hooks[i] = { value: { current: value } }; return hooks[i].value },
  }
  const node = (type, nodeProps) => ({ type, props: nodeProps || {} })
  const TableForm = makeLoader({ env: flagValue === undefined ? {} : { [FLAG]: flagValue }, react: runtime, jsx: { jsx: node, jsxs: node, Fragment: 'Fragment' }, sources: { [FORM]: source } }).form()
  let tree
  const settle = () => {
    for (let turn = 0; turn < 50; turn++) {
      cursor = 0; dirty = false; effects = []
      tree = TableForm(props)
      for (const effect of effects) effect()
      if (!dirty) return tree
    }
    throw new Error('The form never settled')
  }
  settle()
  return { tree: () => tree, settle }
}
function find(tree, predicate, found = []) {
  if (!tree || typeof tree !== 'object') return found
  if (Array.isArray(tree)) { tree.forEach(value => find(value, predicate, found)); return found }
  if (predicate(tree)) found.push(tree)
  find(tree.props.children, predicate, found)
  return found
}
const text = tree => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : Array.isArray(tree) ? tree.map(text).join('') : text(tree.props.children)

function submitFor(source, flagValue, pick) {
  const submitted = []
  let submit = noop
  const mounted = mountForm(source, flagValue, {
    onSubmit: data => submitted.push(data), registerSubmit: fn => { submit = fn }, isGenerating: false, prompt: 'Quarterly results',
    showAdvanced: true, registerMandatoryConfig: noop,
  })
  const manual = find(mounted.tree(), item => item.type === 'button' && text(item) === 'Manual')[0]
  manual.props.onClick()
  mounted.settle()
  const select = find(mounted.tree(), item => item.type === 'select' && /^Manual table (data )?rows$/.test(item.props['aria-label']))[0]
  const options = find(select, item => item.type === 'option').map(item => text(item))
  const selectedBefore = select.props.value
  if (pick !== undefined) {
    select.props.onChange({ target: { value: String(pick) } })
    mounted.settle()
  }
  const status = find(mounted.tree(), item => item.props['data-testid'] === 'table-structure-status').map(text)[0]
  const selectedAfter = find(mounted.tree(), item => item.type === 'select' && /^Manual table (data )?rows$/.test(item.props['aria-label']))[0].props.value
  submit()
  return { data: submitted[0], options, status, selectedBefore, selectedAfter }
}

// ---- 3. everything the test asserts about one version of the form source ----------------------------------------------
function verify(source) {
  // flag off, in every spelling that is not the literal "true": the base's markup, state for state
  let offDigest
  let offStates
  for (const value of [undefined, 'false', '', '1', 'TRUE', ' true', 'yes']) {
    const states = allStates(source, value)
    offDigest ??= digest(states.map(state => state.html))
    offStates ??= states
    check(assert.equal, digest(states.map(state => state.html)), offDigest, `flag ${JSON.stringify(value)} must render exactly as flag unset`)
  }
  check(assert.equal, offStates.length, 12)
  check(assert.equal, offDigest, BASE_FORM_DIGEST, 'flag-off markup must equal the base')

  // flag on: Manual shows "Data rows" + the hint, nothing else moves; Auto is untouched
  const onStates = allStates(source, 'true')
  check(assert.equal, onStates.length, offStates.length)
  onStates.forEach((on, index) => {
    const off = offStates[index]
    check(assert.equal, on.name, off.name)
    if (on.name.startsWith('auto')) {
      check(assert.equal, on.html, off.html, `${on.name}: no manual controls, so nothing changes`)
      return
    }
    check(assert.notEqual, on.html, off.html)
    check(assert.equal, on.html.includes('>Data rows<select aria-label="Manual table data rows" aria-describedby="table-data-rows-hint"'), true, `${on.name}: label, aria-label and description`)
    check(assert.equal, on.html.split('id="table-data-rows-hint"').length - 1, 1, `${on.name}: exactly one hint`)
    check(assert.equal, on.html.split('The header row is added on top.').length - 1, 1)
    check(assert.equal, /<p id="table-data-rows-hint" class="[^"]*">The header row is added on top\.<\/p>/.test(on.html), true)
    check(assert.equal, on.html.includes('>Rows<'), false, `${on.name}: the old label is gone`)
    check(assert.equal, on.html.includes('aria-label="Manual table rows"'), false)
    // Undoing exactly the three additions gives the flag-off markup byte for byte.
    const undone = on.html
      .replace('>Data rows<select aria-label="Manual table data rows" aria-describedby="table-data-rows-hint"', '>Rows<select aria-label="Manual table rows"')
      .replace(/<p id="table-data-rows-hint" class="[^"]*">The header row is added on top\.<\/p>/, '')
    check(assert.equal, undone, off.html, `${on.name}: only the label, the aria-label and the hint differ`)
    // The select and its ten options are the same (value, options, order).
    const select = html => html.match(/<select aria-label="Manual table (?:data )?rows"[^>]*>(.*?)<\/select>/)[1]
    check(assert.equal, select(on.html), select(off.html))
    check(assert.equal, (select(on.html).match(/<option/g) || []).length, 10)
    // the status line is unchanged
    check(assert.equal, /Manual · \d+ rows × \d+ columns/.test(on.html), true)
  })

  // the request: the number the user picks is the number sent, flag on or off; the whole payload is equal
  const defaults = submitFor(source, undefined, undefined)
  check(assert.equal, defaults.status, 'Manual · 5 rows × 4 columns')
  check(assert.equal, JSON.stringify(defaults.options), JSON.stringify(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']))
  check(assert.equal, defaults.data.tableConfig.rows, 5)
  for (const pick of [1, 2, 5, 7, 10]) {
    const off = submitFor(source, undefined, pick)
    const on = submitFor(source, 'true', pick)
    check(assert.equal, off.data.tableConfig.rows, pick, `flag off: ${pick} data rows sent`)
    check(assert.equal, on.data.tableConfig.rows, pick, `flag on: ${pick} data rows sent`)
    check(assert.equal, on.data.tableConfig.columns, 4)
    check(assert.equal, on.data.tableConfig.structure_mode, 'MANUAL')
    check(assert.equal, JSON.stringify(on.data), JSON.stringify(off.data), `flag on and off send the same payload for ${pick}`)
    check(assert.equal, JSON.stringify(on.options), JSON.stringify(off.options))
    check(assert.equal, on.status, `Manual · ${pick} rows × 4 columns`)
    check(assert.equal, on.selectedAfter, pick, 'the picker shows what was picked')
  }

  // the flag is read once, as the literal "true"
  check(assert.equal, source.split(`process.env.${FLAG} === 'true'`).length - 1, 1, 'the form reads the flag once as the literal "true"')
  check(assert.equal, source.split(`process.env.${FLAG}`).length - 1, 1)
  return offDigest
}

const formSource = read(FORM)
const offDigest = verify(formSource)
console.log(`flag-off form digest: ${offDigest} (12 states x 7 flag spellings)`)

// ---- 4. mutants: each must be caught ------------------------------------------------------------------------------------
const HINT_LINE = '            {TABLE_DATA_ROWS_LABEL && <p id="table-data-rows-hint" className="col-span-2 text-[10px] leading-4 text-slate-500 dark:text-slate-400">The header row is added on top.</p>}'
const MUTANTS = [
  ['label stays "Rows" with the flag on', "TABLE_DATA_ROWS_LABEL ? 'Data rows' : 'Rows'", "TABLE_DATA_ROWS_LABEL ? 'Rows' : 'Rows'"],
  ['aria-label stays old with the flag on', "TABLE_DATA_ROWS_LABEL ? 'Manual table data rows' : 'Manual table rows'", "TABLE_DATA_ROWS_LABEL ? 'Manual table rows' : 'Manual table rows'"],
  ['label renamed with the flag off too', "TABLE_DATA_ROWS_LABEL ? 'Data rows' : 'Rows'", "TABLE_DATA_ROWS_LABEL ? 'Data rows' : 'Data rows'"],
  ['aria-label renamed with the flag off too', "TABLE_DATA_ROWS_LABEL ? 'Manual table data rows' : 'Manual table rows'", "TABLE_DATA_ROWS_LABEL ? 'Manual table data rows' : 'Manual table data rows'"],
  ['hint text changed', 'The header row is added on top.', 'Header included.'],
  ['hint shown with the flag off too', '{TABLE_DATA_ROWS_LABEL && <p id="table-data-rows-hint"', '{<p id="table-data-rows-hint"'],
  ['hint moved out of the manual block (shows in Auto)', `${HINT_LINE}\n          </div>\n        )}`, `          </div>\n        )}\n${HINT_LINE.trimStart()}`],
  ['description wired with the flag off too', "aria-describedby={TABLE_DATA_ROWS_LABEL ? 'table-data-rows-hint' : undefined}", "aria-describedby=\"table-data-rows-hint\""],
  ['hint missing from the description wiring', "aria-describedby={TABLE_DATA_ROWS_LABEL ? 'table-data-rows-hint' : undefined}", "aria-describedby={TABLE_DATA_ROWS_LABEL ? 'table-data-rows-note' : undefined}"],
  ['flag read as anything but "false"', `process.env.${FLAG} === 'true'`, `process.env.${FLAG} !== 'false'`],
  ['row count sent plus one (header added in the request)', 'next.rows = rows\n', 'next.rows = TABLE_DATA_ROWS_LABEL ? rows + 1 : rows\n'],
  ['row count sent plus one for everyone', 'next.rows = rows\n', 'next.rows = rows + 1\n'],
  ['picker stores one less than picked', 'setRows(Number(event.target.value))', 'setRows(Number(event.target.value) - (TABLE_DATA_ROWS_LABEL ? 1 : 0))'],
  ['picker offers nine rows', 'Array.from({ length: 10 }, (_, index) => index + 1)', 'Array.from({ length: 9 }, (_, index) => index + 1)'],
  ['status line renamed', '`Manual · ${rows} rows × ${columns} columns`', '`Manual · ${rows} data rows × ${columns} columns`'],
]
for (const [name, from, to] of MUTANTS) {
  check(assert.equal, formSource.includes(from), true, `mutant "${name}" must match the source`)
  const mutated = formSource.replace(from, to)
  check(assert.notEqual, mutated, formSource)
  let failure = null
  try { verify(mutated) } catch (error) { failure = error }
  check(assert.equal, failure !== null, true, `mutant "${name}" survived`)
  check(assert.equal, failure.code, 'ERR_ASSERTION', `mutant "${name}" must fail an assertion, not crash: ${failure.message}`)
  if (process.env.R10_SHOW_MUTANTS) console.log(`  caught: ${name} -> ${String(failure.message).split('\n')[0]}`)
}

// ---- 5. flag registry and wiring ----------------------------------------------------------------------------------------
const envExample = read('.env.example')
check(assert.equal, envExample.split('\n').filter(line => line.startsWith(`${FLAG}=`)).join(), `${FLAG}="false"`)
const pkg = JSON.parse(read('package.json'))
check(assert.equal, pkg.scripts['test:table-data-rows-label'], 'node scripts/test-table-data-rows-label.mjs')
const scriptNames = Object.keys(pkg.scripts)
check(assert.notEqual, scriptNames.indexOf('test:table-data-rows-label'), scriptNames.length - 1, 'not the last script line (merge-conflict anchor)')
console.log(`Table data rows label: ${checks} checks passed (flag-off identity, flag-on markup, request values, ${MUTANTS.length} mutants, flag registry).`)
