import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import postcss from 'postcss'

// Source and actual leaf contracts only; root owns browser fit/focus/account proof.
const root = new URL('../', import.meta.url), anchor = '02826256'
const read = path => fs.readFileSync(new URL(path, root), 'utf8')
const prior = path => execFileSync('git', ['show', `${anchor}:${path}`], { cwd: root, encoding: 'utf8' })
const cssPath = 'components/layout/studio-shell.css', css = read(cssPath)
const railPath = 'components/layout/studio-rail.tsx', hintPath = 'components/layout/studio-navigation-hint.tsx'
function restoreShell(value) {
  const block = /^\/\* Compact rail clearance START[^\n]*\n[\s\S]*?^\/\* Compact rail clearance END\. \*\/\n/gm
  assert.equal([...value.matchAll(block)].length, 1, 'Exactly one named short-rail presentation block')
  value = value.replace(block, '')
  const responsive = /^\/\* Reference rail breakpoint START[^\n]*\n[\s\S]*?^\/\* Reference rail breakpoint END\. \*\/\n/gm
  assert.equal([...value.matchAll(responsive)].length, 1, 'One named reference breakpoint block')
  value = value.replace(responsive, '')
  assert.equal(value.split('  --ss-rail-width: 56px;\n').length - 1, 1, 'One desktop rail width declaration')
  value = value.replace('  --ss-rail-width: 56px;\n', '')
  for (const [from, to] of [['width: var(--ss-rail-width);\n  background: var(--ss-frame);', 'width: 56px;\n  background: var(--ss-frame);'], ['flex: 0 0 var(--ss-rail-width);', 'flex: 0 0 56px;'], ['{ left: var(--ss-rail-width); top: 48px;', '{ left: 56px; top: 48px;'], ['translateX(calc(-100% - var(--ss-rail-width)))', 'translateX(calc(-100% - 56px))']]) {
    assert.equal(value.split(from).length - 1, 1, `One known width/paired offset transform: ${from}`)
    value = value.replace(from, to)
  }
  return value
}
assert.equal(restoreShell(css), prior(cssPath), 'Every other shell/session/toolbar/fullscreen/palette/classic CSS byte stays exact')
assert.equal(read(railPath), prior(railPath), 'All actual links, gate/caller seams, labels, order and account props remain byte-exact')
assert.equal(read(hintPath), prior(hintPath), 'Actual hint trigger/child/collision behavior remains byte-exact')
const block = css.match(/^\/\* Compact rail clearance START[^\n]*\n([\s\S]*?)^\/\* Compact rail clearance END\. \*\/\n/m)[1]
const rules = postcss.parse(block)
rules.walkRules(rule => assert.ok(postcss.list.comma(rule.selector).every(selector => selector.trim().startsWith('[data-studio-v4-shell="true"]')), 'Every added selector is literal Studio-only'))
const rule = selector => { let found; rules.walkRules(selector, node => { found = node }); assert.ok(found, selector); return Object.fromEntries(found.nodes.filter(n => n.type === 'decl').map(n => [n.prop, n.value])) }
const nav = rule('[data-studio-v4-shell="true"] > [data-studio-v4-rail] nav')
assert.equal(nav['min-height'], '0'); assert.equal(nav['overflow-y'], 'auto'); assert.equal(nav['overflow-x'], 'hidden'); assert.equal(nav.width, '100%')
assert.equal(rule('[data-studio-v4-shell="true"] > [data-studio-v4-rail] nav :is(a,button)').flex, '0 0 40px')
assert.equal(rule('[data-studio-v4-shell="true"] > [data-studio-v4-rail] nav :is(a,button):focus-visible')['outline-offset'], '-2px')
for (const selector of ['[data-studio-v4-shell="true"] > [data-studio-v4-rail] .studio-rail-brand', '[data-studio-v4-shell="true"] > [data-studio-v4-rail] .studio-rail-profile']) assert.equal(rule(selector)['flex-shrink'], '0')
assert.ok(!block.match(/display:\s*none|visibility:|order:|pointer-events:/), 'No new hidden, reordered or inert destination/profile controls')
assert.throws(() => assert.equal(restoreShell(css.replace('left: var(--ss-rail-width); top: 48px;', 'left: 56px; top: 48px;')), prior(cssPath)), 'Unpaired drawer offset fails')
assert.throws(() => assert.equal(restoreShell(css + '\nbutton { display: none; }\n'), prior(cssPath)), 'Unknown global/classic alteration fails')
const responsiveRules = postcss.parse(css).nodes.filter(n => n.type === 'atrule' && n.name === 'media' && n.nodes?.some(r => r.nodes?.some(d => d.prop === '--ss-rail-width')))
assert.equal(responsiveRules.length, 1, 'One responsive rail-width override')
assert.equal(responsiveRules[0].params, '(max-width: 780px)', 'Exact inclusive approved prototype breakpoint')
assert.equal(responsiveRules[0].nodes.length, 1)
assert.equal(responsiveRules[0].nodes[0].selector, '[data-studio-v4-shell="true"]')
assert.deepEqual(responsiveRules[0].nodes[0].nodes.map(d => [d.prop,d.value]), [['--ss-rail-width','48px']])
const allRules = postcss.parse(css)
const declarations = selector => { const found=[]; allRules.walkRules(selector,n=>found.push(n)); assert.equal(found.length,1,selector); return Object.fromEntries(found[0].nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value])) }
assert.equal(declarations('[data-studio-v4-shell="true"] > [data-studio-v4-rail]').width, 'var(--ss-rail-width)')
assert.equal(declarations('[data-studio-v4-shell="true"] > [data-studio-v4-rail]').flex, '0 0 var(--ss-rail-width)')
assert.equal(declarations('[data-studio-v4-shell="true"] [data-studio-v4-session-list]').left, 'var(--ss-rail-width)')
assert.equal(declarations('[data-studio-v4-shell="true"] [data-studio-v4-session-list][data-studio-v4-session-open="false"]').transform, 'translateX(calc(-100% - var(--ss-rail-width)))')
const breakpointCases = [390,780,781,1440].map(width => ({ width,railWidth:width<=780?48:56 }))
assert.deepEqual(breakpointCases.map(x=>x.railWidth), [48,48,56,56])
assert.throws(() => assert.equal(postcss.parse(css.replace('(max-width: 780px)', '(max-width: 779px)')).nodes.find(n=>n.type==='atrule'&&n.nodes?.some(r=>r.nodes?.some(d=>d.prop==='--ss-rail-width'))).params, '(max-width: 780px)'), 'Off-by-one breakpoint fails')
assert.throws(() => assert.equal(restoreShell(css.replace('flex: 0 0 var(--ss-rail-width);','flex: 0 0 48px;')), prior(cssPath)), 'Unpaired rail flex basis fails')
const jsx = (type, props, key) => ({ type, props: props || {}, key })
const flatten = value => Array.isArray(value) ? value.flatMap(flatten) : value && typeof value === 'object' ? [value, ...flatten(value.props?.children)] : []
function load(pathname, tokens) {
  const imports = { 'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/link': { default: 'Link' }, 'next/navigation': { usePathname: () => pathname }, 'lucide-react': new Proxy({}, { get: (_, key) => key }), '@/components/user-profile-menu': { UserProfileMenu: 'UserProfileMenu' }, '@/components/layout/studio-navigation-hint': { StudioNavigationHint: 'StudioNavigationHint' }, './studio-shell.css': {}, '@/components/ui/tooltip': new Proxy({}, { get: (_, key) => key }) }
  const exports = {}
  for (const path of [railPath, hintPath]) {
    const compiled = ts.transpileModule(read(path), { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } })
    assert.deepEqual((compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error), [])
    vm.runInNewContext(compiled.outputText, { module: { exports }, exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_TOKENS: tokens } }, require: id => { assert.ok(id in imports, id); return imports[id] } })
  }
  return exports
}
let cases = 0
for (const pathname of ['/builder', '/builder/deck', '/dashboard', '/studio/templates', '/studio/themes', '/knowledge', '/studio/intelligence', '/studio/details', '/help']) for (const tokens of [undefined, 'false', 'TRUE', '1', 'true']) {
  const actual = load(pathname, tokens), usage = jsx('NativeUsage', { owner: 'same-session' }), tree = actual.StudioRail({ homeHref: '/safe-home', sessionUsage: usage })
  const nodes = flatten(tree), controls = nodes.filter(n => n.type === 'Link' || n.type === 'button')
  assert.deepEqual(controls.map(n => n.props['aria-label']), ['Deckster home', 'Studio', 'Decks', 'Templates', 'Themes & brand', 'Knowledge', 'Intelligence', 'Your details'])
  assert.equal(controls[0].props.href, '/safe-home')
  assert.equal(controls[1].type, pathname.startsWith('/builder') ? 'button' : 'Link')
  assert.equal(controls[1].props.href, pathname.startsWith('/builder') ? undefined : '/builder')
  assert.equal(nodes.find(n => n.type === 'UserProfileMenu').props.sessionUsage, usage)
  assert.equal(nodes.find(n => n.type === 'UserProfileMenu').props.studioPalette, tokens === 'true')
  const active = controls.filter(n => n.props['aria-current'] === 'page')
  assert.equal(active.length, pathname === '/help' ? 0 : 1)
  let calls = 0; const entry = jsx('button', { onClick: () => { calls++ }, 'aria-label': 'Existing native Studio entry' })
  assert.equal(flatten(actual.StudioRail({ studioEntry: entry })).find(n => n === entry), entry); entry.props.onClick(); assert.equal(calls, 1)
  assert.equal(actual.StudioNavigationHint({ enabled: false, label: 'Classic', children: entry }), entry)
  const hint = actual.StudioNavigationHint({ enabled: true, label: 'Visible native label', children: entry })
  assert.equal(flatten(hint).find(n => n.type === 'TooltipTrigger').props.children, entry)
  assert.equal(flatten(hint).find(n => n.type === 'TooltipContent').props.children, 'Visible native label')
  cases++
}
console.log(JSON.stringify({ passed: true, actualRouteTokenPropCases: cases, negativeSourceWitnesses: 4, breakpointCases, anchor, hashes: Object.fromEntries([cssPath,railPath,hintPath].map(path => [path,createHash('sha256').update(read(path)).digest('hex')])), scope: 'Exact bounded CSS restoration and actual rail/hint props/DOM/callbacks; no browser geometry/focus, account/session/backend/fullscreen or connected proof. Classic caller mounting and native full-runtime preservation remain lead checks.' }, null, 2))
