// Actual native Version branch: finite current-state cues, classic output, gates and callback identity.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const root = new URL('../', import.meta.url), file = 'components/presentation-viewer.tsx'
const source = fs.readFileSync(new URL(file, root), 'utf8')
const thumbnailInitializer = `  const thumbnailVisibilityInitializedRef = useRef(false)
  useEffect(() => {
    if (thumbnailVisibilityInitializedRef.current) return
    thumbnailVisibilityInitializedRef.current = true
    // Initialize once after hydration; native toggles and later resizing own the choice.
    if (studioShell && window.innerWidth <= 666) setShowThumbnails(false)
  }, [studioShell])
`
assert.equal(source.split(thumbnailInitializer).length, 2, 'Exactly one known post-hydration initializer is normalized; its own focused test preserves initialization behavior')
const original = execFileSync('git', ['show', '05f4570:' + file], { cwd: root, encoding: 'utf8' })
const additions = / +aria-current=\{studioShell && activeVersion === '(?:blank|strawman|final)' \? 'true' : undefined\}\n/g
assert.equal(source.match(additions)?.length, 3)
assert.equal(source.replace(additions, '').replace(thumbnailInitializer, ''), original, 'All other Viewer source is byte-exact, including handlers, geometry, readiness, options and native Check states')
assert.ok(source.includes("const studioShell = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'"), 'Only the literal existing Studio flag activates the cue')
const compile = source => {
  const result = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } })
  assert.deepEqual((result.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), [])
  return result.outputText
}
compile(source)
const branch = source => source.slice(source.indexOf('{viewerIsReady && (strawmanPreviewUrl || finalPresentationUrl)'), source.indexOf('              {/* Play */}')).trim().slice(1, -1)
const require = createRequire(import.meta.url)
const components = Object.fromEntries(['DropdownMenu', 'DropdownMenuTrigger', 'DropdownMenuPortal', 'DropdownMenuContent', 'DropdownMenuItem', 'Layers', 'Check'].map(name => [name, ({ children, asChild, ...props }) => React.createElement('div', props, children)]))
function load(source) {
  const module = { exports: {} }
  const wrapper = `export function Version({studioShell,viewerIsReady,strawmanPreviewUrl,finalPresentationUrl,activeVersion,onVersionSwitch}) { const toolbarDropdownPortalContainer=undefined,isFullscreen=false,toolbarButtonClass='button',toolbarBtnQuiet='quiet',toolbarLabelClass='label'; return (${branch(source)}) }`
  vm.runInNewContext(compile(wrapper), { module, exports: module.exports, require, ...components, cn: (...classes) => classes.join(' ') })
  return module.exports.Version
}
const Version = load(source), Original = load(original)
function findItems(tree) {
  if (!tree || typeof tree !== 'object') return []
  const result = tree.type === components.DropdownMenuItem ? [tree] : []
  React.Children.forEach(tree.props?.children, child => result.push(...findItems(child)))
  return result
}
let cases = 0
for (const flag of [undefined, 'false', 'TRUE', '1', 'true']) for (const ready of [false, true]) for (const strawman of [false, true]) for (const final of [false, true]) for (const activeVersion of ['blank', 'strawman', 'final']) {
  const called = [], props = { studioShell: flag === 'true', viewerIsReady: ready, strawmanPreviewUrl: strawman ? '/supplied-strawman' : undefined, finalPresentationUrl: final ? '/supplied-final' : undefined, activeVersion, onVersionSwitch: value => called.push(value) }
  const tree = Version(props), items = findItems(tree), visible = ready && (strawman || final)
  const values = visible ? ['blank', ...(strawman ? ['strawman'] : []), ...(final ? ['final'] : [])] : []
  assert.equal(items.length, values.length, 'Native readiness/tagged-version/option gates stay exact')
  for (let index = 0; index < items.length; index++) {
    assert.equal(items[index].props['aria-current'], flag === 'true' && values[index] === activeVersion ? 'true' : undefined)
    assert.equal(items[index].props.role, undefined, 'Native menu-item semantics are not replaced')
    items[index].props.onClick()
    assert.equal(called.at(-1), values[index], 'Exact native version callback argument is preserved')
  }
  if (flag !== 'true') assert.equal(renderToStaticMarkup(tree), renderToStaticMarkup(Original(props)), 'Classic menu output remains exact')
  cases++
}
console.log(`Studio Version menu: ${cases} finite flag/readiness/version/options/classic/callback cases and whole-source preservation passed`)
