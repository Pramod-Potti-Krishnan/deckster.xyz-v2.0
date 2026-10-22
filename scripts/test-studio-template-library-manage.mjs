// FRONTEND-2 Pass 3 track 4: delete on the user's own saved templates in the Templates library (/studio/templates). Flag NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE (exact "true"), default off, read at build time.
// Backend: nothing new. Director already has DELETE /api/users/{uid}/templates/{id} (origin/uat main.py: 200 { status: "deleted", id }); the Next proxy app/api/templates/[id]/route.ts already forwards it and
// hooks/use-templates.ts already has deleteTemplate; none of the three is touched. RENAME IS NOT BUILT: Director has no template rename route (only PATCH .../blueprint, which replaces the blueprint), and
// the proxy has no PATCH, so the menu holds Delete alone. This suite pins that gap (no onRename passed, no PATCH/PUT in the proxy) so it cannot be papered over by accident. Proposed contract for the rename,
// when Director wants it: PATCH /api/users/{uid}/templates/{id} body { name } (1..150 characters, trimmed) -> 200 the saved template summary; 404 not found; 409 { detail } when the person already has a template
// of that name (UNIQUE (user_id, name) in template_configs); then a PATCH in app/api/templates/[id]/route.ts and a renameTemplate in the hook, and the workspace passes onRename like the Themes page does.
// COMPOSER TEMPLATES ARE NOT DELETABLE in v1 (a stage-carrier row, found the way the page already finds one: `'stage_template_summary' in template`): Director's DELETE removes only the template_configs row and
// leaves the carrier bytes and the "uses" rows behind, and those belong to Composer. Such a row gets the menu with Delete DISABLED and one line of reason; no DELETE request can be made for it.
// Not deployed, so every request here goes to a recording fake. No network, no secrets, no model call.
//
// Run: node scripts/test-studio-template-library-manage.mjs     (plain node: the real TypeScript transpiled and run in a vm with a small fake React)
//   --mutation-check   also: break the code in several ways in memory, each must be caught by this suite
//
// What it pins: 1. the flag (exact "true", default off, documented, read inline in the Templates workspace only); 2. the wire (deleteTemplate -> DELETE /api/templates/{id} -> Director, unchanged) and the
// rename gap; 3. flag off the Templates page renders exactly what the base renders and, with this change's lines stripped, the workspace and .env.example are the base's, byte for byte; 4. flag on: only the
// person's own templates (Composer ones included) get a Delete-only menu, built-ins none; the template leaves the list only when Director confirms; the selection and the preview follow; failure, a library
// read in flight, an optimization request, an account change and an unmount.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LIBRARY_MANAGE_ADDITIONS, ENV_FILE, LIBRARY_MANAGE_NEW_FILES, TEMPLATES_WORKSPACE, THEME_HOOK, THEMES_WORKSPACE, stripLibraryManage } from './studio-library-manage-strip.mjs'
import { BASE_COMMIT, baseSource, createRuntime, deferred, jsxRuntime, loadSource, makeReader, plain, root, sha, text, tick } from './studio-library-manage-harness.mjs'

const here = fileURLToPath(import.meta.url)
const FLAG = 'NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE'
const LIB = 'lib/studio-library-manage.ts'
const ROW = 'components/studio-libraries/library-manage.tsx'
const PAGE = 'app/(app)/studio/templates/page.tsx'
const PROXY = 'app/api/templates/[id]/route.ts'
const USE_TEMPLATES = 'hooks/use-templates.ts'

const MUTATIONS = [
  { name: 'a refused delete still leaves the list', file: LIB, from: '  if (!deleted) return { ok: false, message: deleteFailedText(kind, item.name) }\n', to: '' },
  { name: 'delete leaves the list before Director answers', file: LIB, from: '  let deleted = false\n', to: "  deps.setItems(list => withoutItem(list, id))\n  let deleted = false\n" },
  { name: 'a built-in row counts as the person\'s own', file: LIB, from: "'is_builtin', ", to: '' },
  { name: 'selection does not move after a delete', file: LIB, from: '  if (selectedId !== removedId) return selectedId\n', to: '  return selectedId\n' },
  { name: 'template dialog copy loses the rebuilding warning', file: LIB, from: ' A Studio session that is still rebuilding from it cannot continue with it.', to: '' },
  { name: 'flag read loosely', file: TEMPLATES_WORKSPACE, from: "process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE === 'true'", to: 'Boolean(process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE)' },
  { name: 'built-in rows get a menu', file: TEMPLATES_WORKSPACE, from: 'TEMPLATE_LIBRARY_MANAGE && isUserOwnedLibraryItem(template)', to: 'TEMPLATE_LIBRARY_MANAGE' },
  { name: 'a rename is offered for templates', file: TEMPLATES_WORKSPACE, from: 'disabled={!accountReady || loading || Boolean(optimizingId)} onDelete', to: 'disabled={!accountReady || loading || Boolean(optimizingId)} onRename={async name => ({ ok: true, name })} onDelete' },
  { name: 'the selection is not moved after a delete', file: TEMPLATES_WORKSPACE, from: 'setSelectedId(current => selectionAfterRemoval(before, template.id, current)); ', to: '' },
  { name: 'a library read in flight is not retired by a delete', file: TEMPLATES_WORKSPACE, from: "listRequest.current += 1; setLoading(false); setActionError(''); setActionNotice('') // a library read already in flight must not bring the template back", to: "setActionError(''); setActionNotice('')" },
  { name: 'delete allowed while an optimization request is out', file: TEMPLATES_WORKSPACE, from: 'if (!canStartAccountAction() || optimizeBusy.current) return', to: 'if (!canStartAccountAction()) return' },
  { name: 'menu stays enabled during an optimization request', file: TEMPLATES_WORKSPACE, from: 'disabled={!accountReady || loading || Boolean(optimizingId)} onDelete', to: 'disabled={!accountReady || loading} onDelete' },
  { name: 'a Composer template can be deleted (no guard in the handler)', file: TEMPLATES_WORKSPACE, from: "    if ('stage_template_summary' in template) return { ok: false as const, message: COMPOSER_TEMPLATE_DELETE_REASON }", to: '' },
  { name: 'a Composer template row is not marked blocked', file: TEMPLATES_WORKSPACE, from: "deleteBlockedReason={'stage_template_summary' in template ? COMPOSER_TEMPLATE_DELETE_REASON : undefined} ", to: '' },
  { name: 'the Delete item is enabled for a blocked row', file: ROW, from: 'disabled={Boolean(deleteBlockedReason)} aria-describedby', to: 'disabled={false} aria-describedby' },
  { name: 'a blocked row still opens the dialog', file: ROW, from: 'onSelect={() => { if (deleteBlockedReason) return; setDeleteError', to: 'onSelect={() => { setDeleteError' },
  { name: 'a blocked row can still confirm a delete', file: ROW, from: 'if (deleting || deleteBlockedReason) return', to: 'if (deleting) return' },
  { name: 'the reason is not shown', file: ROW, from: '{deleteBlockedReason && <p id={noteId}', to: '{false && <p id={noteId}' },
  { name: 'Delete confirm button does nothing', file: ROW, from: 'onClick={event => { event.preventDefault(); void confirmDelete() }}', to: 'onClick={event => { event.preventDefault() }}' },
  { name: 'window.confirm instead of the dialog', file: ROW, from: "onSelect={() => { setDeleteError(''); setConfirming(true) }}", to: "onSelect={() => { if (window.confirm('Delete?')) void confirmDelete() }}" },
  { name: 'the proxy gains a PATCH nobody asked for', file: PROXY, from: '// DELETE /api/templates/{id}', to: 'export async function PATCH() { return NextResponse.json({}, { status: 200 }) }\n// DELETE /api/templates/{id}' },
  { name: 'deleteTemplate uses POST', file: USE_TEMPLATES, from: "{ method: 'DELETE' }", to: "{ method: 'POST' }" },
]
const read = makeReader(MUTATIONS, 'TEMPLATE_MANAGE_TEST_MUTATION')

if (process.argv.includes('--mutation-check')) {
  let caught = 0
  MUTATIONS.forEach((mutation, index) => {
    const child = spawnSync(process.execPath, [...process.execArgv, here], { env: { ...process.env, TEMPLATE_MANAGE_TEST_MUTATION: String(index) }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    if (child.status === 0) { console.error(`NOT CAUGHT: ${mutation.name}`); process.exitCode = 1 } else { caught++; console.log(`ok   mutant caught: ${mutation.name}`) }
  })
  console.log(`mutation check: ${caught}/${MUTATIONS.length} mutants caught`)
  if (caught !== MUTATIONS.length) process.exit(1)
  process.exit(0)
}

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }
const withMessage = (args, message) => message === undefined ? args : [...args, message]
const ok = (value, message) => check(assert.ok, ...withMessage([value], message))
const eq = (actual, expected, message) => check(assert.deepEqual, ...withMessage([plain(actual), plain(expected)], message))
const is = (actual, expected, message) => check(assert.equal, ...withMessage([actual, expected], message))

const WORKSPACE_SOURCE = read(TEMPLATES_WORKSPACE)
const lib = loadSource(read(LIB), {}, { file: LIB })

// ================================================================== 1. the flag ============================================================================================
{
  const reads = []
  for (const dir of ['app', 'components', 'lib', 'hooks']) {
    const walk = folder => fs.readdirSync(path.join(root, folder), { withFileTypes: true }).forEach(entry => {
      const rel = `${folder}/${entry.name}`
      if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(rel) } else if (/\.(tsx?|mjs|css)$/.test(entry.name) && fs.readFileSync(path.join(root, rel), 'utf8').includes(`process.env.${FLAG}`)) reads.push(rel)
    })
    walk(dir)
  }
  eq(reads, [TEMPLATES_WORKSPACE], 'only the Templates workspace reads the flag (not the page, the row, the hook or the lib)')
  is(WORKSPACE_SOURCE.split(`process.env.${FLAG} === 'true'`).length - 1, 1, 'exact "true", read inline once'); is(WORKSPACE_SOURCE.split(`process.env.${FLAG}`).length - 1, 1)
  is((read('.env.example').match(new RegExp(`^${FLAG}="false"$`, 'gm')) ?? []).length, 1, '.env.example documents the flag, default "false", once')
  ok(!read('.env.example').split('\n').some(line => /^NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE=/.test(line) && !/="false"$/.test(line)), 'and it is never documented as on')
  ok(/There is NO Rename for a template/.test(read('.env.example').replace(/\n# ?/g, ' ')), '.env.example says plainly that templates have no Rename')
  const basePage = baseSource(PAGE); if (basePage !== null) is(read(PAGE), basePage, 'the Templates page file is the base\'s')
  ok(!/\b(window\.)?(confirm|alert|prompt)\s*\(/.test(read(ROW).replace(/\/\/[^\n]*/g, '')), 'the row never calls window.confirm / alert / prompt')
}

// ================================================================== 2. the wire and the rename gap ==========================================================================
const wire = []
{
  const hookExports = loadSource(read(USE_TEMPLATES), { react: { useCallback: fn => fn, useState: initial => [initial, () => {}] } }, { file: USE_TEMPLATES, globals: { fetch: async (url, init) => { wire.push([url, init]); return { ok: true, status: 200, json: async () => ({ status: 'deleted' }) } } } })
  const hook = hookExports.useTemplates()
  is(await hook.deleteTemplate('tp 1'), true); eq(wire, [['/api/templates/tp%201', { method: 'DELETE' }]], 'deleteTemplate: DELETE /api/templates/{id}, the id URL-encoded, no body')
  const bad = loadSource(read(USE_TEMPLATES), { react: { useCallback: fn => fn, useState: initial => [initial, () => {}] } }, { file: USE_TEMPLATES, globals: { fetch: async () => ({ ok: false, status: 500, json: async () => ({}) }) } }).useTemplates()
  is(await bad.deleteTemplate('a'), false, 'a refused delete is false'); is(await loadSource(read(USE_TEMPLATES), { react: { useCallback: fn => fn, useState: initial => [initial, () => {}] } }, { file: USE_TEMPLATES, globals: { fetch: async () => { throw new Error('offline') } } }).useTemplates().deleteTemplate('a'), false, 'and so is a network error')
  ok(!('renameTemplate' in hook) && !Object.keys(hook).some(key => /rename/i.test(key)), 'the hook has no template rename')
  const baseHook = baseSource(USE_TEMPLATES); if (baseHook !== null) is(read(USE_TEMPLATES), baseHook, 'hooks/use-templates.ts is the base\'s: nothing new was needed')
}
{
  const director = []
  const route = loadSource(read(PROXY), {
    '@/lib/service-url': { requireServiceUrl: () => 'https://director.example.invalid', ServiceUrlConfigError: class extends Error {} },
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) }, NextRequest: class {} },
    'next-auth': { getServerSession: async () => ({ user: { id: 'person@example.com' } }) }, '@/lib/auth-options': { authOptions: {} },
  }, { file: PROXY, globals: { fetch: async (url, init) => { director.push([url, init]); return { status: 200, json: async () => ({ status: 'deleted', id: 'tp 1' }) } } } })
  await route.DELETE({}, { params: Promise.resolve({ id: 'tp 1' }) })
  eq(director, [['https://director.example.invalid/api/users/person%40example.com/templates/tp%201', { method: 'DELETE' }]], 'the proxy forwards DELETE to Director\'s /api/users/{uid}/templates/{id}')
  eq(Object.keys(route).sort(), ['DELETE', 'GET'], 'THE RENAME GAP: the proxy has GET and DELETE only (no PATCH, no PUT): Director has no template rename route to forward to')
  const baseProxy = baseSource(PROXY); if (baseProxy !== null) is(read(PROXY), baseProxy, 'the proxy file is the base\'s')
}

// ---- the template's own words and its Delete dialog (the row itself is proven on a theme too, in test-studio-theme-library-manage.mjs) ----------------------------------------
{
  const copy = lib.deleteDialogCopy('template', 'Quarterly review', false)
  is(copy.title, 'Delete this template?')
  is(copy.body, '“Quarterly review” is removed from your templates. Presentations already built from it are not changed. A Studio session that is still rebuilding from it cannot continue with it. There is no undo.', 'what happens to decks, and to a session still rebuilding from it')
  is(lib.deleteDialogCopy('template', 'Quarterly review', true).body, copy.body, 'a template has no standard sentence')
  is(lib.COMPOSER_TEMPLATE_DELETE_REASON, "Composer templates can't be deleted here yet.", 'the one-line reason')
  is(lib.deleteFailedText('template', 'Quarterly review'), '“Quarterly review” was not deleted and is still in your library. Try again, or refresh the library to check.')
  const toasts = []; const calls = []; let Row
  const runtime = createRuntime(() => Row({ kind: 'template', name: 'Quarterly review', onDelete: async () => { calls.push('delete'); return { ok: true, name: 'Quarterly review' } }, children: { type: 'button', props: { className: 'sl-record' }, key: 'child' } }), { elementFor: () => ({ focus() {}, select() {}, closest: () => null }) })
  const names = ['AlertDialog', 'AlertDialogAction', 'AlertDialogCancel', 'AlertDialogContent', 'AlertDialogDescription', 'AlertDialogFooter', 'AlertDialogHeader', 'AlertDialogTitle', 'DropdownMenu', 'DropdownMenuContent', 'DropdownMenuItem', 'DropdownMenuTrigger']
  Row = loadSource(read(ROW), {
    react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': { Loader2: 'Loader2', MoreVertical: 'MoreVertical' },
    '@/components/ui/alert-dialog': Object.fromEntries(names.filter(n => n.startsWith('Alert')).map(n => [n, n])), '@/components/ui/dropdown-menu': Object.fromEntries(names.filter(n => n.startsWith('Dropdown')).map(n => [n, n])),
    '@/hooks/use-toast': { toast: options => toasts.push(options) }, '@/lib/studio-library-manage': lib, './library-manage.css': {},
  }, { file: ROW, globals: { requestAnimationFrame: fn => fn() } }).ManagedLibraryRow
  runtime.render()
  eq(runtime.find(n => n.type === 'DropdownMenuItem').map(text), ['Delete…'], 'the template menu: Delete… alone')
  is(runtime.one(n => n.type === 'button' && n.props.className === 'sl-row-menu').props['aria-label'], 'Manage Quarterly review')
  is(runtime.one(n => n.type === 'AlertDialog').props.open, false)
  runtime.find(n => n.type === 'DropdownMenuItem')[0].props.onSelect(); runtime.render()
  is(runtime.one(n => n.type === 'AlertDialog').props.open, true, 'Delete… opens Studio\'s dialog; nothing is deleted yet'); eq(calls, [])
  eq(runtime.find(n => n.type === 'AlertDialogTitle').map(text), ['Delete this template?']); is(text(runtime.one(n => n.type === 'AlertDialogDescription')), copy.body); is(text(runtime.one(n => n.type === 'AlertDialogAction')), 'Delete template')
  const click = { prevented: false, preventDefault() { this.prevented = true } }
  runtime.one(n => n.type === 'AlertDialogAction').props.onClick(click); runtime.render(); await tick()
  ok(click.prevented, 'the confirm button does not close the dialog by itself'); eq(calls, ['delete'], 'confirming deletes, once')
  eq(toasts, [])

  // a Composer template: the menu is there, Delete is disabled with the reason, and no delete can start
  const blockedCalls = []; let Blocked
  const blockedRuntime = createRuntime(() => Blocked({ kind: 'template', name: 'Imported deck', deleteBlockedReason: lib.COMPOSER_TEMPLATE_DELETE_REASON, onDelete: async () => { blockedCalls.push('delete'); return { ok: true, name: 'Imported deck' } }, children: { type: 'button', props: { className: 'sl-record' }, key: 'child' } }), { elementFor: () => ({ focus() {}, select() {}, closest: () => null }) })
  Blocked = loadSource(read(ROW), {
    react: blockedRuntime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': { Loader2: 'Loader2', MoreVertical: 'MoreVertical' },
    '@/components/ui/alert-dialog': Object.fromEntries(names.filter(n => n.startsWith('Alert')).map(n => [n, n])), '@/components/ui/dropdown-menu': Object.fromEntries(names.filter(n => n.startsWith('Dropdown')).map(n => [n, n])),
    '@/hooks/use-toast': { toast: options => toasts.push(options) }, '@/lib/studio-library-manage': lib, './library-manage.css': {},
  }, { file: ROW, globals: { requestAnimationFrame: fn => fn() } }).ManagedLibraryRow
  blockedRuntime.render()
  is(blockedRuntime.one(n => n.type === 'button' && n.props.className === 'sl-row-menu').props.disabled, false, 'the menu itself opens (it explains why)')
  const blockedItem = blockedRuntime.one(n => n.type === 'DropdownMenuItem')
  is(text(blockedItem), 'Delete…'); is(blockedItem.props.disabled, true, 'Delete is disabled')
  const note = blockedRuntime.one(n => n.props?.['data-studio-library-delete-note'])
  is(text(note), "Composer templates can't be deleted here yet.", 'with the one-line reason under it'); is(blockedItem.props['aria-describedby'], note.props.id, 'which the item points at')
  blockedItem.props.onSelect(); blockedRuntime.render(); is(blockedRuntime.one(n => n.type === 'AlertDialog').props.open, false, 'even a stray select does not open the dialog')
  blockedRuntime.one(n => n.type === 'AlertDialogAction').props.onClick({ preventDefault() {} }); await tick(); eq(blockedCalls, [], 'and a stray confirm never calls delete')
  ok(!mountOpenNote(false), 'an ordinary template row shows no note')
  function mountOpenNote(blocked) {
    let R; const rt = createRuntime(() => R({ kind: 'template', name: 'Q', onDelete: async () => ({ ok: true, name: 'Q' }), ...(blocked ? { deleteBlockedReason: 'x' } : {}), children: null }), { elementFor: () => ({}) })
    R = loadSource(read(ROW), { react: rt.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': { Loader2: 'Loader2', MoreVertical: 'MoreVertical' }, '@/components/ui/alert-dialog': Object.fromEntries(names.filter(n => n.startsWith('Alert')).map(n => [n, n])), '@/components/ui/dropdown-menu': Object.fromEntries(names.filter(n => n.startsWith('Dropdown')).map(n => [n, n])), '@/hooks/use-toast': { toast() {} }, '@/lib/studio-library-manage': lib, './library-manage.css': {} }, { file: ROW }).ManagedLibraryRow
    rt.render(); return rt.find(n => n.props?.['data-studio-library-delete-note']).length > 0
  }
  ok(mountOpenNote(true), 'a blocked row does')
}

// ================================================================== 3 + 4. the workspace ===================================================================================
const T = (id, name, extra = {}) => ({ id, name, description: null, slide_count: 6, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-02T00:00:00Z', usage_count: 0, blueprint_enrichment_status: 'complete', template_purity_status: 'clean', ...extra })
const QBR = T('tp-a', 'Quarterly review', { description: 'Every quarter' })
const BOARD = T('tp-b', 'Board update', { blueprint_enrichment_status: 'failed', blueprint_enrichment_error: 'Optimization failed once' })
const IMPORTED = T('tp-c', 'Imported deck', { slide_count: 12, stage_template_summary: { schema_version: 1, sha256: 'abc', slide_count: 12 } })
const BUILT_IN = T('tp-x', 'Deckster starter', { is_builtin: true })
const snapshotOf = template => ({ ...template, slots: [], template_blueprint: { slides: [] }, presentation_brief: 'Brief' })
const hookModule = loadSource(read(USE_TEMPLATES), { react: { useCallback: fn => fn, useState: initial => [initial, () => {}] } }, { file: USE_TEMPLATES })
const noticeLib = loadSource(read('lib/studio-templates-notice.ts'), {}, { file: 'lib/studio-templates-notice.ts' })
const accountState = { current: true }
const STANDALONE_ACCOUNT = { ready: true, owner: 'person', current: true }

function mountWorkspace({ source = WORKSPACE_SOURCE, flag, templates = [QBR, BOARD, IMPORTED], api: apiOverrides = {}, account = null } = {}) {
  const calls = []
  const api = {
    listTemplates: async () => ({ templates: plain(templates), count: templates.length }), getTemplate: async id => snapshotOf(templates.find(t => t.id === id)),
    reoptimizeTemplate: async id => ({ id, blueprint_enrichment_status: 'queued' }), watchTemplateStatus: () => () => {}, deleteTemplate: async () => true, ...apiOverrides,
  }
  const recorded = Object.fromEntries(Object.keys(api).map(name => [name, (...args) => { calls.push([name, ...args]); return api[name](...args) }]))
  let Workspace
  const runtime = createRuntime(() => Workspace())
  const controls = Object.fromEntries(['FittedLibraryStage', 'LibraryLoading', 'LibraryNotice', 'LibrarySearch', 'LibraryWorkspace', 'MetadataDisclosure', 'ReadValue', 'StudioWorkflowLink'].map(n => [n, n]))
  const imports = {
    react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': Object.fromEntries(['ArrowLeft', 'ArrowRight', 'FileText', 'FileUp', 'Layers', 'LayoutTemplate', 'Loader2', 'MoreVertical', 'RefreshCw'].map(n => [n, n])),
    '@/components/template-ingest-dialog': { TemplateIngestDialog: 'TemplateIngestDialog' }, './studio-workflow-action': { StudioWorkflowAction: 'StudioWorkflowAction' },
    './library-account-boundary': { libraryAccountCanStart: () => accountState.current, libraryAccountIsCurrent: () => accountState.current, useStudioLibraryAccount: () => account },
    '@/hooks/use-templates': { ...hookModule, useTemplates: () => ({ error: null, loading: false, ...recorded }) },
    './library-controls': { ...controls, libraryDate: String }, './templates-fidelity.css': {}, '@/lib/studio-templates-notice': noticeLib,
    './library-manage': { ManagedLibraryRow: 'ManagedLibraryRow' }, '@/lib/studio-library-manage': lib,
  }
  const env = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED: 'true', ...(flag === undefined ? {} : { [FLAG]: flag }) }
  Workspace = loadSource(source, imports, { env, file: 'templates-workspace.tsx', globals: { window: { addEventListener() {}, removeEventListener() {} } } }).TemplatesWorkspace
  runtime.render()
  const h = {
    rt: runtime, calls, get tree() { return runtime.tree },
    async settle() { await runtime.settle(); await tick(4); await runtime.settle() },
    async mode(mode) { runtime.tree.props.onModeChange(mode); runtime.render(); await h.settle() },
    records: () => runtime.find(n => n.type === 'button' && /(^| )sl-template-record( |$)/.test(n.props.className ?? '')),
    rows: () => runtime.find(n => n.type === 'ManagedLibraryRow'),
    row: id => runtime.find(n => n.type === 'ManagedLibraryRow').find(n => n.key === id),
    selected: () => h.records().filter(n => n.props['aria-pressed']).map(n => n.key),
    select(id) { h.records().find(n => n.key === id).props.onClick(); runtime.render() },
    notices: () => runtime.find(n => n.type === 'LibraryNotice').map(text),
    names: () => h.records().map(n => text(n.props.children[1].props.children[0])),
    heading: () => text(runtime.find(n => n.props?.className === 'sl-preview-heading')[0]),
    search(value) { runtime.one(n => n.type === 'LibrarySearch').props.onChange(value); runtime.render() },
    filter(value) { runtime.one(n => n.type === 'select' && text(n).includes('All templates')).props.onChange({ target: { value } }); runtime.render() },
    refreshButton: () => runtime.one(n => n.type === 'button' && n.props['aria-label'] === 'Refresh templates'),
  }
  return h
}
{
  const baseWorkspace = baseSource(TEMPLATES_WORKSPACE)
  async function scenario(source, flag) {
    const h = mountWorkspace({ source, flag, templates: [QBR, BOARD, IMPORTED, BUILT_IN] })
    const frames = []
    await h.settle(); frames.push(plain(h.tree))
    await h.mode('library'); frames.push(plain(h.tree))
    h.select('tp-b'); await h.settle(); frames.push(plain(h.tree))
    h.search('board'); frames.push(plain(h.tree))
    h.search(''); h.filter('failed'); frames.push(plain(h.tree))
    h.filter('all'); h.select('tp-c'); await h.settle(); frames.push(plain(h.tree))
    return frames
  }
  const branchOff = await scenario(WORKSPACE_SOURCE, undefined)
  const hashOff = sha(JSON.stringify(branchOff))
  for (const spelling of ['false', '', 'TRUE', 'True', '1', 'yes', 'true ', ' true', 'on']) is(sha(JSON.stringify(await scenario(WORKSPACE_SOURCE, spelling))), hashOff, `flag spelled ${JSON.stringify(spelling)}: the page is the flag-off page`)
  ok(!JSON.stringify(branchOff).includes('ManagedLibraryRow') && !JSON.stringify(branchOff).includes('sl-row-menu'), 'flag off: no menu anywhere in any state')
  ok(branchOff.length === 6)
  if (baseWorkspace === null) console.log(`(base commit ${BASE_COMMIT} is not in this clone: the flag-off identity and strip proofs against it were skipped)`)
  else {
    const baseFrames = await scenario(baseWorkspace, undefined)
    eq(branchOff, baseFrames, `flag off: create, library, selected, search, filtered and composer-template frames equal the base's (${BASE_COMMIT})`)
    is(hashOff, sha(JSON.stringify(baseFrames))); console.log(`flag-off frames sha256 ${hashOff.slice(0, 16)} == base ${sha(JSON.stringify(baseFrames)).slice(0, 16)}`)
    for (const rel of [TEMPLATES_WORKSPACE, ENV_FILE]) is(stripLibraryManage(rel, read(rel)), baseSource(rel), `${rel}: without this change's lines it is the base commit's file, byte for byte`)
    for (const [rel, table] of Object.entries(LIBRARY_MANAGE_ADDITIONS)) for (const [added] of table) is(read(rel).split(added).length - 1, 1, `${rel}: each added literal occurs exactly once`)
    const changed = spawnSync('git', ['diff', '--name-only', BASE_COMMIT, '--', 'app', 'components', 'lib', 'hooks', 'middleware.ts'], { cwd: root, encoding: 'utf8' }).stdout.split('\n').filter(Boolean)
    const allowed = new Set([THEMES_WORKSPACE, TEMPLATES_WORKSPACE, THEME_HOOK, ...LIBRARY_MANAGE_NEW_FILES])
    ok(changed.every(file => allowed.has(file)), `this change touches only the two workspaces, the theme hook and its own three new files: ${changed.filter(file => !allowed.has(file)).join(', ') || 'ok'}`)
    ok(!changed.some(file => /^app\/api\/(templates|themes)\//.test(file) || /admission/i.test(file)), 'no API proxy and nothing of the admission report is touched')
  }

  // ---- flag on: who gets a menu --------------------------------------------------------------------------------------------------------------------------------------------
  const h = mountWorkspace({ flag: 'true', templates: [QBR, BOARD, IMPORTED, BUILT_IN] })
  await h.settle(); is(h.rows().length, 0, 'create mode has no list and no menu'); await h.mode('library')
  eq(h.rows().map(n => n.key), ['tp-a', 'tp-b', 'tp-c'], 'the person\'s own templates (the Composer one too) get a menu; the built-in one does not')
  is(h.records().length, 4, 'all four are still listed'); ok(h.records().some(n => n.key === 'tp-x'), 'the built-in template is listed, plain')
  for (const row of h.rows()) { is(row.props.kind, 'template'); is(row.props.onRename, undefined, 'no rename is offered for a template (Director has no route)'); is(typeof row.props.onDelete, 'function'); is(row.props.disabled, false) }
  eq(h.rows().map(n => n.props.deleteBlockedReason), [undefined, undefined, "Composer templates can't be deleted here yet."], 'only the Composer template (the page\'s own `stage_template_summary` test) has Delete blocked, with the reason')
  // found the way the page finds one, not by a new heuristic: a template that merely looks like a Composer one is an ordinary row
  const lookalike = mountWorkspace({ flag: 'true', templates: [T('tp-l', 'Stage-ish', { stage_template: { schema_version: 1 }, stage_sha256: 'abc', source: 'composer' }), IMPORTED] }); await lookalike.settle(); await lookalike.mode('library')
  eq(lookalike.rows().map(n => [n.key, n.props.deleteBlockedReason]), [['tp-l', undefined], ['tp-c', "Composer templates can't be deleted here yet."]])
  eq(h.rows().map(n => n.props.name), ['Quarterly review', 'Board update', 'Imported deck'])
  const off = mountWorkspace({ templates: [QBR, BOARD, IMPORTED, BUILT_IN] }); await off.settle(); await off.mode('library')
  for (const id of ['tp-a', 'tp-b', 'tp-c', 'tp-x']) eq(h.records().find(n => n.key === id), off.records().find(n => n.key === id), `the ${id} row's button is the flag-off button`)
  eq(h.rows().map(n => n.props.children.key), ['tp-a', 'tp-b', 'tp-c'], 'each wrapper holds exactly that row'); is(h.rows().some(n => n.props.isStandard), false, 'a template has no standard')

  // ---- delete ----------------------------------------------------------------------------------------------------------------------------------------------------------------
  const gate = deferred()
  const d = mountWorkspace({ flag: 'true', api: { deleteTemplate: async () => { await gate.promise; return true } } }); await d.settle(); await d.mode('library')
  eq(d.selected(), ['tp-a']); d.select('tp-b'); await d.settle(); d.calls.length = 0
  const pending = d.row('tp-b').props.onDelete(); d.rt.render()
  eq(d.names(), ['Quarterly review', 'Board update', 'Imported deck'], 'the template stays in the list until Director confirms'); gate.resolve()
  eq(await pending, { ok: true, name: 'Board update' }); await d.settle()
  eq(d.names(), ['Quarterly review', 'Imported deck'], 'then it leaves'); ok(d.notices().includes('“Board update” was deleted from your templates.'), d.notices().join('|'))
  eq(d.selected(), ['tp-c'], 'the selection moved to the next template'); ok(d.heading().includes('Imported deck'))
  eq(d.calls.filter(c => c[0] === 'deleteTemplate'), [['deleteTemplate', 'tp-b']], 'one DELETE: the id only')
  eq(d.rows().map(n => n.key), ['tp-a', 'tp-c'])
  // deleting the selected template with a loaded preview: the preview follows the new selection
  const p = mountWorkspace({ flag: 'true' }); await p.settle(); await p.mode('library'); await p.settle(); ok(p.calls.some(c => c[0] === 'getTemplate' && c[1] === 'tp-a'), 'the first template\'s preview was loaded'); p.calls.length = 0
  await p.row('tp-a').props.onDelete(); await p.settle()
  eq(p.selected(), ['tp-b']); ok(p.calls.some(c => c[0] === 'getTemplate' && c[1] === 'tp-b'), 'the next template\'s preview is loaded'); ok(!p.calls.some(c => c[0] === 'getTemplate' && c[1] === 'tp-a'), 'the deleted one is never read again')
  ok(p.heading().includes('Board update'))
  // a Composer template can never be deleted from here: the handler refuses before any request, whatever calls it
  const c = mountWorkspace({ flag: 'true' }); await c.settle(); await c.mode('library'); c.select('tp-c'); await c.settle(); c.calls.length = 0
  const composerBlocked = await c.row('tp-c').props.onDelete(); await c.settle()
  eq(composerBlocked, { ok: false, message: "Composer templates can't be deleted here yet." }, 'asked anyway, it says why'); eq(c.calls.filter(x => x[0] === 'deleteTemplate'), [], 'NO DELETE request for a carrier template'); eq(c.names(), ['Quarterly review', 'Board update', 'Imported deck'], 'still listed'); eq(c.selected(), ['tp-c'])
  ok(!c.notices().some(n => /deleted/.test(n)), 'and no "deleted" notice')
  // the last ordinary row: the row above takes the selection
  const tail = mountWorkspace({ flag: 'true', templates: [QBR, BOARD] }); await tail.settle(); await tail.mode('library'); tail.select('tp-b'); await tail.settle()
  is((await tail.row('tp-b').props.onDelete()).ok, true); await tail.settle(); eq(tail.names(), ['Quarterly review']); eq(tail.selected(), ['tp-a'], 'the row above takes the selection when the last one goes')
  // the last template: the empty library
  const last = mountWorkspace({ flag: 'true', templates: [QBR] }); await last.settle(); await last.mode('library'); await last.row('tp-a').props.onDelete(); await last.settle()
  is(last.rows().length, 0); ok(last.rt.find(n => n.props?.className === 'sl-empty').length === 1, 'the empty state shows'); ok(last.heading().includes('Explore a reusable story'), 'and the preview has nothing selected')
  // refused delete
  for (const deleteTemplate of [async () => false, async () => { throw new Error('boom') }]) {
    const f = mountWorkspace({ flag: 'true', api: { deleteTemplate } }); await f.settle(); await f.mode('library'); f.select('tp-b'); await f.settle()
    const result = await f.row('tp-b').props.onDelete(); await f.settle()
    is(result.ok, false); is(result.message, '“Board update” was not deleted and is still in your library. Try again, or refresh the library to check.'); eq(f.names(), ['Quarterly review', 'Board update', 'Imported deck'], 'still listed'); eq(f.selected(), ['tp-b'], 'still selected')
    ok(!f.notices().some(n => /was deleted/.test(n)), 'no "deleted" notice')
  }
  // a library read already in flight cannot bring the template back
  const readGate = deferred(); let reads = 0
  const racing = mountWorkspace({ flag: 'true', api: { listTemplates: async () => { reads++; if (reads > 1) await readGate.promise; return { templates: plain([QBR, BOARD, IMPORTED]), count: 3 } } } })
  await racing.settle(); await racing.mode('library'); racing.refreshButton().props.onClick(); racing.rt.render()
  await racing.row('tp-b').props.onDelete(); readGate.resolve(); await racing.settle(); eq(racing.names(), ['Quarterly review', 'Imported deck'], 'the late library answer is dropped')
  // an optimization request is out: no delete, and the menu is off
  const optGate = deferred()
  const opt = mountWorkspace({ flag: 'true', templates: [QBR, BOARD, IMPORTED], api: { reoptimizeTemplate: async id => { await optGate.promise; return { id, blueprint_enrichment_status: 'queued' } } } })
  await opt.settle(); await opt.mode('library'); opt.select('tp-b'); await opt.settle()
  const optimizeButton = opt.rt.find(n => n.type === 'button' && text(n).includes('Retry optimization'))[0]; ok(optimizeButton, 'the failed template offers a retry'); optimizeButton.props.onClick(); opt.rt.render()
  ok(opt.rows().every(n => n.props.disabled === true), 'every menu is off while an optimization request is out')
  const blocked = await opt.row('tp-b').props.onDelete(); is(blocked.ok, false); is(blocked.message, 'Another library action is still running. Try again in a moment.'); eq(opt.calls.filter(c => c[0] === 'deleteTemplate'), [], 'no DELETE then')
  optGate.resolve(); await opt.settle(); ok(opt.rows().every(n => n.props.disabled === false), 'and back on afterwards')
  // account not ready / changed
  const acct = mountWorkspace({ flag: 'true', account: STANDALONE_ACCOUNT }); await acct.settle(); await acct.mode('library')
  accountState.current = false; const paused = await acct.row('tp-a').props.onDelete(); accountState.current = true
  is(paused.ok, false); eq(acct.calls.filter(c => c[0] === 'deleteTemplate'), [], 'not while the account is being verified')
  const swap = deferred(); const swapped = mountWorkspace({ flag: 'true', account: STANDALONE_ACCOUNT, api: { deleteTemplate: async () => { await swap.promise; return true } } }); await swapped.settle(); await swapped.mode('library')
  const swapPending = swapped.row('tp-a').props.onDelete(); accountState.current = false; swap.resolve(); const swapResult = await swapPending; accountState.current = true
  is(swapResult.stale, true, 'a changed account makes the answer stale'); eq(swapped.names(), ['Quarterly review', 'Board update', 'Imported deck'], 'and nothing is removed from the new account\'s list')
  // unmount
  const away = deferred(); const gone = mountWorkspace({ flag: 'true', account: STANDALONE_ACCOUNT, api: { deleteTemplate: async () => { await away.promise; return true } } }); await gone.settle(); await gone.mode('library')
  const awayPending = gone.row('tp-a').props.onDelete(); gone.rt.unmount(); away.resolve(); is((await awayPending).stale, true, 'an unmounted page: nothing written')
}

console.log(`studio-template-library-manage: ${checks} checks passed`)
