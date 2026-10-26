// FRONTEND-2 P3-10 MODEL CHOICE, the compact picker: a fixture FRONTEND-1 can open to see the component before placing it. NOT a route and not mounted anywhere in the app.
//
//   node scripts/render-model-picker-fixture.mjs [out.html]        (default: model-picker-fixture.html in the OS temp dir; the path is printed)
//
// It renders the picker's real components (components/model-choice/model-picker.tsx, with its stylesheet inlined) with react-dom/server, from the live-shaped catalogue fixture, and writes ONE static page:
// the chip in every state in a 400 px composer row and in a 375 px phone row, and the menu in every state. The page has no script: the menus are shown open, side by side, as they sit inside the popover.
// Nothing is fetched, nothing is written but the one file, and the real Studio routes are not touched.
//
// The slider variant (variant="slider": a 24 px gauge icon, a slider over the stops Auto / Fast / Balanced / Best, a label under each stop, the caption and a closed "Advanced") is shown too: the trigger in the
// same two rows, and the popover in every state, with a fifth stop from a made-up extra preset, side by side with "Advanced" closed and open.
//
// To place it in the composer (FRONTEND-1):
//   import { ModelPicker } from '@/components/model-choice/model-picker'
//   <ModelPicker variant="compact" sessionId={sessionId /* string | null */} disabled={busy} className="ml-auto" onChange={choice => { /* { tier } | { model } | null */ }} />
//   <ModelPicker variant="slider" sessionId={sessionId} className="..." />      the slider variant (same props); MODEL_PICKER_STOPS(catalogue) and MODEL_PICKER_DEFAULT_STOPS give a mock the same labels
// It renders nothing unless NEXT_PUBLIC_STUDIO_MODEL_CHOICE is exactly "true", so it can be mounted unconditionally. To read or set the choice yourself, use
// `useModelChoice(sessionId)` from the same module (it is the hook the chip is built on).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { FILES, loadPicker, nodeRequire, realDeps, root } from './studio-model-picker-kit.mjs'

const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const deps = realDeps()
const { createElement: h } = deps.react
const m = loadPicker({ ...deps, env: { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' } })
const body = JSON.parse(fs.readFileSync(path.join(root, 'scripts/fixtures/studio-model-choice/catalogue-live-shape.json'), 'utf8'))
const catalogue = m.choice.withPresets(m.cat.parseCatalogue(body), body)
const { picker, component, slider, sliderLib } = m
const noop = () => undefined

const state = {
  auto: { kind: 'auto' }, fast: { kind: 'tier', tier: 'economy' }, balanced: { kind: 'tier', tier: 'balanced' }, best: { kind: 'tier', tier: 'best' },
  model: { kind: 'model', model: 'anthropic/claude-opus-5.5' }, longModel: { kind: 'model', model: 'deepseek/deepseek-v4.1-flash' }, mixed: { kind: 'mixed' },
}
const chip = (name, s, extra = {}) => `<figure class="cell"><figcaption>${name}</figcaption>${renderToStaticMarkup(h(component.ModelPickerView, {
  label: picker.chipLabel(s, catalogue), stateKind: s.kind, scope: 'user', mode: 'account', ready: true, menu: picker.pickerMenu({ catalogue, state: s }), saveNote: '', open: false, onOpenChange: noop, view: 'main', onView: noop, onPick: noop, ...extra,
}))}</figure>`
const chips = () => [
  chip('Auto', state.auto), chip('Fast', state.fast), chip('Balanced', state.balanced), chip('Best', state.best), chip('A model', state.model), chip('A long model name', state.longModel), chip('Mixed per task', state.mixed),
  chip('Disabled', state.auto, { disabled: true }), chip('Loading', state.auto, { ready: false }),
].join('')
const tools = row => `<div class="row" style="width:${row}px"><span class="tool">Attach</span><span class="tool">Template</span><span class="tool">Theme</span>${renderToStaticMarkup(h(component.ModelPickerView, {
  label: picker.chipLabel(state.balanced, catalogue), stateKind: 'tier', scope: 'user', mode: 'account', ready: true, className: 'chip-end', menu: picker.pickerMenu({ catalogue, state: state.balanced }), saveNote: '', open: false, onOpenChange: noop, view: 'main', onView: noop, onPick: noop,
}))}</div>`
const menu = (name, s, { view = 'main', scope = 'user', save = '', inherited = null } = {}) => `<figure class="cell"><figcaption>${name}</figcaption><div class="mpick-menu static">${renderToStaticMarkup(h(component.ModelPickerPanel, {
  menu: picker.pickerMenu({ catalogue, state: s, inherited }), view, scope, saveNote: save, onView: noop, onPick: noop,
}))}</div></figure>`
const menus = () => [
  menu('Auto, saved to the account', state.auto, { save: picker.saveNote('account', null, true) }),
  menu('Best, not saved yet (this device)', state.best, { save: picker.saveNote('device', 'not-configured', true) }),
  menu('A model chosen', state.model, { save: picker.saveNote('account', null, true) }),
  menu('More models', state.model, { view: 'models', save: picker.saveNote('account', null, true) }),
  menu('This deck, following the default', state.best, { scope: 'deck', inherited: state.best, save: picker.saveNote('account', null, true) }),
  menu('The account cannot be reached', state.fast, { save: picker.saveNote('device', 'unreachable', true) }),
].join('')


// ---- the slider variant
const stopsOf = (extra = false) => {
  if (!extra) return sliderLib.MODEL_PICKER_STOPS(catalogue)
  const body2 = JSON.parse(JSON.stringify(body))
  for (const group of ['planning_strategy', 'content_writing', 'research_analysis']) body2.groups[group].presets.ultra = 'openai/gpt-6.1-sol'
  body2.models['openai/gpt-6.1-sol'].cost_hint = '$$$'
  return sliderLib.MODEL_PICKER_STOPS(m.choice.withPresets(m.cat.parseCatalogue(body2), body2), { presets: [...sliderLib.SLIDER_SAVABLE_PRESETS, 'ultra'] })
}
const sliderTrigger = (name, s, extra = {}) => { const v = sliderLib.sliderView({ catalogue, state: s }); return `<figure class="cell"><figcaption>${name}</figcaption>${renderToStaticMarkup(h(slider.ModelSliderView, {
  label: v.label, valueText: v.valueText, stateKind: s.kind, scope: 'user', mode: 'account', ready: true, stops: v.stops, index: v.index, offScale: v.offScale, advanced: sliderLib.sliderAdvanced({ catalogue, state: s, scope: 'user' }), saveNote: '', open: false, onOpenChange: noop, onDraft: noop, onCommit: noop, onAdvanced: noop, ...extra,
}))}</figure>` }
const sliderTools = row => { const v = sliderLib.sliderView({ catalogue, state: state.balanced }); return `<div class="row" style="width:${row}px"><span class="tool">Attach</span><span class="tool">Template</span><span class="tool">Theme</span>${renderToStaticMarkup(h(slider.ModelSliderView, {
  label: v.label, valueText: v.valueText, stateKind: 'tier', scope: 'user', mode: 'account', ready: true, className: 'chip-end', stops: v.stops, index: v.index, offScale: v.offScale, advanced: sliderLib.sliderAdvanced({ catalogue, state: state.balanced, scope: 'user' }), saveNote: '', open: false, onOpenChange: noop, onDraft: noop, onCommit: noop, onAdvanced: noop,
}))}</div>` }
const sliderMenu = (name, s, { scope = 'user', own = null, userState = null, save = 'Saved to your account. Applies from the next build.', extra = false, open = false, draft = null } = {}) => {
  const stops = stopsOf(extra), v = sliderLib.sliderView({ catalogue, state: s, stops })
  const html = renderToStaticMarkup(h(slider.ModelSliderPanel, { label: v.label, valueText: v.valueText, scope, blocked: false, stops, index: v.index, offScale: v.offScale, draft, advanced: sliderLib.sliderAdvanced({ catalogue, state: s, scope, own, userState }), saveNote: save, notesId: 'n', captionId: 'c', onDraft: noop, onCommit: noop, onAdvanced: noop }))
  const pct = ((draft ?? (v.index >= 0 ? v.index : 0)) / Math.max(stops.length - 1, 1)) * 100
  // Radix hides a thumb and leaves it at the start until the browser has measured it; this page has no script, so the thumb is shown where Radix will put it (its inset is half the thumb at the start and none at the end)
  const shownThumb = (text) => text.replace(/ style="display:none"( data-radix-collection-item="")/g, '$1').replace('left:calc(0% + 0px)', `left:calc(${pct}% + ${(8 - 0.16 * pct).toFixed(2)}px)`)
  return `<figure class="cell"><figcaption>${name}</figcaption><div class="mpick-menu mpick-slider-menu static">${shownThumb(open ? html.replace('<details class="mpick-advanced"', '<details class="mpick-advanced" open') : html)}</div></figure>`
}
const sliderMenus = () => [
  sliderMenu('Auto (nothing chosen), Advanced closed', state.auto),
  sliderMenu('Balanced', state.balanced),
  sliderMenu('Best, being dragged to Fast', state.best, { draft: 1 }),
  sliderMenu('A specific model: Custom, off the scale', state.model),
  sliderMenu('Five stops (a made-up extra preset)', state.balanced, { extra: true }),
  sliderMenu('A deck following the default, Advanced open', state.best, { scope: 'deck', own: 'default', userState: state.best, open: true }),
  sliderMenu('A deck on its own Auto, Advanced open', { kind: 'auto', deck: true }, { scope: 'deck', own: 'auto', userState: state.best, open: true }),
  sliderMenu('Reusable default, Advanced open', state.balanced, { open: true, save: 'Saved on this device for now' }),
].join('')

const css = fs.readFileSync(path.join(root, FILES.css), 'utf8') + '\n' + fs.readFileSync(path.join(root, FILES.sliderCss), 'utf8')
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Model picker fixture</title><style>
:root { --popover: 0 0% 100%; --popover-foreground: 240 10% 3.9%; --border: 240 5.9% 90%; --muted-foreground: 240 3.8% 46.1%; --ring: 250 90% 60%; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --popover: 240 10% 3.9%; --popover-foreground: 0 0% 98%; --border: 240 3.7% 15.9%; --muted-foreground: 240 5% 64.9%; color-scheme: dark; } }
body { margin: 0; padding: 24px 16px; background: hsl(var(--popover)); color: hsl(var(--popover-foreground)); font: 14px/1.4 system-ui, sans-serif; }
h1 { margin: 0 0 4px; font-size: 18px } h2 { margin: 28px 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: hsl(var(--muted-foreground)) }
p.note { margin: 0 0 8px; color: hsl(var(--muted-foreground)); font-size: 12px }
.grid { display: flex; flex-wrap: wrap; gap: 16px 24px; align-items: flex-start } .cell { margin: 0 } figcaption { margin: 0 0 6px; font-size: 11px; color: hsl(var(--muted-foreground)) }
.row { display: flex; align-items: center; gap: 8px; box-sizing: border-box; padding: 8px; border: 1px dashed hsl(var(--border)); border-radius: 8px; margin-bottom: 8px }
.tool { display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border: 1px solid hsl(var(--border)); border-radius: 999px; font-size: 12px } .chip-end { margin-left: auto }
.mpick-menu.static { position: static; width: 240px; max-height: none }
.mpick-menu.mpick-slider-menu.static { width: 270px }
${css}
</style></head><body>
<h1>Model picker, compact</h1><p class="note">Static render of components/model-choice/model-picker.tsx from the live-shaped catalogue fixture (six models common to the three text groups). Not mounted in the app.</p>
<h2>In a 400 px composer row (the chip takes the width the row gives it)</h2>${tools(400)}
<h2>In a 375 px phone row (24 px chip, 44 px hit area)</h2>${tools(375)}
<h2>The chip, in every state</h2><div class="grid">${chips()}</div>
<h2>The menu, in every state</h2><div class="grid">${menus()}</div>
<h2>Slider variant: the gauge in a 400 px and a 375 px composer row</h2>${sliderTools(400)}${sliderTools(375)}
<h2>Slider variant: the gauge, in every state</h2><div class="grid">${sliderTrigger('Auto', state.auto)}${sliderTrigger('Balanced', state.balanced)}${sliderTrigger('Custom (a model)', state.model)}${sliderTrigger('Disabled', state.auto, { disabled: true })}${sliderTrigger('Loading', state.auto, { ready: false })}</div>
<h2>Slider variant: the popover, in every state</h2><div class="grid">${sliderMenus()}</div>
</body></html>`
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'model-picker-fixture.html'))
fs.writeFileSync(out, page)
console.log(out)
