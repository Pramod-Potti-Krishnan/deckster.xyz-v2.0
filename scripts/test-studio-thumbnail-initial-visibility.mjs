// Post-hydration initial visibility only. Actual native toggle/resize/iframe source remains unchanged.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const root = new URL('../', import.meta.url), file = 'components/presentation-viewer.tsx'
const source = fs.readFileSync(new URL(file, root), 'utf8')
const original = execFileSync('git', ['show', '9e6853d:' + file], { cwd: root, encoding: 'utf8' })
const block = source.match(/  const thumbnailVisibilityInitializedRef = useRef\(false\)\n  useEffect\(\(\) => \{[\s\S]*?  \}, \[studioShell\]\)\n/)?.[0]
assert.ok(block)
assert.equal(source.replace(block, ''), original, 'Only the initialization ref/effect changes; every native handler/width/flag/timer/iframe/prop/render gate remains byte-exact')
assert.ok(source.includes('const [showThumbnails, setShowThumbnails] = useState(true) // Show by default'), 'SSR and first hydration retain the original visible thumbnail DOM')
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let effect
const visit = node => {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0].getText(ast).includes('thumbnailVisibilityInitializedRef.current')) effect = node
  ts.forEachChild(node, visit)
}
visit(ast); assert.ok(effect)
assert.equal(effect.arguments[1].getText(ast), '[studioShell]')
const output = ts.transpileModule(`export const initialize = ${effect.arguments[0].getText(ast)}`, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
assert.deepEqual((output.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), [])
let cases = 0
for (const flag of [undefined, 'false', 'TRUE', '1', 'true']) for (const width of [390, 666, 667, 1440]) {
  const ref = { current: false }, window = { innerWidth: width }, writes = []
  let visible = true
  const module = { exports: {} }
  vm.runInNewContext(output.outputText, { module, exports: module.exports, studioShell: flag === 'true', window, thumbnailVisibilityInitializedRef: ref, setShowThumbnails: value => { visible = value; writes.push(value) } })
  const initialize = module.exports.initialize
  assert.equal(visible, true); assert.equal(ref.current, false); assert.equal(writes.length, 0, 'SSR/initial render performs no hidden state initialization')
  initialize()
  const compactStudio = flag === 'true' && width <= 666
  assert.equal(visible, !compactStudio, 'Only a literal Studio compact first mount hides thumbnails')
  assert.equal(ref.current, true); assert.equal(writes.length, compactStudio ? 1 : 0)
  initialize(); assert.equal(writes.length, compactStudio ? 1 : 0, 'StrictMode repeated effect setup cannot write twice')
  for (const userChoice of [true, false]) {
    visible = userChoice
    for (const nextWidth of [1440, 390, 666, 667]) {
      window.innerWidth = nextWidth; initialize()
      assert.equal(visible, userChoice, 'Native user choice survives every later viewport change and effect replay')
      assert.equal(writes.length, compactStudio ? 1 : 0)
    }
  }
  cases++
}
assert.ok(!/addEventListener|ResizeObserver|localStorage|sessionStorage|setTimeout|setInterval/.test(block), 'Initialization adds no preference write, responsive forcing, transport or timer')
const parsed = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } })
assert.deepEqual((parsed.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), [])
console.log(`Studio initial thumbnail visibility: ${cases} literal/boundary/first-mount/StrictMode/user-choice cases and whole-Viewer preservation passed`)
