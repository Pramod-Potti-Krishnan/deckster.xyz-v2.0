// PASS2B G35 (FRONTEND-2): an "Open themes & brand kit" link at the foot of the deck theme picker. Flag NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK (exact "true", Studio
// shell only), default off. The link sits inside ThemePickerV2 (the lighter picker: NEXT_PUBLIC_STUDIO_THEME_PICKER_V2 or NEXT_PUBLIC_STUDIO_THEME_DROPDOWN, both
// Studio shell only), so the plain panel is untouched by it. It opens /studio/themes (a Next link, same tab) and closes the picker; drawn locked or not, in
// the preset view only (not in the custom-palette editor).
//
// Run: node scripts/test-studio-theme-brand-link.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   THEME_BRAND_LINK_BASE=<commit> overrides the base commit the flag-off identity is checked against (default e9503ae).
//
// Proven on the REAL components/theme-panel.tsx (and the real lib/theme-builder.ts and lib/theme-preset-swatches.ts; stubbed leaves: icons, Button, Next link),
// rendered with react-dom/server, and on the real components/studio-theme-panel.css:
//   1. source: with its import, icon import and one block turned back into the base's the panel is the base commit's file; the flag is read once, inline, exact
//      "true", AND the shell; the block sits in the preset branch; the CSS minus the one `.stpv2-brandkit` rule is the base commit's CSS and that rule exists;
//   2. flag off (unset, "", "false", near-misses; "true" without the shell; "true" on the plain panel): every panel markup (preset, auto, overrides, custom;
//      locked or not; idle or failed sync; closed) is the base commit's file rendered the same way, byte for byte, and no Link is created;
//   3. flag + shell on, in the lighter picker: exactly one `<a href="/studio/themes" ... data-studio-theme-action="brand-kit">` "Open themes & brand kit", in
//      the body after the cards (and after the custom-palette row), locked or not; never in the custom-palette editor; removing that one `<p class="stpv2-brandkit">`
//      from the on markup gives the off markup exactly; the Link's onClick is the onClose handed to the panel, href "/studio/themes", no prefetch;
//   4. mutation check: every mutant of the panel and the CSS is killed by sections 1-3.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const postcss = nodeRequire('postcss')
const BASE_COMMIT = process.env.THEME_BRAND_LINK_BASE || 'e9503ae'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const baseSource = rel => execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const PANEL = 'components/theme-panel.tsx', CSS = 'components/studio-theme-panel.css'
const SOURCES = { [PANEL]: read(PANEL), [CSS]: read(CSS) }
const BASE = { [PANEL]: baseSource(PANEL), [CSS]: baseSource(CSS) }
const FLAG = 'NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK', SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL', V2 = 'NEXT_PUBLIC_STUDIO_THEME_PICKER_V2', DROPDOWN = 'NEXT_PUBLIC_STUDIO_THEME_DROPDOWN'
const compile = (source, fileName) => ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText

// ---------------------------------------------------------------- 1. source
const IMPORT = "import Link from 'next/link'\n", ICON = '  ArrowRight,\n'
const CUSTOM_ROW_CONST = `  // The "Want your own colours?" row, as the base drew it (a const so the G35 link below can sit beside it without adding a child).
  const customRow = !locked && (
    <div className="stpv2-custom-row">
      <span>Want your own colours?</span>
      <button type="button" className="stpv2-link" onClick={onBuildCustom}>
        <Wand2 className="h-3.5 w-3.5" aria-hidden="true" /> Build a custom palette
      </button>
    </div>
  )
`
const BRAND_CONST = `  // PASS2B G35 (NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK, default off, Studio shell only): the way on to Themes & brand, locked or not. Null with the flag
  // off, and then the body renders \`customRow\` alone in its old place, so the flag-off element tree has no extra child.
  const brandKitLink = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK === 'true' ? (
    <p className="stpv2-brandkit" data-studio-theme-part="brand-kit">
      <Link href="/studio/themes" prefetch={false} className="stpv2-link" data-studio-theme-action="brand-kit" onClick={onClose}>
        <Palette className="h-3.5 w-3.5" aria-hidden="true" /> Open themes &amp; brand kit <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </p>
  ) : null
`
const CONSTS = CUSTOM_ROW_CONST + BRAND_CONST
const USE = `            {brandKitLink ? <>{customRow}{brandKitLink}</> : customRow}\n`
const BASE_USE = `            {!locked && (
              <div className="stpv2-custom-row">
                <span>Want your own colours?</span>
                <button type="button" className="stpv2-link" onClick={onBuildCustom}>
                  <Wand2 className="h-3.5 w-3.5" aria-hidden="true" /> Build a custom palette
                </button>
              </div>
            )}
`
// P2C (reviewed): the Light | Dark control (flag NEXT_PUBLIC_THEME_DARK_MODE_ENABLED, proven in test-studio-theme-dark-toggle.mjs). Its additions to the panel
// are listed here, [P2C text, base text]; with the flag off the panel renders the base's tree, so turning them back must give the base file.
const P2C_SWAPS = [
  // import: helper
  ["import { clampDarkOnlyPaletteMode, customEntryPaletteMode, effectivePaletteMode, lightDisabledFor, themeDarkModeEnabled, withPaletteMode, type DeckPaletteMode } from '@/lib/studio-theme-dark-toggle'\n", ""],
  // import: control
  ["import { DeckModeControl } from './theme-deck-mode-control'\n", ""],
  // flag const
  ["// P2C (flag NEXT_PUBLIC_THEME_DARK_MODE_ENABLED, exact \"true\", default off): a Light / Dark choice for the whole deck, before the build. It writes\n// `palette_mode` onto the theme selection that already goes out (the build message and `set_theme`). On a built deck the same control only stages\n// \"Rebuild in dark / light\" (nothing is sent). Off: no control, and every handler below computes what it did before.\nconst THEME_DARK_MODE = themeDarkModeEnabled(process.env.NEXT_PUBLIC_THEME_DARK_MODE_ENABLED)\n", ""],
  // picker prop destructured
  ["  presetPicker,\n  modeControl,\n", "  presetPicker,\n"],
  // picker prop type
  ["  /** The Light | Dark control (flag NEXT_PUBLIC_THEME_DARK_MODE_ENABLED). Absent: the body is as it was. */\n  modeControl?: ReactNode\n", ""],
  // current row const
  ["  // The \"Current theme\" row as the base drew it (a const so the Light | Dark control can sit under it without adding a child when there is none).\n  const currentRow = (\n    <div className=\"stpv2-current\" data-studio-theme-current=\"true\">\n      <span>Current theme</span>\n      <strong>{currentLabel}</strong>\n    </div>\n  )\n", ""],
  // current row use
  ["      {modeControl ? <>{currentRow}{modeControl}</> : currentRow}\n", "      <div className=\"stpv2-current\" data-studio-theme-current=\"true\">\n        <span>Current theme</span>\n        <strong>{currentLabel}</strong>\n      </div>\n"],
  // staged state
  ["  // P2C: the mode staged for the next rebuild of this deck (flag on, built deck only). Panel state, scoped to the deck it was chosen on: it is never put in\n  // the theme selection (a changed selection makes the page send `set_theme`), and nothing reads it to start a build.\n  const [staged, setStaged] = useState<{ deckKey: string; mode: DeckPaletteMode } | null>(null)\n  const deckKey = presentationId ?? ''\n  const stagedMode = staged && staged.deckKey === deckKey ? staged.mode : null\n", ""],
  // custom entry
  ["palette_mode: customEntryPaletteMode(draft, THEME_DARK_MODE),", "palette_mode: draft.palette_mode || 'both',"],
  // control factory
  ["  // P2C: the Light | Dark control (flag on only). Before the build it edits the draft like any other control (Apply sends it); on a built deck\n  // it stages \"Rebuild in dark / light\" in this panel and sends nothing.\n  const deckModeControlFor = (variant: 'plain' | 'picker') => THEME_DARK_MODE ? (\n    <DeckModeControl\n      variant={variant}\n      locked={selectionLocked}\n      mode={effectivePaletteMode(draft, THEME_DARK_MODE)}\n      staged={stagedMode}\n      lightDisabled={lightDisabledFor(draft, THEME_DARK_MODE)}\n      onChange={next => updateDraft(withPaletteMode(draft, next, THEME_DARK_MODE))}\n      onStage={next => setStaged(next ? { deckKey, mode: next } : null)}\n    />\n  ) : null\n\n", ""],
  // dark-only presets: the last gate before Apply sends the selection (flag on only; a no-op otherwise)
  ["    const next = clampDarkOnlyPaletteMode(normalizeThemePanelSelection(draft), THEME_DARK_MODE)\n", "    const next = normalizeThemePanelSelection(draft)\n"],
  // picker prop passed
  ["        modeControl={deckModeControlFor('picker')}\n", ""],
  // plain control
  ["  const deckModeControl = deckModeControlFor('plain')\n", ""],
  // locked notice const
  ["  // The lock note as the base drew it (a const so the Light | Dark control can follow it without adding a child when there is none).\n  const lockedNotice = selectionLocked && (\n    <div data-studio-theme-notice={STUDIO_THEME_PANEL ? 'locked' : undefined} tabIndex={STUDIO_THEME_PANEL ? 0 : undefined} className=\"border-b border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800\">\n      Template and theme choices are locked once generation starts. Start a new chat to choose different build settings.\n    </div>\n  )\n", ""],
  // locked notice use
  ["      {deckModeControl ? <>{lockedNotice}{deckModeControl}</> : lockedNotice}\n", "      {selectionLocked && (\n        <div data-studio-theme-notice={STUDIO_THEME_PANEL ? 'locked' : undefined} tabIndex={STUDIO_THEME_PANEL ? 0 : undefined} className=\"border-b border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800\">\n          Template and theme choices are locked once generation starts. Start a new chat to choose different build settings.\n        </div>\n      )}\n"],
]
const unP2c = text => P2C_SWAPS.reduce((out, [mine, base]) => { eq(out.split(mine).length - 1, 1, `P2C: ${mine.slice(0, 48).trim()} appears once`); return out.replace(mine, () => base) }, text)
// PASS2D 4c (NEXT_PUBLIC_STUDIO_THEME_AUTO_NO_PILL): the panel's two edits for the header pill, as [text in the panel, the base's text]. Proven in test-studio-theme-auto-pill.mjs;
// turning them back is how this test still shows the panel is the base commit's file.
const AUTO_PILL_REVERSALS = [
  ["import { STUDIO_THEME_AUTO_NO_PILL_ENABLED, themeAppliedPillHidden } from '@/lib/studio-theme-auto-pill'\n", ""],
  ["          {syncStatus !== 'idle' && !themeAppliedPillHidden(STUDIO_THEME_AUTO_NO_PILL_ENABLED, syncStatus, autoCurrent) && <SyncBadge status={syncStatus} />}\n",
   "          {syncStatus !== 'idle' && <SyncBadge status={syncStatus} />}\n"],
]
// PASS2D 4b (NEXT_PUBLIC_STUDIO_THEME_PLAIN_WORDS): the panel's two edits for plain-words descriptions, as [text in the panel, the base's text]. Proven in
// test-studio-theme-plain-words.mjs; turning them back is how this test still shows the panel is the base commit's file.
const PLAIN_WORDS_REVERSALS = [
  ["import { STUDIO_THEME_PLAIN_WORDS_ENABLED, themePlainDescription } from '@/lib/studio-theme-plain-words'\n", ""],
  ["const THEME_PREVIEWS = CANONICAL_THEME_PRESET_IDS.map(id => {\n  const preset = FALLBACK_THEME_PRESETS.find(item => item.preset_id === id)!\n  // PASS2D 4b (NEXT_PUBLIC_STUDIO_THEME_PLAIN_WORDS, default off): the description in plain words; off, the preset's own.\n  return { id, ...preset, description: themePlainDescription(STUDIO_THEME_PLAIN_WORDS_ENABLED, id, preset.description) }\n})\n",
   "const THEME_PREVIEWS = CANONICAL_THEME_PRESET_IDS.map(id => ({\n  id,\n  ...FALLBACK_THEME_PRESETS.find(preset => preset.preset_id === id)!,\n}))\n"],
]
const RULE = '[data-studio-theme-picker="v2"] .stpv2-brandkit { margin: 12px 2px 4px; padding-top: 12px; border-top: 1px solid var(--stp-line); }\n'
// PASS2D A3 (NEXT_PUBLIC_STUDIO_THEME_BLANK_NOTE): the panel's edits for the blank-canvas note, as [text in the panel, the base's text]. Turning them back is how
// this test still proves the panel is the base commit's file; test-studio-theme-blank-note.mjs proves the edits themselves.
const A3_REVERSALS = [
  ["  type ThemeDropdownOption,\n  type ThemeDropdownPreviewData,\n} from './theme-dropdown-picker'",
   "  type ThemeDropdownOption,\n} from './theme-dropdown-picker'"],
  ["  onBuildThemeChange?: (selection: BuildThemeSelection) => void\n  /** PASS2D A3 (NEXT_PUBLIC_STUDIO_THEME_BLANK_NOTE): the deck is the blank canvas, and what to say about it (lib/studio-theme-blank-note). The viewer\n   *  passes it only with the flag on; absent, nothing differs. */\n  blankNote?: { note: string; previewNote: string }\n}",
   "  onBuildThemeChange?: (selection: BuildThemeSelection) => void\n}"],
  ["  onClose,\n  blankNote,\n}: {\n  locked: boolean",
   "  onClose,\n}: {\n  locked: boolean"],
  ["  onClose: () => void\n  /** PASS2D A3: the note for a blank canvas (shown only while the choice is open). Absent: nothing is drawn. */\n  blankNote?: string\n}) {",
   "  onClose: () => void\n}) {"],
  ["      {/* The blank-canvas note (A3) shares the lock notice's slot, so this child list has the base's shape with the flag off. */}\n      {locked ? (\n        <div data-studio-theme-notice=\"locked\" className=\"stpv2-notice stpv2-lock\">\n          <Lock className=\"h-3.5 w-3.5\" aria-hidden=\"true\" />\n          <span>This deck is already building or built, so its theme is fixed. Start a new chat to pick a different one.</span>\n        </div>\n      ) : blankNote ? (\n        <div data-studio-theme-notice=\"blank\" role=\"note\" className=\"stpv2-notice\">\n          <span>{blankNote}</span>\n        </div>\n      ) : false}\n",
   "      {locked && (\n        <div data-studio-theme-notice=\"locked\" className=\"stpv2-notice stpv2-lock\">\n          <Lock className=\"h-3.5 w-3.5\" aria-hidden=\"true\" />\n          <span>This deck is already building or built, so its theme is fixed. Start a new chat to pick a different one.</span>\n        </div>\n      )}\n"],
  ["  onBuildThemeChange,\n  blankNote: blankCopy,\n}: ThemePanelProps) {",
   "  onBuildThemeChange,\n}: ThemePanelProps) {"],
  ["    // PASS2D A3: on the blank canvas (flag on, the viewer passes blankNote) an applied theme is not painted until Director builds slides; say so.\n    const blankNote = blankCopy && !selectionLocked ? blankCopy : undefined\n",
   ""],
  ["      const dropdownPreview: ThemeDropdownPreviewData = draft.mode === 'auto' || !selectedTheme\n        ? { kind: 'auto' }\n        : themeDropdownPreview({\n          name: selectedTheme.name,\n          description: selectedTheme.description,\n          colors: selectedPreview,\n          overrides: draft.color_overrides,\n          fontSource: draft,\n        })\n      presetPicker = (",
   "      presetPicker = ("],
  ["          preview={blankNote && dropdownPreview.kind === 'theme' ? { ...dropdownPreview, applyNote: blankNote.previewNote } : dropdownPreview}\n",
   "          preview={draft.mode === 'auto' || !selectedTheme\n            ? { kind: 'auto' }\n            : themeDropdownPreview({\n              name: selectedTheme.name,\n              description: selectedTheme.description,\n              colors: selectedPreview,\n              overrides: draft.color_overrides,\n              fontSource: draft,\n            })}\n"],
  ["        onClose={onClose}\n        {...(blankNote ? { blankNote: blankNote.note } : {})}\n      />",
   "        onClose={onClose}\n      />"],
]
function proveSource(source, label = 'panel') {
  eq(source.split(CONSTS).length - 1, 1, `${label}: the custom-palette row const and the link const, once, before the hint`)
  eq(source.split(USE).length - 1, 1, `${label}: the body places the link beside the row, once`)
  eq(source.split(IMPORT).length - 1, 1, `${label}: the Link import, once`)
  eq(source.split(ICON).length - 1, 1, `${label}: the ArrowRight import, once`)
  eq((source.match(/process\.env\.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK/g) ?? []).length, 1, `${label}: the flag is read once, inline`)
  eq((source.match(/<Link /g) ?? []).length, 1, `${label}: one Link`)
  const at = source.indexOf(USE)
  ok(source.lastIndexOf(') : (\n          <>', at) > source.indexOf('<div className="stpv2-custom">') && source.indexOf('{advanced}', at) > at && source.indexOf('{presetPicker ?? <div className="stpv2-grid">') < at, `${label}: in the preset branch, after the cards, before {advanced}`)
  let reversed = source
  for (const [edited, original] of A3_REVERSALS) { eq(reversed.split(edited).length - 1, 1, `${label}: the blank-canvas note edit, once: ${edited.slice(0, 50)}`); reversed = reversed.replace(edited, () => original) }
  for (const [edited, original] of AUTO_PILL_REVERSALS) { eq(reversed.split(edited).length - 1, 1, `${label}: the auto-pill edit, once: ${edited.slice(0, 50)}`); reversed = reversed.replace(edited, () => original) }
  for (const [edited, original] of PLAIN_WORDS_REVERSALS) { eq(reversed.split(edited).length - 1, 1, `${label}: the plain-words edit, once: ${edited.slice(0, 50)}`); reversed = reversed.replace(edited, () => original) }
  eq(unP2c(reversed.replace(CONSTS, '').replace(USE, BASE_USE).replace(IMPORT, '').replace(ICON, '')), BASE[PANEL], `${label}: with the blank-canvas note edits, the two consts, the one body line, and the two imports turned back into the base's, the file is ${BASE_COMMIT}'s`)
  ok(source.indexOf('const hint = ') > source.indexOf(CONSTS), `${label}: with the flag off the body's last child is the base's own expression (no extra child)`)
}
function proveCss(css, label = 'css') {
  eq(css.split(RULE).length - 1, 1, `${label}: the rule, once`)
  eq(css.replace(RULE, ''), BASE[CSS], `${label}: without that rule the stylesheet is ${BASE_COMMIT}'s`)
  const rules = []
  postcss.parse(css).walkRules(rule => { if (rule.selector === '[data-studio-theme-picker="v2"] .stpv2-brandkit') rules.push(Object.fromEntries(rule.nodes.map(node => [node.prop, node.value]))) })
  ok(rules.length === 1 && rules[0].margin === '12px 2px 4px' && rules[0]['padding-top'] === '12px' && rules[0]['border-top'] === '1px solid var(--stp-line)', `${label}: .stpv2-brandkit is styled under the v2 picker`)
}
proveSource(SOURCES[PANEL]); proveCss(SOURCES[CSS])
match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK="false"$/m, 'documented in .env.example, default off')

// ---------------------------------------------------------------- 2. the panel, rendered
const transpiled = new Map()
const links = []
const lucide = new Proxy({}, { get: (_, name) => name === '__esModule' ? false : (props => React.createElement('svg', { 'data-icon': String(name), className: props?.className, 'aria-hidden': props?.['aria-hidden'] })) })
function loadPanel(source, env) {
  const cache = new Map()
  const stubs = {
    react: React, 'react/jsx-runtime': jsxRuntime, 'lucide-react': lucide,
    'next/link': { __esModule: true, default: ({ href, children, onClick, prefetch, ...rest }) => { links.push({ href, onClick, prefetch, rest }); return React.createElement('a', { href, ...rest }, children) } },
    '@/components/ui/button': { Button: ({ children, variant, className, disabled, onClick }) => React.createElement('button', { type: 'button', 'data-variant': variant, className, disabled }, children) },
    '@/lib/config': { getThemeBuilderUrl: () => 'http://127.0.0.1:9' }, '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
  }
  const requireFor = (spec, from) => {
    if (spec in stubs) return stubs[spec]
    if (spec.endsWith('.css')) return {}
    if (spec.startsWith('@/') || spec.startsWith('.')) { const base = spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : path.join(repoRoot, spec.slice(2)); const file = ['.ts', '.tsx'].map(suffix => base + suffix).find(candidate => fs.existsSync(candidate)); assert.ok(file, `unresolved import ${spec}`); return run(file) }
    throw new Error(`unexpected import ${spec} in ${path.relative(repoRoot, from)}`)
  }
  function run(file, text) {
    if (cache.has(file)) return cache.get(file)
    const mod = { exports: {} }
    cache.set(file, mod.exports)
    const code = text ?? fs.readFileSync(file, 'utf8'), key = `${path.relative(repoRoot, file)}\0${sha(code)}`
    if (!transpiled.has(key)) transpiled.set(key, compile(code, file))
    vm.runInNewContext(transpiled.get(key), { module: mod, exports: mod.exports, process: { env }, console, fetch: () => { throw new Error('no network') }, require: spec => requireFor(spec, file) })
    cache.set(file, mod.exports)
    return mod.exports
  }
  return run(path.join(repoRoot, PANEL), source).ThemePanel
}
const SYNC = {
  idle: { status: 'idle', requestId: null, presentationId: null, themeFingerprint: null, error: null },
  failed: { status: 'failed', requestId: 'r1', presentationId: 'deck-1', themeFingerprint: 'fp', error: 'The theme could not be applied.' },
}
const SELECTIONS = [
  ['auto', { mode: 'auto' }], ['preset', { mode: 'preset', preset_id: 'corporate_light' }],
  ['preset with overrides', { mode: 'preset', preset_id: 'vibrant', color_overrides: { accent: '#123456', surface: '#eeeeee' }, font_family: 'Lato' }],
  ['custom', { mode: 'custom', primary_hex: '#1e40af', secondary_hex: '#f59e0b' }], ['custom, bad colour', { mode: 'custom', primary_hex: 'nope' }],
]
// [name, env]: the picker the Studio shell draws, and the panels the flag must not change
const FLAVOURS = [
  ['lighter picker', { [SHELL]: 'true', [V2]: 'true' }, true], ['dropdown picker', { [SHELL]: 'true', [DROPDOWN]: 'true' }, true], ['both pickers', { [SHELL]: 'true', [V2]: 'true', [DROPDOWN]: 'true' }, true],
  ['plain Studio panel', { [SHELL]: 'true' }, false], ['picker flag without the shell', { [V2]: 'true' }, false], ['dropdown flag without the shell', { [DROPDOWN]: 'true' }, false], ['account panel', {}, false],
]
const OFF_VALUES = [undefined, '', 'false', 'FALSE', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'on']
const onClose = () => {}
const propsOf = (selection, locked, sync, isOpen = true) => ({ isOpen, onClose, presentationId: 'deck-1', buildThemeSelection: selection, themeSync: SYNC[sync], selectionLocked: locked, onBuildThemeChange() {} })
// How many <div>s are open at `to`, counting from the tag that starts at `from` (that tag is depth 1): 1 means a direct child of it.
const divDepth = (markup, from, to) => { let depth = 0; for (const [tag] of markup.slice(from, to).matchAll(/<div\b|<\/div>/g)) depth += tag === '</div>' ? -1 : 1; return depth }
const baseMarkups = new Map()
const BRAND_P = /<p class="stpv2-brandkit" data-studio-theme-part="brand-kit">.*?<\/p>/g
const LINK = /<a href="\/studio\/themes" class="stpv2-link" data-studio-theme-action="brand-kit"><svg data-icon="Palette" class="h-3\.5 w-3\.5" aria-hidden="true"><\/svg> Open themes &amp; brand kit <svg data-icon="ArrowRight" class="h-3\.5 w-3\.5" aria-hidden="true"><\/svg><\/a>/g
function proveMarkup(source, label = 'panel') {
  for (const [flavour, base, lighter] of FLAVOURS) {
    const loadFor = (src, extra) => { const env = { ...base, ...extra }; return { env, Panel: loadPanel(src, env) } }
    const work = loadFor(source, {}), baseline = loadFor(BASE[PANEL], {})
    const render = (world, props, value) => { delete world.env[FLAG]; if (value !== undefined) world.env[FLAG] = value; links.length = 0; return renderToStaticMarkup(React.createElement(world.Panel, props)) }
    for (const [name, selection] of SELECTIONS) {
      for (const locked of [false, true]) {
        for (const sync of ['idle', 'failed']) {
          const tag = `${label}: ${flavour}, ${name}, ${locked ? 'locked' : 'unlocked'}, ${sync} sync`
          const props = propsOf(selection, locked, sync), key = `${flavour}|${name}|${locked}|${sync}`
          if (!baseMarkups.has(key)) baseMarkups.set(key, render(baseline, props, undefined))
          const off = baseMarkups.get(key)
          for (const value of OFF_VALUES) { eq(render(work, props, value), off, `${tag}: flag ${JSON.stringify(value)} is the base`); eq(links.length, 0, `${tag}: no Link with flag ${JSON.stringify(value)}`) }
          const on = render(work, props, 'true')
          if (!lighter || selection.mode === 'custom') {
            eq(on, off, `${tag}: flag on changes nothing here${lighter ? ' (the custom-palette editor)' : ''}`); eq(links.length, 0, `${tag}: no Link here`); nomatch(on, /brand-kit|stpv2-brandkit/, `${tag}: no brand-kit markup`)
            continue
          }
          // the shell is read inline too (the picker is only reached with it, so this cannot change in a build; here it is switched off after the load to prove the read)
          const shellOff = world => { const saved = world.env[SHELL]; delete world.env[SHELL]; try { return render(world, props, world === work ? 'true' : undefined) } finally { world.env[SHELL] = saved } }
          const lateWork = shellOff(work), lateLinks = links.length
          eq(lateWork, shellOff(baseline), `${tag}: shell off after the load, flag "true", is the base`); eq(lateLinks, 0, `${tag}: no Link without the shell`)
          render(work, props, 'true')
          eq(links.length, 1, `${tag}: one Link`)
          eq(links[0].href, '/studio/themes', `${tag}: to the Themes & brand page`); eq(links[0].onClick, onClose, `${tag}: clicking closes the picker (onClick is onClose)`); eq(links[0].prefetch, false, `${tag}: no prefetch`)
          eq(on.split('data-studio-theme-action="brand-kit"').length - 1, 1, `${tag}: one brand-kit link`); eq(on.split('href="/studio/themes"').length - 1, 1, `${tag}: one href`)
          eq((on.match(LINK) ?? []).length, 1, `${tag}: the link, as written`); eq(on.split('Open themes &amp; brand kit').length - 1, 1, `${tag}: with its words`); eq((on.match(BRAND_P) ?? []).length, 1, `${tag}: in one paragraph`)
          eq(on.replace(BRAND_P, ''), off, `${tag}: without that paragraph the markup is the off markup`)
          const bodyAt = on.indexOf('<div data-studio-theme-part="body"'), footerAt = on.indexOf('<div data-studio-theme-part="footer"'), linkAt = on.indexOf('<p class="stpv2-brandkit"')
          ok(bodyAt > 0 && linkAt > bodyAt && linkAt < footerAt, `${tag}: after the body opens, before the footer`)
          eq(divDepth(on, bodyAt, linkAt), 1, `${tag}: a direct child of the body`)
          if (!locked) ok(linkAt > on.indexOf('Build a custom palette'), `${tag}: after the custom-palette row`)
          ok(linkAt > on.indexOf('data-studio-theme-preset='), `${tag}: after the preset cards`)
          match(on, /data-studio-theme-picker="v2"/, `${tag}: under the v2 picker the CSS rule is scoped to`)
          match(on, locked ? /is already building or built/ : />(Apply theme|Try again)</, `${tag}: the rest of the picker is there`)
        }
      }
    }
    const closedProps = propsOf({ mode: 'auto' }, false, 'idle', false)
    eq(render(work, closedProps, 'true'), render(baseline, closedProps, undefined), `${label}: ${flavour}, closed, flag on is the base`)
  }
}
proveMarkup(SOURCES[PANEL])

// ---------------------------------------------------------------- 4. mutation check
const moved = source => source.replace(USE, '            {customRow}\n').replace('            {presetPicker ?? <div className="stpv2-grid">', '            {brandKitLink}\n            {presetPicker ?? <div className="stpv2-grid">')
const MUTANTS = [
  [PANEL, 'flag read loosely', "process.env.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK === 'true'", "process.env.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK !== 'false'"],
  [PANEL, 'flag read as truthy', "process.env.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK === 'true' ? (", 'process.env.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK ? ('],
  [PANEL, 'flag name typo', 'process.env.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK ===', 'process.env.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINKS ==='],
  [PANEL, 'shell dropped', "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK", 'process.env.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK'],
  [PANEL, 'shell read loosely', "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK", "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== 'false' && process.env.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK"],
  [PANEL, 'shell or flag', "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK", "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' || process.env.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK"],
  [PANEL, 'flag ignored', "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK === 'true' ? (", "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? ("],
  [PANEL, 'never drawn', "process.env.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK === 'true' ? (", "process.env.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK === 'true' && false ? ("],
  [PANEL, 'unlocked only', "BRAND_LINK === 'true' ? (", "BRAND_LINK === 'true' && !locked ? ("],
  [PANEL, 'locked only', "BRAND_LINK === 'true' ? (", "BRAND_LINK === 'true' && locked ? ("],
  [PANEL, 'drawn in the custom editor too', '          <div className="stpv2-custom">\n', '          <div className="stpv2-custom">\n            {brandKitLink}\n'],
  [PANEL, 'moved before the cards', USE, source => moved(source)],
  [PANEL, 'moved out of the body', USE, source => source.replace(USE, '            {customRow}\n').replace('        {advanced}\n      </div>\n', '        {advanced}\n      </div>\n{brandKitLink}\n')],
  [PANEL, 'a trailing null child with the flag off', USE, '            {customRow}\n            {brandKitLink}\n', true],
  [PANEL, 'the row wrapped with the link in a div', USE, '            <div>{customRow}{brandKitLink}</div>\n', true],
  [PANEL, 'href changed', 'href="/studio/themes" prefetch', 'href="/studio/theme" prefetch'],
  [PANEL, 'opens another page', 'href="/studio/themes" prefetch', 'href="/studio/templates" prefetch'],
  [PANEL, 'prefetch on', ' prefetch={false} className="stpv2-link" data-studio-theme-action', ' className="stpv2-link" data-studio-theme-action'],
  [PANEL, 'does not close the picker', ' onClick={onClose}>\n        <Palette', '>\n        <Palette'],
  [PANEL, 'closes nothing else wired', ' onClick={onClose}>\n        <Palette', ' onClick={onApply}>\n        <Palette'],
  [PANEL, 'words changed', 'Open themes &amp; brand kit', 'Open theme &amp; brand kit'],
  [PANEL, 'words lowercased', 'Open themes &amp; brand kit', 'open themes &amp; brand kit'],
  [PANEL, 'action name changed', 'data-studio-theme-action="brand-kit"', 'data-studio-theme-action="brandkit"'],
  [PANEL, 'class renamed', '<p className="stpv2-brandkit"', '<p className="stpv2-brand"'],
  [PANEL, 'part renamed', 'data-studio-theme-part="brand-kit"', 'data-studio-theme-part="brand"'],
  [PANEL, 'link class changed', 'className="stpv2-link" data-studio-theme-action', 'className="stpv2-linkish" data-studio-theme-action'],
  [PANEL, 'arrow dropped', ' <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />\n      </Link>', '\n      </Link>'],
  [PANEL, 'icon dropped', '<Palette className="h-3.5 w-3.5" aria-hidden="true" /> Open', 'Open'],
  [PANEL, 'a second link', USE, '            {brandKitLink ? <>{customRow}{brandKitLink}{brandKitLink}</> : customRow}\n'],
  [PANEL, 'custom-palette row hidden under the flag', '  const customRow = !locked && (', "  const customRow = !locked && process.env.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK !== 'true' && ("],
  [PANEL, 'caption changed under the flag', 'Swatches show each theme’s main colours.', 'Swatches show each theme’s colours.'],
  [PANEL, 'Apply button changed', "'Apply theme'", "'Apply'"],
  [PANEL, 'ArrowRight import dropped', ICON, '', true],
  [PANEL, 'Link import from another module', "import Link from 'next/link'", "import Link from 'next/navigation'", true],
  [CSS, 'rule removed', RULE, ''],
  [CSS, 'rule unscoped', '[data-studio-theme-picker="v2"] .stpv2-brandkit {', '.stpv2-brandkit {'],
  [CSS, 'rule renamed', '.stpv2-brandkit {', '.stpv2-brand-kit {'],
  [CSS, 'rule margin changed', 'margin: 12px 2px 4px; padding-top: 12px; border-top: 1px solid var(--stp-line); }\n[data-studio-theme-picker="v2"] .stpv2-link {', 'margin: 0; padding-top: 12px; border-top: 1px solid var(--stp-line); }\n[data-studio-theme-picker="v2"] .stpv2-link {'],
  [CSS, 'neighbour rule changed', '.stpv2-link { display: inline-flex;', '.stpv2-link { display: flex;'],
]
let killed = 0
counting = false
for (const [file, name, from, to, sourceOnly] of MUTANTS) {
  const source = SOURCES[file]
  const mutated = typeof to === 'function' ? to(source) : (assert.ok(source.includes(from), `mutant "${name}": the text it replaces exists in ${file}`), source.replace(from, () => to))
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try {
    if (file === CSS) proveCss(mutated, name)
    else if (sourceOnly) proveSource(mutated, name) // an import the stubbed render cannot miss: the source pin kills it
    else proveMarkup(mutated, name) // a behaviour or markup change: the rendered panels alone must kill it
    survived = true
  } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  assert.ok(!survived, `mutant survived: ${name}`)
}
counting = true
eq(killed, MUTANTS.length)

console.log(`Studio theme picker brand link (G35): ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
