// FRONTEND-1 (Studio UX review UX-23/24/25): accessibility basics, always on (no flag).
//   node scripts/test-studio-a11y-basics.mjs   (plain node, sources read as text; no network, no browser)
//   A. Settings > Notifications and Settings > Privacy: every <Switch> is named by aria-labelledby pointing at the id of its row's visible <Label>.
//   B. Intelligence: every task button (sp-workflow-task) carries aria-label = the task's name.
//   C. The disabled primary button (.sl-primary:disabled) draws from shared tokens; the ratios are COMPUTED from the token values, light and dark:
//      text on fill >= 4.5:1, outline on the page background and panel >= 3:1 (WCAG AA 1.4.11); no opacity fade; the themes override uses the same tokens.
//   D. MUTANTS: every one must be caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const NOTIF = 'app/(app)/settings/notifications/page.tsx', PRIV = 'app/(app)/settings/privacy/page.tsx', INTEL = 'components/studio-personal/intelligence-workspace.tsx'
const LIBCSS = 'components/studio-libraries/libraries.css', THEMES = 'components/studio-libraries/themes-fidelity.css'
const SOURCES = Object.fromEntries([NOTIF, PRIV, INTEL, LIBCSS, THEMES].map(rel => [rel, fs.readFileSync(path.join(root, rel), 'utf8')]))

const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
export const ratio = (a, b) => { const [lo, hi] = [lum(a), lum(b)].sort((x, y) => x - y); return (hi + 0.05) / (lo + 0.05) }
/** The custom properties declared in the first block whose selector is exactly `selector`. */
function tokens(css, selector) {
  const at = css.indexOf(`${selector} {`); assert.ok(at >= 0, `block ${selector}`)
  const body = css.slice(at, css.indexOf('}', at)); const out = {}
  for (const m of body.matchAll(/(--sl-[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2].toLowerCase()
  return out
}
/** Each <Switch ...> opening tag in the text. */
const switches = text => [...text.matchAll(/<Switch\b([\s\S]*?)\/>/g)].map(m => m[1])

function suite(src, run) {
  for (const rel of [NOTIF, PRIV]) {
    run(`A: ${rel}: every Switch has aria-labelledby naming a visible Label's id`, () => {
      const text = src[rel]; const tags = switches(text); assert.ok(tags.length >= 2, 'both the Studio and the legacy switch')
      for (const tag of tags) {
        const m = tag.match(/aria-labelledby=(?:"([^"]+)"|\{`([^`]+)`\})/); assert.ok(m, `no aria-labelledby: ${tag.slice(0, 80)}`)
        const ref = m[1] ?? m[2]
        const labelIds = [...text.matchAll(/<Label\b[^>]*\bid=(?:"([^"]+)"|\{`([^`]+)`\})[^>]*>/g)].map(x => x[1] ?? x[2])
        assert.ok(labelIds.includes(ref), `aria-labelledby ${ref} points at no Label id (${labelIds.join(', ')})`)
      }
    })
  }
  run('B: every Intelligence task button carries aria-label with the task name', () => {
    const tags = [...src[INTEL].matchAll(/<button\b[^>]*className="sp-workflow-task"[^>]*>/g)].map(m => m[0]); assert.ok(tags.length >= 1, 'a task button')
    for (const tag of tags) assert.match(tag, /aria-label=\{catalog\.tasks\[id\]\.label\}/)
  })
  run('C: the disabled primary: shared tokens, text >= 4.5:1 on its fill, outline >= 3:1 on background and panel, light and dark; no fade', () => {
    const css = src[LIBCSS]
    for (const sel of ['.studio-library', '.dark .studio-library']) {
      const t = tokens(css, sel)
      for (const k of ['--sl-disabled-bg', '--sl-disabled-text', '--sl-disabled-line', '--sl-bg', '--sl-panel']) assert.ok(t[k], `${sel} ${k}`)
      assert.ok(ratio(t['--sl-disabled-text'], t['--sl-disabled-bg']) >= 4.5, `${sel} text ${ratio(t['--sl-disabled-text'], t['--sl-disabled-bg']).toFixed(2)}`)
      for (const bg of ['--sl-bg', '--sl-panel']) assert.ok(ratio(t['--sl-disabled-line'], t[bg]) >= 3, `${sel} outline on ${bg} ${ratio(t['--sl-disabled-line'], t[bg]).toFixed(2)}`)
    }
    const rule = css.match(/\.studio-library \.sl-primary:disabled \{([^}]*)\}/); assert.ok(rule, 'the shared disabled rule')
    for (const want of ['opacity: 1', 'background: var(--sl-disabled-bg)', 'border-color: var(--sl-disabled-line)', 'color: var(--sl-disabled-text)']) assert.ok(rule[1].includes(want), want)
    const theme = src[THEMES].match(/\.sl-primary:disabled \{([^}]*)\}/); assert.ok(theme, 'the themes override keeps the disabled tokens')
    for (const want of ['background: var(--sl-disabled-bg)', 'border-color: var(--sl-disabled-line)', 'color: var(--sl-disabled-text)']) assert.ok(theme[1].includes(want), `themes ${want}`)
    assert.ok(ratio('#ffffff', '#287b78') >= 4.5, 'the enabled primary is untouched and passes')
  })
}

let passed = 0; const failed = []
suite(SOURCES, (label, fn) => { try { fn(); passed++; console.log(`PASS ${label}`) } catch (e) { failed.push(label); console.error(`FAIL ${label}: ${e.message}`) } })

const swap = (text, from, to) => { assert.equal(text.split(from).length, 2, `exactly one ${from.slice(0, 80)}`); return text.replace(from, () => to) }
const MUTANTS = [
  ['notifications: the Studio switch loses its label', NOTIF, '<Switch id={id} aria-labelledby={`${id}-label`} checked=', '<Switch id={id} checked='],
  ['notifications: the legacy switch loses its label', NOTIF, '                  aria-labelledby={`notification-legacy-${row.key}-label`}\n', ''],
  ['notifications: the Label has no id', NOTIF, '<Label htmlFor={id} id={`${id}-label`}>', '<Label htmlFor={id}>'],
  ['privacy: the Studio switch loses its label', PRIV, ' aria-labelledby="privacy-activity-label" checked=', ' checked='],
  ['privacy: the legacy switch points nowhere', PRIV, 'aria-labelledby="privacy-activity-legacy-label"', 'aria-labelledby="privacy-activity-nowhere"'],
  ['intelligence: the task button has no name', INTEL, ' aria-label={catalog.tasks[id].label} aria-pressed', ' aria-pressed'],
  ['tokens: light disabled text too pale', LIBCSS, '--sl-disabled-text: #5a6862;', '--sl-disabled-text: #9aa59f;'],
  ['tokens: light outline too faint', LIBCSS, '--sl-disabled-line: #7a8a81;', '--sl-disabled-line: #c5d0c8;'],
  ['tokens: dark disabled text too dim', LIBCSS, '--sl-disabled-text: #afbeb3;', '--sl-disabled-text: #55665d;'],
  ['rule: the fade is back', LIBCSS, '.sl-primary:disabled { opacity: 1;', '.sl-primary:disabled { opacity: .5;'],
  ['rule: the shared disabled rule is gone', LIBCSS, '.studio-library .sl-primary:disabled {', '.studio-library .sl-primary-x:disabled {'],
  ['themes: the override drops the tokens', THEMES, '.sl-primary:disabled { background: var(--sl-disabled-bg);', '.sl-primary:disabled { background: var(--sl-teal);'],
]
let caught = 0; const missed = []
for (const [label, rel, from, to] of MUTANTS) {
  const fails = []; suite({ ...SOURCES, [rel]: swap(SOURCES[rel], from, to) }, (name, fn) => { try { fn() } catch { fails.push(name) } })
  if (fails.length) { caught++; console.log(`CAUGHT mutant ${label}`) } else { missed.push(label); console.error(`MISSED mutant ${label}`) }
}
console.log(`${passed} checks passed, ${failed.length} failed; ${caught} mutants caught, ${missed.length} missed`)
if (failed.length || missed.length) process.exit(1)
console.log('test-studio-a11y-basics: all passed')
