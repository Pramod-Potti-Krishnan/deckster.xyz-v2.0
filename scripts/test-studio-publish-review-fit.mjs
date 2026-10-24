// FRONTEND-2: the Publish wizard's setup grid no longer scrolls sideways at phone width (flag NEXT_PUBLIC_STUDIO_PUBLISH_REVIEW_FIT, exact "true", default off,
// build-time). The finding (E2E-2, Studio dev, 24 Oct, finding F3): at 390 px the Review step's grid (.studio-publish-setup-grid) has scrollWidth 332 against clientWidth
// 328 and overflow-x: auto, so the step scrolls sideways and the right-hand tiles lose their edge.
//
// Cause. The 4 px is the Pass 2 polish change's own (PP-1, NEXT_PUBLIC_STUDIO_P2_POLISH): `.studio-publish-step-body { padding: 4px; margin: -4px }`, there so the focus rings of
// controls at the body's edges are not clipped by the body's own scrolling (desktop, where the body is the scroller). At 700 px and below the body stops scrolling and the grid is
// the one scroller (overflow-y: auto, so overflow-x is auto too) over ONE 1fr column, but the negative margin stays: the body is a stretched grid item whose margin box is the track,
// so its border box is 8 px wider than the track and sits 4 px to the left; its right edge is 4 px past the grid's, and that 4 px is scrollable overflow (328 + 4 = 332).
// Fix. A phone-only rule, appended after the polish block and scoped to html[data-studio-publish-review-fit="true"] (which hooks/use-studio-publish-review-fit.ts sets only with the
// flag on), gives the body no padding and no margin: it is exactly its track, its content box (the track) is where it was, nothing is hidden and no overflow is clipped.
//
//   node scripts/test-studio-publish-review-fit.mjs              # everything, offline, plain node (no network, no build, no browser)
//   node scripts/test-studio-publish-review-fit.mjs --no-mutants
//
// What it proves:
//  1. the REAL stylesheet (components/studio-publish.css) is parsed (rules, @media, selectors, specificity, source order) and the cascade is evaluated for the real element chain of the
//     dialog (html > body > dialog > body > wizard > grid > step body): the step body's padding and margin at 390 are 4 / -4 with the flag off (the finding's cause) and 0 / 0 with it
//     on; the real layout arithmetic (a stretched item in the grid's 1fr track) gives scrollWidth 332 over clientWidth 328 with the flag off (the finding's own numbers) and 328 over 328 with
//     it on, at every phone width 320..700, with the content box and the review tiles' edges exactly where they were; at 701 px and above, and for every other element, the two are identical;
//  2. flag off, the whole stylesheet's computed values for the dialog's elements, at widths from 320 to 1920, are identical (sha256) to the BASE stylesheet's;
//  3. the REAL hook, mounted with the repo's mini React host: with the flag on it sets the attribute on <html> once and takes it off on unmount; off (unset and eight other spellings)
//     it touches nothing; the attribute name in the hook is the one the stylesheet is scoped to;
//  4. the page (one import, one unconditional call at the top of the component body), .env.example, the strip module gives back BASE_COMMIT's files byte for byte, the three shared strip
//     roots chain it, the Pass 2 polish strip cuts this block off with its own, and STACKED_PASS3_FILES;
//  5. a strict secret scan of every line this change adds;
//  6. mutants, each caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { Root } from './studio-chat-harness/mini-react.mjs'
import { createEnvironment } from './studio-chat-harness/fake-env.mjs'
import { createModuleLoader } from './studio-chat-harness/module-loader.mjs'
import { BASE_ENV } from './studio-chat-harness/profiles.mjs'
import { BASE_COMMIT, PUBLISH_REVIEW_FIT_FILES, PUBLISH_REVIEW_FIT_NEW_FILES, PUBLISH_REVIEW_FIT_CHANGES, PUBLISH_REVIEW_FIT_CSS_SELECTOR, stripPublishReviewFit } from './studio-publish-review-fit-strip.mjs'
import { stripP2Polish } from './studio-p2-polish-strip.mjs'
import { stripVersionHistoryDeckOnly } from './studio-version-history-deck-only-strip.mjs' // stacked: #493, after this change
import { stripComposeEntitlement } from './studio-compose-entitlement-strip.mjs' // stacked: #494, after this change
import { stripOpenReadOnly } from './studio-open-read-only-strip.mjs'
import { stripDarkPersist } from './studio-theme-dark-persist-strip.mjs'
import { stripAddSlideStatus } from './studio-add-slide-status-strip.mjs'
import { STACKED_PASS3_FILES } from './studio-library-manage-harness.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
const baseFile = rel => git('show', `${BASE_COMMIT}:${rel}`)
const NO_MUTANTS = process.argv.includes('--no-mutants')

const FLAG = 'NEXT_PUBLIC_STUDIO_PUBLISH_REVIEW_FIT'
const ATTR = 'data-studio-publish-review-fit'
const CSS = 'components/studio-publish.css'
const HOOK = 'hooks/use-studio-publish-review-fit.ts'
const PAGE = 'app/builder/page.tsx'
const ENV = '.env.example'

let checks = 0
const failures = []
let sink = null // a mutant run: a failing check is recorded here, quietly
async function check(label, fn) {
  if (sink) { try { await fn() } catch { sink.push(label) } return }
  try { await fn(); checks++; console.log(`PASS ${label}`) } catch (error) { failures.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 4).join(' | ') ?? error}`) }
}
function mutate(rel, from, to, text = read(rel)) {
  assert.equal(text.split(from).length - 1, 1, `${rel}: the mutant's text occurs once: ${JSON.stringify(from.slice(0, 70))}`)
  return text.replace(from, () => to)
}

// ---- a small CSS reader and cascade: rules, @media, selectors, specificity, source order ---------------------------------------------------------
function parseCss(text) {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = []
  let order = 0
  function block(from, media) {
    let i = from
    while (i < src.length) {
      while (i < src.length && /\s/.test(src[i])) i++
      if (i >= src.length || src[i] === '}') return i
      const open = src.indexOf('{', i)
      assert.ok(open > i, 'a rule has a block')
      const prelude = src.slice(i, open).trim()
      if (prelude.startsWith('@')) {
        if (/^@media\b/.test(prelude)) { const end = block(open + 1, [...media, prelude.replace(/^@media\s*/, '')]); i = end + 1; continue }
        let depth = 1, j = open + 1
        while (depth > 0) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++ }
        i = j; continue
      }
      let depth = 1, j = open + 1
      while (depth > 0) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++ }
      const body = src.slice(open + 1, j - 1)
      const decls = []
      let cur = '', paren = 0, quote = ''
      for (const ch of body) {
        if (quote) { cur += ch; if (ch === quote) quote = ''; continue }
        if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue }
        if (ch === '(') paren++
        if (ch === ')') paren--
        if (ch === ';' && paren === 0) { decls.push(cur); cur = ''; continue }
        cur += ch
      }
      if (cur.trim()) decls.push(cur)
      const declarations = decls.map(d => { const k = d.indexOf(':'); return k < 0 ? null : [d.slice(0, k).trim().toLowerCase(), d.slice(k + 1).trim()] }).filter(Boolean)
      for (const selector of splitTop(prelude, ',')) rules.push({ selector: selector.trim(), media, declarations, order: order++ })
      i = j
    }
    return i
  }
  block(0, [])
  return rules
}
function splitTop(text, sep) {
  const out = []
  let depth = 0, cur = ''
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++
    if (ch === ')' || ch === ']') depth--
    if (ch === sep && depth === 0) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) out.push(cur)
  return out
}
/** A media query list item as true or false at this viewport; anything it does not know is false (reduced motion, print, hover). */
function mediaApplies(queries, view) {
  return queries.every(query => query.split(/\s+and\s+/).every(part => {
    if (part.trim() === 'screen') return true
    const m = part.trim().match(/^\((min|max)-(width|height):\s*(\d+)px\)$/)
    if (!m) return false
    const value = view[m[2]]
    return m[1] === 'min' ? value >= Number(m[3]) : value <= Number(m[3])
  }))
}
// selectors: compounds joined by ' ' or '>' ; a compound is tag, .class, #id, [attr], [attr="v"], :is(...) / :where(...); any other pseudo-class is unsupported
function parseCompound(text) {
  const parts = { tag: null, classes: [], attrs: [], ids: [], is: [], unsupported: [] }
  let rest = text.trim()
  const tag = rest.match(/^[a-zA-Z][a-zA-Z0-9-]*|^\*/)
  if (tag) { parts.tag = tag[0] === '*' ? null : tag[0].toLowerCase(); rest = rest.slice(tag[0].length) }
  while (rest) {
    let m
    if ((m = rest.match(/^\.([A-Za-z0-9_-]+)/))) parts.classes.push(m[1])
    else if ((m = rest.match(/^#([A-Za-z0-9_-]+)/))) parts.ids.push(m[1])
    else if ((m = rest.match(/^\[([A-Za-z0-9_-]+)(?:([~|^$*]?=)(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/))) parts.attrs.push([m[1], m[2] ?? null, m[3] ?? m[4] ?? m[5] ?? null])
    else if ((m = rest.match(/^:(is|where)\(/))) {
      let depth = 1, j = m[0].length
      while (depth > 0) { if (rest[j] === '(') depth++; else if (rest[j] === ')') depth--; j++ }
      parts.is.push({ kind: m[1], list: splitTop(rest.slice(m[0].length, j - 1), ',').map(parseCompound) })
      rest = rest.slice(j); continue
    } else if ((m = rest.match(/^::?[a-zA-Z-]+(\([^)]*\))?/))) parts.unsupported.push(m[0])
    else throw new Error(`css reader: cannot read ${JSON.stringify(rest.slice(0, 40))}`)
    rest = rest.slice(m[0].length)
  }
  return parts
}
const selectorCache = new Map() // a selector's text always parses the same
function parseSelector(text) {
  if (!selectorCache.has(text)) selectorCache.set(text, parseSelectorUncached(text))
  return selectorCache.get(text)
}
function parseSelectorUncached(text) {
  const tokens = []
  let cur = '', depth = 0
  const flush = () => { if (cur.trim()) tokens.push({ compound: parseCompound(cur) }); cur = '' }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(' || ch === '[') depth++
    if (ch === ')' || ch === ']') depth--
    if (depth === 0 && (ch === '>' || ch === '+' || ch === '~' || /\s/.test(ch))) {
      flush()
      if (ch === '>' || ch === '+' || ch === '~') tokens.push({ combinator: ch })
      else if (tokens.length && !tokens.at(-1).combinator) tokens.push({ combinator: ' ' })
      continue
    }
    cur += ch
  }
  flush()
  const out = []
  for (const token of tokens) { if (token.combinator && out.length && out.at(-1).combinator) { if (token.combinator === '>') out[out.length - 1] = token; continue } out.push(token) }
  while (out.length && out.at(-1).combinator) out.pop()
  return out
}
function attrMatches(actual, op, value) {
  if (op === null) return true
  if (op === '=') return actual === value
  if (op === '*=') return value !== '' && actual.includes(value)
  if (op === '^=') return value !== '' && actual.startsWith(value)
  if (op === '$=') return value !== '' && actual.endsWith(value)
  if (op === '~=') return actual.split(/\s+/).includes(value)
  if (op === '|=') return actual === value || actual.startsWith(`${value}-`)
  throw new Error(`css reader: attribute operator ${op}`)
}
const compoundMatches = (c, el) => (!c.tag || el.tag === c.tag) && c.classes.every(x => el.classes.includes(x)) && c.ids.every(x => el.id === x)
  && c.attrs.every(([name, op, value]) => name in el.attrs && attrMatches(el.attrs[name], op, value)) && c.unsupported.length === 0
  && c.is.every(group => group.list.some(item => compoundMatches(item, el)))
function selectorMatches(tokens, el) {
  const walk = (index, element) => {
    if (!element || !compoundMatches(tokens[index].compound, element)) return false
    if (index === 0) return true
    const combinator = tokens[index - 1].combinator, prev = index - 2
    if (combinator === '>') return walk(prev, element.parent)
    if (combinator === '+') return walk(prev, element.prev)
    if (combinator === '~') { for (let before = element.prev; before; before = before.prev) if (walk(prev, before)) return true; return false }
    for (let up = element.parent; up; up = up.parent) if (walk(prev, up)) return true
    return false
  }
  return walk(tokens.length - 1, el)
}
const specificityOf = c => { // [ids, classes + attributes + pseudo-classes, elements]
  let a = c.ids.length, b = c.classes.length + c.attrs.length + c.unsupported.length, k = c.tag ? 1 : 0
  for (const group of c.is) { const best = group.list.map(specificityOf).sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]).at(-1); a += best[0]; b += best[1]; k += best[2] }
  return [a, b, k]
}
const specificityCache = new Map()
const selectorSpecificity = tokens => { if (!specificityCache.has(tokens)) specificityCache.set(tokens, tokens.filter(t => t.compound).map(t => specificityOf(t.compound)).reduce((s, x) => [s[0] + x[0], s[1] + x[1], s[2] + x[2]], [0, 0, 0])); return specificityCache.get(tokens) }
const lengthPx = value => { const m = String(value).trim().match(/^(-?\d+(?:\.\d+)?)(px)?$/); return m ? Number(m[1]) : null }
function sides(value) {
  const v = value.trim().split(/\s+/).map(lengthPx)
  if (v.some(x => x === null)) return null
  const [t, r = t, b = t, l = r] = v
  return { top: t, right: r, bottom: b, left: l }
}

/** The dialog's element chain. `fit` is whether the page set the attribute on <html>. */
function dialogChain(fit) {
  const el = (tag, classes, attrs, parent, prev = null) => ({ tag, classes, attrs: classes.length ? { ...attrs, class: classes.join(' ') } : attrs, parent, prev, id: null })
  const html = el('html', [], fit ? { [ATTR]: 'true' } : {}, null)
  const body = el('body', [], {}, html)
  const dialog = el('div', ['sm:max-w-2xl'], { 'data-studio-v4-shell': 'true', 'data-studio-publish': 'true' }, body)
  const dbody = el('div', ['studio-publish-body'], {}, dialog)
  const wizard = el('div', ['space-y-4', 'studio-publish-wizard'], { 'data-studio-publish-wizard': 'true', 'data-p2-polish': 'true' }, dbody)
  const grid = el('div', ['studio-publish-setup-grid'], {}, wizard)
  const stepBody = el('div', ['min-h-[13rem]', 'studio-publish-step-body'], {}, grid)
  const aside = el('aside', ['studio-publish-viewer-summary'], {}, grid, stepBody)
  return { html, dialog, dbody, wizard, grid, stepBody, aside }
}
/** Computed values (the ones this reader models) of one element from a stylesheet at a viewport; also returns the rules it could not read that name an element of the chain. */
function computed(cssRules, el, view) {
  const matching = []
  for (const rule of cssRules) {
    if (!mediaApplies(rule.media, view)) continue
    const tokens = parseSelector(rule.selector)
    if (!tokens.length || !selectorMatches(tokens, el)) continue
    matching.push({ rule, specificity: selectorSpecificity(tokens) })
  }
  matching.sort((x, y) => x.specificity[0] - y.specificity[0] || x.specificity[1] - y.specificity[1] || x.specificity[2] - y.specificity[2] || x.rule.order - y.rule.order)
  const out = {}
  for (const { rule } of matching) for (const [prop, value] of rule.declarations) {
    assert.ok(!/!important/.test(value), `${rule.selector}: no !important in a rule this reader orders`)
    if (prop === 'margin' || prop === 'padding') { const s = sides(value); if (s) for (const side of Object.keys(s)) out[`${prop}-${side}`] = s[side]; else out[prop] = value; continue }
    out[prop] = /^-?\d+(\.\d+)?px$/.test(value) ? lengthPx(value) : value
  }
  return out
}
const VIEW = width => ({ width, height: 844 })

/**
 * The layout of the setup grid at a phone width, from the computed values: ONE 1fr column (grid-template-columns: 1fr), the grid is the scroller (overflow-y: auto, so overflow-x: auto),
 * and the body is a stretched item whose margin box is the track. `client` is the grid's clientWidth.
 */
function phoneLayout(client, body) {
  const ml = body['margin-left'] ?? 0, mr = body['margin-right'] ?? 0, pl = body['padding-left'] ?? 0, pr = body['padding-right'] ?? 0
  const left = ml, width = client - ml - mr, right = left + width
  return { scrollWidth: Math.max(client, right), overflowX: Math.max(0, right - client), bodyLeft: left, bodyWidth: width, contentLeft: left + pl, contentRight: right - pr }
}
const columnsOf = (text, selector) => { const m = text.match(new RegExp(`${selector.replace(/[.[\]()>:^$*+?{}|\\]/g, '\\$&')}\\s*\\{[^}]*\\}`)); return m ? m[0] : null }

async function cascadeChecks(cssText = read(CSS), { ratchet = true } = {}) {
  const css = parseCss(cssText)
  const baseCss = parseCss(baseFile(CSS))
  await check('cascade: with the flag off the step body at 390 has padding 4 and margin -4 (PP-1\'s rule, the finding\'s cause); the grid is one 1fr column and the scroller', () => {
    const on = dialogChain(false)
    const body = computed(css, on.stepBody, VIEW(390))
    assert.deepEqual([body['padding-left'], body['padding-right'], body['margin-left'], body['margin-right']], [4, 4, -4, -4])
    const grid = computed(css, on.grid, VIEW(390))
    assert.equal(grid['grid-template-columns'], '1fr', 'one column at phone width')
    assert.match(String(grid['overflow-y']), /^auto$/, 'the grid is the scroller on a phone (so overflow-x is auto too)')
    assert.equal(grid['overflow-x'], undefined, 'no overflow-x of its own: it computes to auto from overflow-y')
    const desktop = computed(css, on.stepBody, VIEW(1600))
    assert.deepEqual([desktop['padding-left'], desktop['margin-left'], desktop['overflow-y']], [4, -4, 'auto'], 'at desktop the body is its own scroller, which is what the 4 px is for')
  })
  await check('layout: the model reproduces the finding with the flag off (scrollWidth 332 over clientWidth 328 at 390) and shows 328 over 328 with it on', () => {
    const off = phoneLayout(328, computed(css, dialogChain(false).stepBody, VIEW(390)))
    assert.deepEqual([off.scrollWidth, off.overflowX], [332, 4], "E2E-2's measured numbers")
    const on = phoneLayout(328, computed(css, dialogChain(true).stepBody, VIEW(390)))
    assert.deepEqual([on.scrollWidth, on.overflowX], [328, 0], 'no sideways scroll')
    assert.deepEqual([on.contentLeft, on.contentRight], [off.contentLeft, off.contentRight], 'the content box does not move')
    assert.deepEqual([on.contentLeft, on.contentRight], [0, 328])
  })
  await check('layout: every phone width from 320 to 700 and every grid width: no overflow with the flag on, 4 px with it off; content box and the Review tiles unchanged', () => {
    const tileRule = css.find(rule => rule.selector.includes('ul:has(.studio-publish-summary-row)'))
    assert.ok(tileRule, 'the Review tiles rule')
    const cols = tileRule.declarations.find(([p]) => p === 'grid-template-columns')[1]
    const gap = lengthPx(tileRule.declarations.find(([p]) => p === 'gap')[1])
    assert.equal(cols, 'repeat(2, minmax(0, 1fr))')
    for (const width of [320, 360, 375, 390, 412, 430, 480, 520, 600, 700]) for (const client of [width - 62, width - 60, 328, width - 40]) {
      const off = phoneLayout(client, computed(css, dialogChain(false).stepBody, VIEW(width)))
      const on = phoneLayout(client, computed(css, dialogChain(true).stepBody, VIEW(width)))
      assert.equal(off.overflowX, 4, `${width}/${client}: the flag off keeps the 4 px`)
      assert.equal(on.overflowX, 0, `${width}/${client}: no overflow`)
      assert.equal(on.scrollWidth, client)
      assert.deepEqual([on.contentLeft, on.contentRight], [off.contentLeft, off.contentRight], `${width}/${client}: same content box`)
      const tile = (on.contentRight - on.contentLeft - gap) / 2, rightTileEdge = on.contentLeft + tile + gap + tile
      assert.equal(rightTileEdge, client, `${width}/${client}: the right-hand tiles end exactly at the grid's edge, border included`)
      assert.ok(rightTileEdge <= on.scrollWidth)
    }
  })
  await check('cascade: the new rule wins over PP-1\'s (higher specificity and later), only at 700 px and below, only for the step body, only with the attribute', () => {
    const mine = css.filter(rule => rule.selector === PUBLISH_REVIEW_FIT_CSS_SELECTOR)
    assert.equal(mine.length, 1, 'one rule')
    assert.deepEqual(mine[0].media, ['screen and (max-width: 700px)'])
    assert.deepEqual(mine[0].declarations, [['padding', '0'], ['margin', '0']])
    const polish = css.find(rule => rule.selector === '[data-studio-publish="true"] .studio-publish-wizard[data-p2-polish="true"] > .studio-publish-setup-grid > .studio-publish-step-body')
    const mineSpec = selectorSpecificity(parseSelector(mine[0].selector)), polishSpec = selectorSpecificity(parseSelector(polish.selector))
    assert.ok(mineSpec[0] > polishSpec[0] || (mineSpec[1] > polishSpec[1]) || (mineSpec[1] === polishSpec[1] && mineSpec[2] > polishSpec[2]), `${mineSpec} over ${polishSpec}`)
    assert.ok(mine[0].order > polish.order, 'and later in the file')
    const chain = dialogChain(true)
    for (const [name, el] of Object.entries({ html: chain.html, dialog: chain.dialog, dbody: chain.dbody, wizard: chain.wizard, grid: chain.grid, aside: chain.aside }))
      assert.ok(!selectorMatches(parseSelector(mine[0].selector), el), `${name} is not the step body`)
    assert.ok(!selectorMatches(parseSelector(mine[0].selector), dialogChain(false).stepBody), 'not without the attribute')
    // a wizard without the polish attribute (the polish flag off) is not touched either: the rule is PP-1's to fix
    const noPolish = dialogChain(true); noPolish.wizard.attrs = { 'data-studio-publish-wizard': 'true' }
    assert.ok(!selectorMatches(parseSelector(mine[0].selector), noPolish.stepBody), 'not without the polish attribute')
  })
  await check('no rule of this change hides or clips overflow (the 4 px is removed, not covered up)', () => {
    const block = parseCss(cssText.slice(cssText.indexOf('/* NEXT_PUBLIC_STUDIO_PUBLISH_REVIEW_FIT')))
    assert.ok(block.length >= 1)
    for (const rule of block) assert.deepEqual(rule.declarations.map(([prop]) => prop).sort(), ['margin', 'padding'], `${rule.selector}: only padding and margin (no overflow, clip, visibility, display or width)`)
  })
  await check('flag off: the whole stylesheet computes to the BASE stylesheet\'s values for every element of the dialog at widths 320 to 1920 (sha256); with the flag on only the step body below 701 px differs', () => {
    const names = ['dialog', 'dbody', 'wizard', 'grid', 'stepBody', 'aside']
    const view = (rules, fit, width) => { const chain = dialogChain(fit); return Object.fromEntries(names.map(name => [name, computed(rules, chain[name], VIEW(width))])) }
    const widths = [320, 360, 390, 428, 520, 600, 700, 701, 768, 1024, 1280, 1440, 1600, 1920]
    const baseHash = sha(JSON.stringify(widths.map(w => view(baseCss, false, w))))
    assert.equal(sha(JSON.stringify(widths.map(w => view(css, false, w)))), baseHash, 'flag off')
    for (const w of widths) {
      const off = view(css, false, w), on = view(css, true, w)
      if (w <= 700) { assert.notDeepEqual(on.stepBody, off.stepBody, `${w}: the body changes`); const { stepBody: a, ...restOn } = on, { stepBody: b, ...restOff } = off; assert.deepEqual(restOn, restOff, `${w}: nothing else changes`) }
      else assert.deepEqual(on, off, `${w}: wide windows are identical`)
    }
    console.log(`flag-off computed-style sha256 ${baseHash.slice(0, 16)} == base`)
  })
  await check('every rule of the stylesheet that names the step body is read by this reader (nothing it cannot read could change the result)', () => {
    let subjects = 0
    for (const rule of css) {
      const tokens = parseSelector(rule.selector)
      const subject = tokens.at(-1).compound
      const names = c => c.classes.includes('studio-publish-step-body') || c.is.some(g => g.list.some(names))
      if (!names(subject)) continue // a rule about something inside the body (a :has(), a descendant) cannot be about the body itself
      subjects++
      const unsupported = tokens.filter(t => t.compound).flatMap(t => [...t.compound.unsupported, ...t.compound.is.flatMap(g => g.list.flatMap(c => c.unsupported))])
      assert.deepEqual(unsupported, [], `${rule.selector}: a rule whose subject is the step body is read in full (classes, attributes, :is and combinators)`)
    }
    assert.ok(subjects >= 3, `the body's own rules read: ${subjects}`)
    const wizardRules = css.filter(rule => /studio-publish-setup-grid/.test(rule.selector) && !/studio-publish-step-body|viewer-summary/.test(rule.selector))
    assert.ok(wizardRules.length >= 3)
  })
  if (ratchet) await check('the stylesheet\'s own addition is one block after the polish block: the polish strip cuts it off with its own, byte for byte', () => {
    assert.equal(stripP2Polish(CSS, cssText), stripP2Polish(CSS, baseFile(CSS)))
    assert.ok(cssText.indexOf('/* NEXT_PUBLIC_STUDIO_PUBLISH_REVIEW_FIT') > cssText.indexOf('/* NEXT_PUBLIC_STUDIO_P2_POLISH ('))
  })
}

// ---- 3. the hook ---------------------------------------------------------------------------------------------------------------------------
async function hookChecks(texts = {}) {
  const mount = async flag => {
    const env = createEnvironment({ processEnv: { ...BASE_ENV, ...(flag === undefined ? {} : { [FLAG]: flag }) } })
    const calls = []
    const attrs = new Map()
    const documentElement = { setAttribute: (name, value) => { calls.push(['set', name, value]); attrs.set(name, value) }, removeAttribute: name => { calls.push(['remove', name]); attrs.delete(name) }, getAttribute: name => attrs.get(name) ?? null }
    const original = fs.readFileSync
    const target = path.join(root, HOOK)
    if (texts[HOOK]) fs.readFileSync = function (file, ...rest) { return path.resolve(String(file)) === target ? texts[HOOK] : original.call(this, file, ...rest) }
    let mod
    try { mod = createModuleLoader({ root, globals: { ...env.globals, document: { documentElement } }, stubs: { react: React } }).load(HOOK) } finally { fs.readFileSync = original }
    function Unit() { mod.useStudioPublishReviewFit(); return null }
    const rootNode = new Root()
    rootNode.setElement(React.createElement(Unit)); rootNode.flush(); await env.macrotask(); rootNode.flush()
    return { mod, calls, attrs, unmount: () => rootNode.unmount() }
  }
  await check('hook: the flag is the exact value "true" (a build-time literal); on, the attribute is set on <html> once and taken off on unmount', async () => {
    const on = await mount('true')
    assert.equal(on.mod.STUDIO_PUBLISH_REVIEW_FIT_ENABLED, true)
    assert.equal(on.mod.STUDIO_PUBLISH_REVIEW_FIT_ATTR, ATTR)
    assert.deepEqual(on.calls, [['set', ATTR, 'true']])
    on.unmount()
    assert.deepEqual(on.calls, [['set', ATTR, 'true'], ['remove', ATTR]])
    assert.equal(on.attrs.size, 0)
  })
  await check('hook: flag off (unset, and eight other spellings): nothing is touched', async () => {
    for (const flag of [undefined, '', 'false', 'TRUE', 'True', '1', ' true', 'true ', 'yes']) {
      const off = await mount(flag)
      assert.equal(off.mod.STUDIO_PUBLISH_REVIEW_FIT_ENABLED, false, JSON.stringify(flag))
      off.unmount()
      assert.deepEqual(off.calls, [], JSON.stringify(flag))
    }
  })
}
async function wiringChecks(hookText = read(HOOK), cssText = read(CSS)) {
  await check('wiring: the attribute the hook sets is the one the stylesheet is scoped to; the flag is read once, in the hook only', () => {
    const attr = hookText.match(/STUDIO_PUBLISH_REVIEW_FIT_ATTR = '([^']+)'/)[1]
    assert.equal(attr, ATTR)
    assert.ok(cssText.includes(`html[${attr}="true"]`), 'the stylesheet is scoped to it')
    assert.equal((cssText.match(/data-studio-publish-review-fit/g) || []).length >= 2, true)
    assert.ok(hookText.includes(`process.env.${FLAG} === 'true'`))
    const holders = git('grep', '--untracked', '-l', '-F', `process.env.${FLAG}`, '--', 'app', 'components', 'lib', 'hooks').split('\n').filter(Boolean)
    assert.deepEqual(holders, [HOOK])
  })
}

// ---- 4. the page, .env.example, the strip -----------------------------------------------------------------------------------------------
function pageChecks(page) {
  assert.equal((page.match(/^import \{ useStudioPublishReviewFit \} from '@\/hooks\/use-studio-publish-review-fit'$/gm) || []).length, 1, 'one import')
  assert.equal((page.match(/useStudioPublishReviewFit\(/g) || []).length, 1, 'one call')
  const source = ts.createSourceFile(PAGE, page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let call = null, anchor = null
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === 'useStudioPublishReviewFit') call = node
      if (node.expression.text === 'useStudioNewDeckHandoffSend') anchor = node
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(call && anchor, 'the call and the handoff hook call exist')
  const statementOf = node => { let n = node; while (n && !ts.isBlock(n.parent)) n = n.parent; return n }
  const callStatement = statementOf(call), anchorStatement = statementOf(anchor)
  assert.ok(ts.isExpressionStatement(callStatement) && callStatement.expression === call, 'a statement of its own (not inside an expression or a callback)')
  assert.ok(callStatement.parent === anchorStatement.parent, "at the top of the same component body as the Builder's other hooks (unconditional)") // not assert.equal: a failing one would print two whole syntax trees
  assert.ok(call.arguments.length === 0, 'no arguments')
}
function envChecks(env) {
  env = stripComposeEntitlement(ENV, env) // stacked: #494's block (STUDIO_COMPOSE_ENTITLEMENT_ENABLED) comes out too
  env = stripVersionHistoryDeckOnly(ENV, env) // stacked: #493's .env.example block (NEXT_PUBLIC_STUDIO_VERSION_HISTORY_DECK_ONLY) sits between this block and # PASS2 ADMIN; it comes out first
  assert.equal((env.match(new RegExp(`^${FLAG}="false"$`, 'gm')) || []).length, 1)
  assert.ok(env.indexOf(`${FLAG}="false"\n\n# PASS2 ADMIN (FRONTEND-1`) > 0, 'right before # PASS2 ADMIN')
  assert.ok(env.indexOf(`${FLAG}="false"`) > env.indexOf('NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND="false"'), 'after the last FRONTEND-2 block')
  const block = env.slice(env.indexOf('# PUBLISH REVIEW FIT'), env.indexOf(`${FLAG}="false"`) + FLAG.length + 8)
  const phrases = []
  for (const file of fs.readdirSync(path.join(root, 'scripts')).filter(name => /^test-studio-p2-.*\.mjs$|^test-admin-email-guard\.mjs$|^test-studio-route-params\.mjs$/.test(name))) {
    const text = read(`scripts/${file}`)
    for (const m of text.matchAll(/mutant\(ENV,\s*(['"`])((?:\\.|(?!\1).)*)\1,\s*(['"`])((?:\\.|(?!\3).)*)\3/g)) phrases.push([file, m[4]])
  }
  assert.ok(phrases.length > 20, `read ${phrases.length} mutant phrases`)
  for (const [file, phrase] of phrases) if (phrase.length > 6 && !phrase.includes('${')) assert.ok(!block.includes(phrase.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'")), `${file}: a mutant phrase is in this block: ${phrase.slice(0, 60)}`)
}
async function staticChecks() {
  await check('strip: stripping gives back the base files byte for byte; new files are new; every piece is a pure insertion, context-free; the three shared strip roots chain it', () => {
    assert.deepEqual([...PUBLISH_REVIEW_FIT_FILES].sort(), [ENV, CSS, PAGE].sort())
    for (const rel of PUBLISH_REVIEW_FIT_FILES) {
      assert.notEqual(read(rel), baseFile(rel), `${rel} is changed`)
      let later = false // a later PR's commit on this file after the base: then the stacked rule
      try { later = git('log', '--format=%s', `${BASE_COMMIT}..HEAD`, '--', rel).split('\n').filter(Boolean).some(s => !/publish review fit|publish_review_fit/i.test(s)) } catch { later = false }
      const stripped = stripPublishReviewFit(rel, read(rel))
      if (!later) { assert.equal(sha(stripped), sha(baseFile(rel)), `${rel}: byte for byte`); continue }
      assert.ok(!/PUBLISH_REVIEW_FIT|PublishReviewFit|publish-review-fit/.test(stripped), `${rel}: none of this change's text is left (stacked)`)
      let at = 0
      for (const line of baseFile(rel).split('\n')) { const i = stripped.indexOf(line, at); assert.ok(i >= 0, `${rel}: base line kept in order (stacked)`); at = i + line.length }
    }
    assert.equal(stripPublishReviewFit('lib/other.ts', 'x'), 'x')
    for (const rel of PUBLISH_REVIEW_FIT_FILES) for (const [added, original] of PUBLISH_REVIEW_FIT_CHANGES[rel]) {
      assert.equal(read(rel).split(added).length, 2, `${rel}: each added piece occurs once`)
      assert.equal(original, '', `${rel}: a pure insertion, context-free`)
      assert.match(added, /PUBLISH_REVIEW_FIT|PublishReviewFit|publish-review-fit/, `${rel}: each piece names the flag`)
    }
    for (const rel of PUBLISH_REVIEW_FIT_NEW_FILES) {
      assert.ok(fs.existsSync(path.join(root, rel)), rel)
      assert.throws(() => git('cat-file', '-e', `${BASE_COMMIT}:${rel}`), undefined, `${rel} is new`)
    }
    for (const strip of [stripOpenReadOnly, stripDarkPersist, stripAddSlideStatus]) assert.equal(sha(strip(PAGE, read(PAGE))), sha(strip(PAGE, baseFile(PAGE))), strip.name)
    for (const rootFile of ['scripts/studio-open-read-only-strip.mjs', 'scripts/studio-theme-dark-persist-strip.mjs', 'scripts/studio-add-slide-status-strip.mjs']) {
      const text = read(rootFile)
      assert.equal((text.match(/import \{ stripPublishReviewFit \} from '\.\/studio-publish-review-fit-strip\.mjs'/g) || []).length, 1, `${rootFile}: one import`)
      assert.equal((text.match(/stripPublishReviewFit\(rel, (?:stripVersionHistoryDeckOnly\(rel, )?text\)/g) || []).length, 1, `${rootFile}: chained once`) // stacked: #493 (version history deck only) nests its strip inside this one
    }
    assert.ok(STACKED_PASS3_FILES.includes(HOOK) && STACKED_PASS3_FILES.includes(CSS), 'the new hook and the changed stylesheet are in STACKED_PASS3_FILES')
  })
  await check('page: one import and one unconditional call at the top of the component body', () => pageChecks(read(PAGE)))
  await check(".env.example: documented once, default off, right before # PASS2 ADMIN after the new-deck handoff block; no phrase FRONTEND-1's .env.example mutants replace", () => envChecks(read(ENV)))
  await check('the files FRONTEND-1\'s publish pins hold are untouched (the wizard, the dialog, publish-p2): only the stylesheet\'s appended block, which their strip cuts off', () => {
    for (const rel of ['components/publish-wizard.tsx', 'components/publish-dialog.tsx', 'components/publish-p2.tsx', 'components/studio-publish-viewer-summary.tsx']) assert.equal(read(rel), baseFile(rel), rel)
  })
}

// ---- 5. a strict secret scan of every added line -----------------------------------------------------------------------------------------
async function secretScan() {
  await check('secrets: no line this change adds carries anything credential-shaped', () => {
    const added = []
    for (const rel of PUBLISH_REVIEW_FIT_FILES) {
      const base = new Set(baseFile(rel).split('\n'))
      for (const line of read(rel).split('\n')) if (!base.has(line)) added.push([rel, line])
    }
    const touched = ['scripts/studio-open-read-only-strip.mjs', 'scripts/studio-theme-dark-persist-strip.mjs', 'scripts/studio-add-slide-status-strip.mjs', 'scripts/studio-library-manage-harness.mjs']
    for (const rel of touched) { const base = new Set(baseFile(rel).split('\n')); for (const line of read(rel).split('\n')) if (!base.has(line)) added.push([rel, line]) }
    for (const rel of PUBLISH_REVIEW_FIT_NEW_FILES) for (const line of read(rel).split('\n')) added.push([rel, line])
    assert.ok(added.length > 100)
    const dash = '-'.repeat(5)
    const rules = [
      ['private key', new RegExp(`${dash}BEGIN [A-Z ]*PRIVATE KEY`)], ['AWS key', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/], ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}/],
      ['Slack token', /\bxox[abposr]-[A-Za-z0-9-]{10,}/], ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}/], ['Stripe key', /\b[rs]k_(live|test)_[A-Za-z0-9]{10,}/],
      ['OpenAI / Anthropic style key', /\bsk-[A-Za-z0-9_-]{20,}/], ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./], ['bearer', /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/i],
      ['URL with a password', /[a-z]+:\/\/[^\s/:@]+:[^\s/@]+@/i],
      ['an assignment of a secret-named value', /(api[_-]?key|secret|token|passw(or)?d|credential|auth)[A-Za-z_]*["']?\s*[:=]\s*["'][^"'\s]{12,}["']/i],
      ['a long opaque literal (mixed case and digits)', /["'`](?=[A-Za-z0-9+/_=-]*[a-z])(?=[A-Za-z0-9+/_=-]*[A-Z])(?=[A-Za-z0-9+/_=-]*\d)[A-Za-z0-9+/_-]{24,}={0,2}["'`]/],
      ['a long hex literal', /["'`][0-9a-fA-F]{32,}["'`]/],
    ]
    // The only long hex literal is this change's base commit.
    for (const [rel, line] of added) for (const [name, rule] of rules) {
      const hit = line.match(rule)
      if (hit && !hit[0].includes(BASE_COMMIT)) assert.fail(`${rel}: ${name}: ${line.slice(0, 120)}`)
    }
  })
}

// ---- 6. mutants ---------------------------------------------------------------------------------------------------------------------------------
async function mutants() {
  const css = read(CSS), hook = read(HOOK), page = read(PAGE)
  const caught = [], missed = []
  async function mutant(name, detect) {
    let hit = false
    try { hit = (await detect()) === true } catch { hit = true }
    ;(hit ? caught : missed).push(name)
    console.log(`${hit ? 'CAUGHT' : 'MISSED'} mutant: ${name}`)
  }
  const failsCss = async text => { const bad = []; sink = bad; try { await cascadeChecks(text, { ratchet: false }) } finally { sink = null } return bad.length > 0 }
  const SEL = PUBLISH_REVIEW_FIT_CSS_SELECTOR
  const RULE = `  ${SEL} { padding: 0; margin: 0; }\n`
  await mutant('the rule is not scoped to the attribute (applies with the flag off)', () => failsCss(mutate(CSS, RULE, RULE.replace('html[data-studio-publish-review-fit="true"] ', ''), css)))
  await mutant('the rule is not phone-only (applies at desktop too)', () => failsCss(css.replace(`@media screen and (max-width: 700px) {\n${RULE}}`, RULE.trim())))
  await mutant('the rule is phone-only but stops at 400 px', () => failsCss(mutate(CSS, `@media screen and (max-width: 700px) {\n${RULE}`, `@media screen and (max-width: 400px) {\n${RULE}`, css)))
  await mutant('only the margin is removed (the body is 8 px narrower than its track)', () => failsCss(mutate(CSS, 'padding: 0; margin: 0; }\n}\n', 'margin: 0; }\n}\n', css)))
  await mutant('only the padding is removed (the 4 px overflow stays)', () => failsCss(mutate(CSS, 'padding: 0; margin: 0; }\n}\n', 'padding: 0; }\n}\n', css)))
  await mutant('the margin is made 0 but the padding is doubled (content narrower)', () => failsCss(mutate(CSS, 'padding: 0; margin: 0; }\n}\n', 'padding: 4px; margin: 0; }\n}\n', css)))
  await mutant('the rule is too weak to beat PP-1\'s', () => failsCss(mutate(CSS, SEL, 'html[data-studio-publish-review-fit="true"] .studio-publish-step-body', css)))
  await mutant('the overflow is hidden on the grid instead of removed', () => failsCss(mutate(CSS, RULE, `  html[data-studio-publish-review-fit="true"] [data-studio-publish="true"] .studio-publish-wizard[data-p2-polish="true"] > .studio-publish-setup-grid { overflow-x: hidden; }\n`, css)))
  await mutant('the rule also changes the viewer-summary panel', () => failsCss(mutate(CSS, SEL + ' { padding: 0; margin: 0; }', SEL.replace('.studio-publish-step-body', ':is(.studio-publish-step-body, .studio-publish-viewer-summary)') + ' { padding: 0; margin: 0; }', css)))
  await mutant('the hook sets another attribute than the stylesheet\'s', async () => { const bad = []; sink = bad; try { await wiringChecks(mutate(HOOK, "'data-studio-publish-review-fit'", "'data-studio-review-fit'", hook), css) } finally { sink = null } return bad.length > 0 })
  const hookMutant = async text => { const bad = []; sink = bad; try { await hookChecks({ [HOOK]: text }) } finally { sink = null } return bad.length > 0 }
  await mutant('the hook sets the attribute with the flag off', () => hookMutant(mutate(HOOK, 'if (!STUDIO_PUBLISH_REVIEW_FIT_ENABLED) return\n', '', hook)))
  await mutant('the hook reads any value but "false" as on', () => hookMutant(mutate(HOOK, "=== 'true'", "!== 'false'", hook)))
  await mutant('the hook never takes the attribute off', () => hookMutant(mutate(HOOK, '    return () => { root.removeAttribute(STUDIO_PUBLISH_REVIEW_FIT_ATTR) }\n', '', hook)))
  await mutant('the hook sets the attribute to something else than "true"', () => hookMutant(mutate(HOOK, "root.setAttribute(STUDIO_PUBLISH_REVIEW_FIT_ATTR, 'true')", "root.setAttribute(STUDIO_PUBLISH_REVIEW_FIT_ATTR, 'on')", hook)))
  await mutant('the page never calls the hook', () => { pageChecks(mutate(PAGE, '  useStudioPublishReviewFit()\n', '', page)); return false })
  await mutant('the page calls the hook conditionally', () => { pageChecks(mutate(PAGE, '  useStudioPublishReviewFit()\n', '  if (studioShell) useStudioPublishReviewFit()\n', page)); return false })
  await mutant('the page calls the hook inside a callback', () => { pageChecks(mutate(PAGE, '  useStudioPublishReviewFit()\n', '  useEffect(() => { useStudioPublishReviewFit() }, [])\n', page)); return false })
  await mutant('the env example turns it on by default', () => { envChecks(mutate(ENV, `${FLAG}="false"`, `${FLAG}="true"`)); return false })
  await mutant('the env example block moves after # PASS2 ADMIN', () => { const env = read(ENV); const at = env.indexOf('# PUBLISH REVIEW FIT'); const end = env.indexOf('# PASS2 ADMIN'); envChecks(env.slice(0, at) + env.slice(end) + '\n' + env.slice(at, end)); return false })
  await mutant('the strip leaves the stylesheet block behind', () => {
    const rest = PUBLISH_REVIEW_FIT_CHANGES[PAGE]
    assert.equal(sha(rest.reduce((out, [added, original]) => out.replace(added, () => original), read(CSS))), sha(baseFile(CSS))); return false
  })
  console.log(`  mutants: ${caught.length} caught of ${caught.length + missed.length}`)
  assert.equal(missed.length, 0, `mutants missed: ${missed.join('; ')}`)
}

await cascadeChecks()
await hookChecks()
await wiringChecks()
await staticChecks()
await secretScan()
if (!NO_MUTANTS) await mutants()
if (failures.length) { console.error(`\n${failures.length} FAILED:\n- ${failures.join('\n- ')}`); process.exit(1) }
console.log(`\ntest-studio-publish-review-fit: ${checks} checks passed${NO_MUTANTS ? ' (mutants skipped)' : ', every mutant caught'}`)
