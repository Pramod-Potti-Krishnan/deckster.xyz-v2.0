// P4-15 piece B (DARK): the "from Google Drive" badge on a slide's source citations, flag NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED (exact "true", default off).
// Run: node scripts/test-studio-connectors-gdrive-badge.mjs   (transpile + vm + server render, no network, no browser, nothing written)
//   1. rows      Researcher/Director citation shape (source_origin.source_type "gdrive", title, source_url) -> Drive / Web / Uploaded rows; unknown or missing fields -> no rows
//   2. flag off  every spelling but "true": the card renders byte for byte what the base (this change's lines stripped) renders, for a Drive-origin slide and a web one
//   3. flag on   a slide with a Drive citation gets the badge, the file name and an "Open in Drive" link; a slide without one renders as the base does
//   4. links     only https Google hosts become a Drive link; a web link is http(s) only; an upload never links and never leaks its uploads:// URL
//   5. scope     the strip takes this change out of the card (== the base commit's file when git has it), the registry lists the files
//   6. mutants   each broken copy must fail sections 2-5
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { stripConnectorsGdriveBadge, CONNECTORS_GDRIVE_BADGE_SCOPE_FILES } from './studio-connectors-gdrive-badge-strip.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(path.join(root, 'package.json'))
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const BASE = process.env.GDRIVE_BADGE_BASE || '11ff3c89502bdf1a3c71b8a1e7c16ec4e03a92bc' // the branch this change stacks on (#608's head refreshed onto studio-v4-dev-preparation-code 2f06e51e; was 1baf289d)
// this change's own head, FROZEN (#615's commit that holds its final code and proofs; the commit after it only sets this pin): the strip is held to the base on BASE..OWN_HEAD, whatever is merged on top later
const OWN_HEAD = process.env.GDRIVE_BADGE_HEAD || '8a7570cc821400d70727fdf301f56f30cb45e001'

const FLAG = 'NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED'
const CARD = 'components/build-narration/slide-context-card.tsx', SOURCES = 'components/builder/studio-citation-sources.tsx', LIB = 'lib/connectors-gdrive-citations.ts'
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const showAt = (commit, rel = CARD) => { try { return execFileSync('git', ['show', `${commit}:${rel}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return null } } // null: not in this clone
const sources = () => ({ [CARD]: read(CARD), [SOURCES]: read(SOURCES), [LIB]: read(LIB), 'lib/connectors-gdrive-flag.ts': read('lib/connectors-gdrive-flag.ts'), 'components/ui/badge.tsx': read('components/ui/badge.tsx'), 'lib/utils.ts': read('lib/utils.ts') })

// ---- a tiny loader: sources by relative path (so a mutant can replace one), lucide and the css import stubbed, everything else real
const icon = name => props => React.createElement('svg', { 'data-icon': name, ...props })
const LUCIDE = Object.fromEntries(['BookOpenCheck', 'CircleAlert', 'CircleHelp', 'ExternalLink', 'Globe', 'Upload'].map(n => [n, icon(n)]))
function build(files, env = {}) {
  const cache = new Map()
  const run = rel => {
    if (cache.has(rel)) return cache.get(rel).exports
    const mod = { exports: {} }; cache.set(rel, mod)
    const js = ts.transpileModule(files[rel], { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    const req = spec => {
      if (spec === 'lucide-react') return LUCIDE
      if (spec.endsWith('.css')) return {}
      if (spec.startsWith('@/')) {
        const base = spec.slice(2)
        for (const ext of ['.ts', '.tsx']) { if (base + ext in files) return run(base + ext) }
        throw new Error(`Unexpected import ${spec}`)
      }
      return nodeRequire(spec)
    }
    vm.runInNewContext(js, { require: req, module: mod, exports: mod.exports, process: { env }, URL, console }, { filename: rel })
    return mod.exports
  }
  return { card: run(CARD), sources: run(SOURCES), lib: run(LIB) }
}
const render = (m, context) => renderToStaticMarkup(React.createElement(m.card.SlideContextCard, { context, slideIndex: 2 }))
const plain = value => JSON.parse(JSON.stringify(value))

// ---- fixtures, shaped as Researcher stamps them (slide_detail_service_v2.py:466) and Director relays them (src/utils/citation_source_origin.py)
const drive = (over = {}, origin = {}) => ({
  kind: 'internal', source_kind: 'upload', label: 'Q3 plan.gdoc, p. 2', url: 'uploads://sess/chunk-1', document_filename: 'Q3 plan.gdoc', page_number: 2, section_id: 'chunk-1',
  source_origin: { source_type: 'gdrive', source_ref: '1AbCdEf', title: 'Q3 plan', source_url: 'https://docs.google.com/document/d/1AbCdEf/edit', source_modified_at: '2026-11-01T10:00:00Z', ...origin }, ...over,
})
const web = (over = {}) => ({ kind: 'external', source_kind: 'web', label: 'Industry outlook 2026', url: 'https://www.example.com/outlook', relevance: 'supporting', ...over })
const upload = (over = {}) => ({ kind: 'internal', source_kind: 'upload', label: 'board-notes.pdf, p. 4', url: 'uploads://sess/chunk-9', document_filename: 'board-notes.pdf', page_number: 4, ...over })
const ctx = (citations, over = {}) => ({ slide_index: 2, narrative_role: 'evidence', key_message: 'Q3 growth', research_status: 'ok', research_ready: true, citation_count: citations?.length ?? 0, source_types: ['internal', 'external'], content: { body_paragraphs: ['x'], source_citations: citations }, ...over })
const CONTEXTS = {
  driveWebUpload: ctx([drive(), web(), upload()]),
  driveOnly: ctx([drive()]),
  webOnly: ctx([web(), upload()]),
  uploadedNoOrigin: ctx([upload(), upload({ document_filename: 'b.pdf', label: 'b.pdf' })]),
  noContent: { ...ctx([]), content: undefined },
  malformed: ctx(null, { content: { source_citations: 'nope' } }),
  originOtherProvider: ctx([drive({}, { source_type: 'onedrive' })]),
}
const OFF_VALUES = [undefined, 'false', 'TRUE', 'True', '1', ' true', 'true ', 'yes', '']

// What the base renders: the card with this change's lines stripped (proved equal to the base commit's file in section 5).
const baselineFiles = () => { const f = sources(); f[CARD] = stripConnectorsGdriveBadge(CARD, f[CARD]); return f }

let passed = 0
function check(name, fn) { fn(); passed++; console.log('ok -', name) }

/** Sections 1-4 over a set of sources; a mutant must make this throw. */
function sections(files) {
  const off = value => build(files, value === undefined ? {} : { [FLAG]: value })
  const on = build(files, { [FLAG]: 'true' })
  const baseline = build(baselineFiles(), { [FLAG]: 'true' }) // flag value is irrelevant to the baseline: it never reads it

  // 1. rows
  check('rows: Drive, web and uploaded sources of a slide, in citation order, with the name Drive gave the file', () => {
    const rows = plain(on.lib.citationSourceRows(CONTEXTS.driveWebUpload.content))
    assert.deepEqual(rows.map(r => r.kind), ['drive', 'web', 'upload'])
    assert.deepEqual(rows[0], { key: 'drive:1AbCdEf', kind: 'drive', name: 'Q3 plan', href: 'https://docs.google.com/document/d/1AbCdEf/edit' })
    assert.deepEqual(rows[1], { key: 'web:https://www.example.com/outlook', kind: 'web', name: 'Industry outlook 2026', host: 'example.com', href: 'https://www.example.com/outlook' })
    assert.deepEqual(rows[2], { key: 'upload:board-notes.pdf', kind: 'upload', name: 'board-notes.pdf' })
  })
  check('rows: no Drive citation (web, uploads without origin, other provider, nothing) -> no rows', () => {
    for (const name of ['webOnly', 'uploadedNoOrigin', 'noContent', 'malformed', 'originOtherProvider']) assert.deepEqual(plain(on.lib.citationSourceRows(CONTEXTS[name].content)), [], name)
  })
  check('rows: unknown or malformed content never throws and gives no rows', () => {
    for (const content of [null, undefined, 7, 'x', [], {}, { source_citations: null }, { source_citations: {} }, { source_citations: [null, 1, 'a', []] }, { source_citations: [{ source_origin: 'gdrive' }] }])
      assert.deepEqual(plain(on.lib.citationSourceRows(content)), [])
  })
  check('rows: a Drive citation without title or webViewLink still shows (file name from the citation), link-less', () => {
    const rows = plain(on.lib.citationSourceRows({ source_citations: [drive({}, { title: '', source_url: '' })] }))
    assert.deepEqual(rows.map(r => [r.kind, r.name, r.href]), [['drive', 'Q3 plan.gdoc', undefined]])
    assert.equal(plain(on.lib.citationSourceRows({ source_citations: [{ source_origin: { source_type: ' GDrive ' } }] }))[0].name, 'Google Drive file')
  })
  check('rows: one row per source however often it is cited; model knowledge and graph citations are left out', () => {
    const rows = plain(on.lib.citationSourceRows({ source_citations: [drive(), drive({ page_number: 5 }), web(), web({ label: 'again' }), { kind: 'model_knowledge', source_kind: 'model', label: 'Model knowledge' }, { kind: 'internal', source_kind: 'knowledge_graph', label: 'KG' }] }))
    assert.deepEqual(rows.map(r => r.kind), ['drive', 'web'])
  })

  // 2. flag off
  check('flag off (every spelling but "true"): rows are [] and the card is byte for byte the base, Drive-origin slide and web slide alike', () => {
    for (const value of OFF_VALUES) {
      const m = off(value)
      assert.deepEqual(plain(m.lib.citationSourceRows(CONTEXTS.driveWebUpload.content)), [], `rows ${JSON.stringify(value)}`)
      for (const name of Object.keys(CONTEXTS)) assert.equal(render(m, CONTEXTS[name]), render(baseline, CONTEXTS[name]), `${name} flag=${JSON.stringify(value)}`)
    }
    assert.equal(render(baseline, CONTEXTS.driveWebUpload).includes('Google Drive'), false)
  })

  // 3. flag on
  check('flag on: a Drive slide keeps the base strip whole and adds the sources under it', () => {
    const html = render(on, CONTEXTS.driveWebUpload)
    const strip = render(baseline, CONTEXTS.driveWebUpload)
    assert.ok(html.startsWith('<div class="flex min-w-0 flex-col gap-1">' + strip), 'the base strip is the first child, unchanged')
    assert.match(html, /<ul aria-label="Sources" data-studio-citation-sources="true"/)
    assert.equal((html.match(/data-studio-citation-source="/g) || []).length, 3)
    assert.match(html, /data-studio-citation-source="drive"[^>]*>[\s\S]*?Q3 plan[\s\S]*?data-studio-citation-badge="drive"[^>]*>[\s\S]*?from Google Drive[\s\S]*?Open in Drive/)
    assert.match(html, /data-studio-citation-badge="web"[^>]*>Web · example\.com</)
    assert.match(html, /data-studio-citation-badge="upload"[^>]*>Uploaded</)
    assert.match(html, /<a href="https:\/\/docs\.google\.com\/document\/d\/1AbCdEf\/edit" target="_blank" rel="noopener noreferrer" data-studio-citation-link="drive"[^>]*>Open in Drive/)
    assert.match(html, /<a href="https:\/\/www\.example\.com\/outlook" target="_blank" rel="noopener noreferrer" data-studio-citation-link="web"[^>]*>Open page/)
    assert.match(html, /teal-/) // the Drive badge is teal; web is violet, uploaded is muted
  })
  check('flag on: a slide without a Drive citation renders as the base does', () => {
    for (const name of ['webOnly', 'uploadedNoOrigin', 'noContent', 'malformed', 'originOtherProvider']) assert.equal(render(on, CONTEXTS[name]), render(baseline, CONTEXTS[name]), name)
  })
  check('flag on: the card without a slide still draws nothing', () => {
    assert.equal(renderToStaticMarkup(React.createElement(on.card.SlideContextCard, { context: null, slideIndex: 1 })), '')
    assert.equal(renderToStaticMarkup(React.createElement(on.card.SlideContextCard, { context: CONTEXTS.driveOnly, slideIndex: null })), '')
  })

  // 4. links
  check('links: only https Google hosts are a Drive link; anything else shows the file without one', () => {
    const href = url => plain(on.lib.citationSourceRows({ source_citations: [drive({}, { source_url: url })] }))[0].href
    assert.equal(href('https://drive.google.com/file/d/1AbC/view'), 'https://drive.google.com/file/d/1AbC/view')
    assert.equal(href('https://docs.google.com/spreadsheets/d/1AbC/edit'), 'https://docs.google.com/spreadsheets/d/1AbC/edit')
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'http://drive.google.com/file/d/1/view', 'https://evil.example/drive.google.com', 'https://drive.google.com.evil.example/x', 'https://notgoogle.com/x', 'https://u:p@drive.google.com/x', '//drive.google.com/x', 'drive.google.com/x', '', null, 5])
      assert.equal(href(bad), undefined, String(bad))
    // hardening (REVIEW-1 #6): drive.google.com and docs.google.com only, default port; no other Google host (a Sites page, the redirector, the bare domain)
    assert.equal(href('https://DRIVE.google.com/file/d/1AbC/view'), 'https://drive.google.com/file/d/1AbC/view')
    assert.equal(href('https://docs.google.com:443/document/d/1AbC/edit'), 'https://docs.google.com/document/d/1AbC/edit')
    for (const bad of ['https://sites.google.com/view/evil', 'https://www.google.com/url?q=https://evil.example/', 'https://google.com/url?q=https://evil.example/', 'https://accounts.google.com/x', 'https://script.google.com/macros/s/x/exec', 'https://drive.google.com:8443/file/d/1/view', 'https://docs.google.com.evil.example/x', 'https://evil.example/?u=https://docs.google.com/'])
      assert.equal(href(bad), undefined, bad)
    assert.deepEqual([...on.lib.DRIVE_LINK_HOSTS], ['drive.google.com', 'docs.google.com'])
    const html = renderToStaticMarkup(React.createElement(on.sources.StudioCitationSources, { rows: plain(on.lib.citationSourceRows({ source_citations: [drive({}, { source_url: 'javascript:alert(1)' })] })) }))
    assert.doesNotMatch(html, /<a /)
    assert.match(html, /from Google Drive/)
  })
  check('links: a web page links only over http(s); an uploaded file never links and its uploads:// URL never reaches the markup', () => {
    const rows = u => plain(on.lib.citationSourceRows({ source_citations: [drive(), web({ url: u })] })).filter(r => r.kind === 'web')
    assert.equal(rows('javascript:alert(1)')[0].href, undefined)
    assert.equal(rows('https://u:p@example.com/')[0]?.href, undefined)
    assert.equal(rows('http://example.com/a')[0].href, 'http://example.com/a')
    const html = render(on, CONTEXTS.driveWebUpload)
    assert.doesNotMatch(html, /uploads:\/\//)
    assert.equal((html.match(/data-studio-citation-link="/g) || []).length, 2)
  })
  check('links: names are text, not markup', () => {
    const html = render(on, ctx([drive({}, { title: '<img src=x onerror=alert(1)>' })]))
    assert.doesNotMatch(html, /<img/)
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
  })
}

sections(sources())

// 5. scope
check('scope: the strip takes this change out of the card (the base commit\'s file when git has it), and nothing else', () => {
  const card = read(CARD)
  const stripped = stripConnectorsGdriveBadge(CARD, card)
  assert.notEqual(stripped, card)
  assert.equal(stripConnectorsGdriveBadge('app/builder/page.tsx', 'x'), 'x')
  assert.equal(stripConnectorsGdriveBadge(CARD, stripped), stripped, 'stripping twice changes nothing more')
  // on this change's own range (BASE..OWN_HEAD, frozen): its card minus its lines is the base's card; a later change's lines in the live card are not this one's
  const base = showAt(BASE), own = showAt(OWN_HEAD)
  if (base !== null && own !== null) assert.equal(stripConnectorsGdriveBadge(CARD, own), base)
  else console.log(`   SKIP strip == base: ${BASE.slice(0, 8)} or ${OWN_HEAD.slice(0, 8)} is not in this clone`)
})
await (async () => {
  const registry = await import(pathToFileURL(path.join(root, 'scripts/studio-later-changes.mjs')).href)
  check('scope: the registry lists this change\'s files and its strip, and the strip reaches the card', () => {
    for (const file of CONNECTORS_GDRIVE_BADGE_SCOPE_FILES) assert.ok(registry.LATER_CHANGE_FILES.has(file), file)
    for (const file of [CARD, SOURCES, LIB, 'scripts/test-studio-connectors-gdrive-badge.mjs']) assert.ok(CONNECTORS_GDRIVE_BADGE_SCOPE_FILES.has(file), file)
    // the registry reads this change out of the live card: nothing of it is left for its own strip to take (a later change's strip of the card may take more: not this one's),
    // and both sides through the registry read alike (FRONTEND-2 addendum 13 Nov, R4)
    const throughRegistry = registry.stripLaterChanges(CARD, read(CARD))
    assert.equal(stripConnectorsGdriveBadge(CARD, throughRegistry), throughRegistry)
    const base = showAt(BASE)
    if (base !== null) assert.equal(throughRegistry, registry.stripLaterChanges(CARD, base))
    else console.log(`   SKIP the card through the registry === the base through it: ${BASE.slice(0, 8)} is not in this clone`)
  })
})()
check('scope: the flag is the existing one, read as the exact string, and no new env var is introduced', () => {
  const lib = read(LIB)
  assert.match(lib, /isGdriveConnectorEnabled\(\)/)
  assert.doesNotMatch(lib + read(SOURCES) + read(CARD), /process\.env\.(?!NEXT_PUBLIC_STUDIO_V4_SHELL)/)
})

// 6. mutants
const MUTANTS = {
  'flag ignored (always on)': { [LIB]: s => s.replace('if (!enabled) return []', '') },
  'rel="noopener noreferrer" dropped': { [SOURCES]: s => s.replace('rel="noopener noreferrer" ', '') },
  'Drive link accepts any https host': { [LIB]: s => s.replace('return DRIVE_LINK_HOSTS.includes(url.hostname.toLowerCase()) ? url.href : undefined', 'return url.href') },
  'Drive link accepts any *.google.com host (the rule before the hardening)': { [LIB]: s => s.replace('return DRIVE_LINK_HOSTS.includes(url.hostname.toLowerCase()) ? url.href : undefined', "return url.hostname === 'google.com' || url.hostname.endsWith('.google.com') ? url.href : undefined") },
  'Drive link accepts any port': { [LIB]: s => s.replace("if (!url || url.protocol !== 'https:' || url.port) return undefined", "if (!url || url.protocol !== 'https:') return undefined") },
  'rows kept without a Drive citation': { [LIB]: s => s.replace('return drive > 0 ? rows : []', 'return rows') },
  'uploads:// url used as the upload link': { [LIB]: s => s.replace("row = { key: `upload:${name}`, kind: 'upload', name }", "row = { key: `upload:${name}`, kind: 'upload', name, href: text(citation.url) }") },
  'card ignores the rows': { [CARD]: s => s.replace('return driveRows.length > 0 ?', 'return false ?') },
  'badge wording dropped': { [LIB]: s => s.replace("'from Google Drive'", "''") },
  'name markup not escaped (dangerouslySetInnerHTML)': { [SOURCES]: s => s.replace('title={row.name}>{row.name}</span>', 'title={row.name} dangerouslySetInnerHTML={{ __html: row.name }} />') },
}
{
  const realLog = console.log, realPassed = passed
  let killed = 0
  for (const [name, edits] of Object.entries(MUTANTS)) {
    const files = sources()
    for (const [rel, edit] of Object.entries(edits)) { const next = edit(files[rel]); assert.notEqual(next, files[rel], `mutant "${name}" changes nothing`); files[rel] = next }
    console.log = () => {}
    let caught = false
    try { sections(files) } catch { caught = true } finally { console.log = realLog }
    assert.ok(caught, `mutant not caught: ${name}`)
    killed++
  }
  passed = realPassed
  console.log(`ok - mutants: ${killed}/${Object.keys(MUTANTS).length} killed`)
}
console.log(`\n${passed} passed`)
