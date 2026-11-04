import assert from 'node:assert/strict'
import fs from 'node:fs'
import postcss from 'postcss'

// Source/contrast regression only. Actual cascade, fitting and native interaction
// are verified separately in the lead's browser matrix, never inferred here.
const root = new URL('../', import.meta.url)
const files = {
  shell: 'components/layout/studio-shell.css',
  canvas: 'components/builder/studio-canvas.css',
  workspace: 'components/builder/studio-workspace.css',
  panels: 'components/builder/studio-panels.css',
  presentation: 'components/studio-presentation.css',
  thumbnails: 'components/studio-thumbnails.css',
}
const source = Object.fromEntries(Object.entries(files).map(([name, path]) => [name, fs.readFileSync(new URL(path, root), 'utf8')]))
const parsed = Object.fromEntries(Object.entries(source).map(([name, css]) => [name, postcss.parse(css)]))
const declarations = rule => Object.fromEntries(rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]))
function ruleFor(css, predicate) {
  let match
  css.walkRules(rule => { if (predicate(rule.selector)) match = declarations(rule) })
  assert.ok(match, 'Expected semantic control rule must exist')
  return match
}
function deliveryRule(css, state = '') {
  return ruleFor(postcss.parse(css), selector => selector.includes('data-studio-v4-delivery') && selector.includes('button[data-studio-publish-trigger="true"]') && (state ? selector.includes(state) : !/:(?:hover|focus-visible|disabled)/.test(selector)))
}
function assertStableDelivery(css) {
  const base = deliveryRule(css)
  assert.equal(base.background, 'var(--ss-action)')
  assert.equal(base.color, 'var(--ss-on-action)')
  const primaryRules = []
  postcss.parse(css).walkRules(rule => { if (rule.selector.includes('data-studio-publish-trigger')) primaryRules.push(rule.selector) })
  assert.ok(primaryRules.every(selector => !/title="(?:Publish|Published|Publishing)/.test(selector)), 'Normal, drifted and disabled Publish titles cannot determine its palette')
}
assertStableDelivery(source.canvas)
assert.throws(() => assertStableDelivery(source.canvas.replaceAll('button[data-studio-publish-trigger="true"]', 'button[title="Publish this deck to a shareable link"]')), 'Restoring the old exact-tooltip dependency must fail')
assert.throws(() => assertStableDelivery(source.canvas.replace('background: var(--ss-action); color: var(--ss-on-action)', 'background: var(--ss-text); color: var(--ss-panel)')), 'Restoring inverted delivery colors must fail')
const trigger = fs.readFileSync(new URL('components/publish-dialog.tsx', root), 'utf8')
assert.match(trigger, /data-studio-publish-trigger=\{STUDIO_PUBLISH \? ['"]true['"] : undefined\}/, 'Stable identity remains default-off with the native Publish gate')

for (const state of [':hover', ':disabled']) {
  const style = deliveryRule(source.canvas, state)
  assert.equal(style.color, 'var(--ss-on-action)', state + ' preserves primary foreground')
  assert.ok(style.background?.includes('--ss-action'), state + ' preserves the ink action family')
}
assert.match(deliveryRule(source.canvas, ':focus-visible').outline, /2px solid var\(--ss-accent\)/)
const present = ruleFor(parsed.canvas, selector => selector.endsWith('[data-studio-slide-controls="true"] button'))
assert.equal(present.background, 'var(--ss-action)')
assert.equal(present.color, 'var(--ss-on-action)')
const refine = ruleFor(parsed.thumbnails, selector => selector.endsWith('[data-studio-thumbnail-refine="true"]'))
assert.equal(refine.color, 'var(--st-accent)', 'Refine is an AI action, distinct from selection')
const selected = ruleFor(parsed.thumbnails, selector => selector.endsWith('[data-studio-thumbnail-card="true"][data-selected="true"]'))
assert.equal(selected['border-color'], 'var(--st-teal)', 'Selection keeps its existing separate teal treatment')

const luminance = hex => {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
}
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05)
const contrastRows = []
for (const dark of [false, true]) {
  const palette = ruleFor(parsed.shell, selector => selector === (dark ? '.dark ' : '') + '[data-studio-v4-shell="true"]')
  assert.equal(palette['--ss-action'], dark ? '#3d5c63' : '#223a3f', 'Accepted ink-slate action palette')
  assert.equal(palette['--ss-surface'], dark ? '#141c1e' : '#f5f7f6', 'Accepted Stage surface')
  assert.equal(palette['--ss-accent'], dark ? '#b4a0f2' : '#6a4fc0', 'Accepted single AI violet')
  for (const [name, foreground, background] of [
    ['delivery', '--ss-on-action', '--ss-action'],
    ['stage metadata', '--ss-muted', '--ss-surface'],
    ['AI prompt', '--ss-accent', '--ss-accent-soft'],
    ['field text', '--ss-text', '--ss-field'],
  ]) {
    const ratio = contrast(palette[foreground], palette[background])
    assert.ok(ratio >= 4.5, `${dark ? 'dark' : 'light'} ${name}: ${ratio.toFixed(2)} must meet 4.5:1`)
    contrastRows.push({ mode: dark ? 'dark' : 'light', role: name, foreground: palette[foreground], background: palette[background], ratio: Number(ratio.toFixed(2)) })
  }
}
assert.equal(ruleFor(parsed.panels, selector => selector === '[data-studio-v4-shell="true"] [data-studio-v4-panel]')['--sp-violet'], 'var(--ss-accent, #6a4fc0)')
assert.equal(ruleFor(parsed.canvas, selector => selector.includes('data-studio-v4-authoring-controls') && !selector.includes('button') && !selector.includes('>'))['overflow-x'], 'auto', 'Small allocations keep native keyboard scrolling')
assert.equal(ruleFor(parsed.workspace, selector => selector.endsWith('[data-studio-canvas-covered="true"]')).visibility, 'hidden', 'Foreground panes retain mounted iframe geometry')
assert.equal(ruleFor(parsed.presentation, selector => selector.endsWith('[data-studio-presentation-toolbar="true"]:focus-within'))['pointer-events'], 'auto', 'Native fullscreen controls remain reachable by focus')
console.log(JSON.stringify({ result: 'passed', scope: 'CSS syntax, semantic palette, tooltip-independent source identity, negative regressions and calculated contrast; browser proof separate', contrast: contrastRows }, null, 2))
