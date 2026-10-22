// FRONTEND-2 Pass 3 track 4: rename and delete on the user's own saved themes in the Themes library (/studio/themes). Flag NEXT_PUBLIC_STUDIO_THEME_LIBRARY_MANAGE (exact "true"), default off, read at build time.
// Backend: nothing new. Both routes already exist in Director (origin/uat main.py): PATCH /api/users/{uid}/themes/{id} (body { name }; an empty name is NOT refused there, so the guard is in the page)
// and DELETE /api/users/{uid}/themes/{id} (200 { status: "deleted", id }). The Next proxies app/api/themes/[id]/route.ts already forward both and are not touched. Not deployed, so every request here goes
// to a recording fake. No network, no secrets, no model call.
//
// Run: node scripts/test-studio-theme-library-manage.mjs     (plain node: the real TypeScript transpiled and run in a vm with a small fake React; no browser, no services)
//   --mutation-check   also: break the code in several ways in memory, each must be caught by this suite
//
// What it pins:
//   1. the flag: exact "true", default off, documented in .env.example, read inline in the workspace only (never in the page, never through an imported helper);
//   2. the rules (lib/studio-library-manage.ts): names (empty, over 150, a name another theme has ignoring case and spaces), what counts as the person's own, the selection after a delete, the optimistic
//      rename with rollback and the delete that leaves the list only on Director's confirmation, each with its failure, stale-account and gone-item paths;
//   3. the wire: renameTheme sends PATCH /api/themes/{id} with exactly { name }; deleteTheme sends DELETE; the proxies forward both to Director's /api/users/{uid}/themes/{id} unchanged;
//   4. the row (components/studio-libraries/library-manage.tsx): the ⋮ menu, inline rename (Enter/Esc, inline problem, optimistic close), Studio's own AlertDialog for Delete (copy, double-click guard,
//      retry after a failure, a toast on failure, focus after the row is gone), never window.confirm;
//   5. the workspace: flag off the Themes page renders exactly what the base renders (create, library, search, standard filter) and, with this change's lines stripped (scripts/studio-library-manage-strip.mjs),
//      the workspace, the hook and .env.example are the base commit's, byte for byte; flag on, only the person's own themes get a menu, built-ins none, and rename/delete work end to end on the list,
//      the selection, the notices and the context line, including a library read already in flight, an account change and an unmount.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { LIBRARY_MANAGE_ADDITIONS, THEME_HOOK, THEMES_WORKSPACE, TEMPLATES_WORKSPACE, ENV_FILE, LIBRARY_MANAGE_NEW_FILES, stripLibraryManage } from './studio-library-manage-strip.mjs'
import { BASE_COMMIT, STACKED_PASS3_FILES, baseSource, createRuntime, deferred, flat, isBaseFile, jsxRuntime, loadSource, makeReader, plain, refuse, root, sha, text, tick } from './studio-library-manage-harness.mjs'

const here = fileURLToPath(import.meta.url)
const FLAG = 'NEXT_PUBLIC_STUDIO_THEME_LIBRARY_MANAGE'
const LIB = 'lib/studio-library-manage.ts'
const ROW = 'components/studio-libraries/library-manage.tsx'
const CSS = 'components/studio-libraries/library-manage.css'
const PAGE = 'app/(app)/studio/themes/page.tsx'
const PROXY = 'app/api/themes/[id]/route.ts'

// ---- mutations (--mutation-check): one in-memory source edit per child run; each must make this suite fail ---------------------------------------------------------
const MUTATIONS = [
  { name: 'rename shows no optimistic name', file: LIB, from: '  deps.setItems(list => renamedItems(list, id, name))\n  let saved', to: '  let saved' },
  { name: 'a refused rename keeps the new name', file: LIB, from: "candidate.name === name ? { ...candidate, name: previous } : candidate) : list)\n    return { ok: false, message: renameFailedText", to: "candidate.name === name ? { ...candidate } : candidate) : list)\n    return { ok: false, message: renameFailedText" },
  { name: 'a refused delete still leaves the list', file: LIB, from: '  if (!deleted) return { ok: false, message: deleteFailedText(kind, item.name) }\n', to: '' },
  { name: 'duplicate check is case sensitive', file: LIB, from: 'other.trim().toLowerCase() === name.toLowerCase()', to: 'other.trim() === name' },
  { name: 'name limit is 151', file: LIB, from: 'export const LIBRARY_NAME_MAX = 150', to: 'export const LIBRARY_NAME_MAX = 151' },
  { name: 'a built-in row counts as the person\'s own', file: LIB, from: "'is_builtin', ", to: '' },
  { name: 'selection does not move after a delete', file: LIB, from: '  if (selectedId !== removedId) return selectedId\n', to: '  return selectedId\n' },
  { name: 'standard theme delete copy drops the standard sentence', file: LIB, from: "${isStandard ? ' It is your standard theme, so new presentations go back to the session default.' : ''}", to: '' },
  { name: 'rename also sends is_standard', file: 'hooks/use-theme-profiles.ts', from: 'body: JSON.stringify({ name }),', to: 'body: JSON.stringify({ name, is_standard: false }),' },
  { name: 'rename uses PUT', file: 'hooks/use-theme-profiles.ts', from: "method: 'PATCH',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ name }),", to: "method: 'PUT',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ name })," },
  { name: 'flag read loosely', file: THEMES_WORKSPACE, from: "process.env.NEXT_PUBLIC_STUDIO_THEME_LIBRARY_MANAGE === 'true'", to: 'Boolean(process.env.NEXT_PUBLIC_STUDIO_THEME_LIBRARY_MANAGE)' },
  { name: 'built-in rows get a menu', file: THEMES_WORKSPACE, from: 'THEME_LIBRARY_MANAGE && isUserOwnedLibraryItem(theme)', to: 'THEME_LIBRARY_MANAGE' },
  { name: 'selection is not moved after a delete', file: THEMES_WORKSPACE, from: 'setSelectedId(current => selectionAfterRemoval(before, theme.id, current)); ', to: '' },
  { name: 'a library read in flight is not retired by a rename', file: THEMES_WORKSPACE, from: "    listRequest.current += 1; setLoading(false) // a library read already in flight must not put the old name back over the new one\n", to: '' },
  { name: 'Delete confirm button does nothing', file: ROW, from: 'onClick={event => { event.preventDefault(); void confirmDelete() }}', to: 'onClick={event => { event.preventDefault() }}' },
  { name: 'rename skips the duplicate check', file: ROW, from: 'const issue = libraryNameProblem(kind, draft, otherNames)', to: 'const issue = null' },
  { name: 'a failed delete shows no toast', file: ROW, from: "    toast({ variant: 'destructive', title: `${kind === 'theme' ? 'Theme' : 'Template'} not deleted`, description: result.message })\n", to: '' },
  { name: 'a rejected delete leaves the dialog stuck', file: ROW, from: 'try { result = await onDelete() } catch { result = { ok: false, message: UNEXPECTED_TEXT } }', to: 'result = await onDelete()' },
  { name: 'a failed rename shows no toast', file: ROW, from: "toast({ variant: 'destructive', title: 'Rename not saved', description: result.message })", to: '' },
  { name: 'window.confirm instead of the dialog', file: ROW, from: "onSelect={() => { setDeleteError(''); setConfirming(true) }}", to: "onSelect={() => { if (window.confirm('Delete?')) void confirmDelete() }}" },
]
const read = makeReader(MUTATIONS, 'THEME_MANAGE_TEST_MUTATION')

if (process.argv.includes('--mutation-check')) {
  let caught = 0
  MUTATIONS.forEach((mutation, index) => {
    const child = spawnSync(process.execPath, [...process.execArgv, here], { env: { ...process.env, THEME_MANAGE_TEST_MUTATION: String(index) }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
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

const LIB_SOURCE = read(LIB), ROW_SOURCE = read(ROW), WORKSPACE_SOURCE = read(THEMES_WORKSPACE), HOOK_SOURCE = read(THEME_HOOK)
const lib = loadSource(LIB_SOURCE, {}, { file: LIB })

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
  eq(reads.sort(), [THEMES_WORKSPACE].sort(), 'only the Themes workspace reads the flag (not the page, the row, the hook or the lib)')
  is(WORKSPACE_SOURCE.split(`process.env.${FLAG} === 'true'`).length - 1, 1, 'exact "true", read inline once')
  is(WORKSPACE_SOURCE.split(`process.env.${FLAG}`).length - 1, 1, 'and nowhere else in the file')
  ok(!/import[^\n]*(from '[^']*(feature-flags|flags)[^']*')/.test(WORKSPACE_SOURCE), 'no flag helper is imported')
  is((read('.env.example').match(new RegExp(`^${FLAG}="false"$`, 'gm')) ?? []).length, 1, '.env.example documents the flag, default "false", once')
  // test-studio-p2-polish holds .env.example to its own earlier base up to ITS block, so this change's block sits after that block (and after the Profile page block: the end of the file)
  ok(read('.env.example').indexOf('# PASS3 LIBRARY MANAGE') > read('.env.example').indexOf('NEXT_PUBLIC_STUDIO_P2_POLISH="false"') && read('.env.example').indexOf('NEXT_PUBLIC_STUDIO_P2_POLISH="false"') > 0, '.env.example: the block comes after the polish flag\'s block')
  is(read(PAGE), baseSource(PAGE) ?? read(PAGE), 'the Themes page file is the base\'s: the flag is not read there')
  ok(!/\b(window\.)?(confirm|alert|prompt)\s*\(/.test(ROW_SOURCE.replace(/\/\/[^\n]*/g, '')), 'the row never calls window.confirm / alert / prompt')
  ok(!/\b(window\.)?(confirm|alert|prompt)\s*\(/.test(LIB_SOURCE.replace(/\/\/[^\n]*/g, '')), 'the rules never call window.confirm / alert / prompt')
  ok(/AlertDialog/.test(ROW_SOURCE) && /from '@\/components\/ui\/alert-dialog'/.test(ROW_SOURCE), 'Delete confirms in Studio\'s own AlertDialog (the one the Decks list uses)')
  ok(/from '@\/components\/ui\/dropdown-menu'/.test(ROW_SOURCE) && /MoreVertical/.test(ROW_SOURCE) && /aria-label=\{`Manage \$\{name\}`\}/.test(ROW_SOURCE), 'the menu is the Decks list\'s DropdownMenu with its "Manage <name>" label')
  // every css rule is on a class only the flagged markup uses
  const css = read(CSS)
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{[^{}]*\}/g)].map(match => match[1].trim())
  ok(rules.length >= 8 && rules.every(selector => /\.sl-(record-row|row-menu|rename)/.test(selector)), `inert while the flag is off: every rule is on .sl-record-row / .sl-row-menu / .sl-rename (${rules.length} rules)`)
}

// ================================================================== 2. the rules ===========================================================================================
{
  const problem = (raw, others = []) => lib.libraryNameProblem('theme', raw, others)
  is(problem(''), 'Enter a name.'); is(problem('   '), 'Enter a name.')
  is(problem('x'.repeat(150)), null, '150 characters is allowed'); is(problem('x'.repeat(151)), 'Use 150 characters or fewer.')
  is(problem(`  ${'x'.repeat(150)}  `), null, 'the limit counts the trimmed name')
  is(problem('Harbor', ['Evergreen', 'harbor']), 'A saved theme has this name. Choose a different name.', 'a name another theme has, ignoring case')
  is(problem('  HARBOR  ', ['Harbor ']), 'A saved theme has this name. Choose a different name.', 'ignoring spaces on both sides')
  is(problem('Harbors', ['Harbor']), null, 'a longer name is not a duplicate')
  is(lib.libraryNameProblem('template', 'A', ['a']), 'A saved template has this name. Choose a different name.', 'the kind is named')
  is(lib.LIBRARY_NAME_MAX, 150)

  const own = { id: 't1', name: 'N' }
  ok(lib.isUserOwnedLibraryItem(own), 'a plain row is the person\'s own')
  for (const bad of [null, undefined, 'x', 3, {}, { name: 'N' }, { id: '', name: 'N' }, { id: 7, name: 'N' }]) ok(!lib.isUserOwnedLibraryItem(bad), `not owned: ${JSON.stringify(bad)}`)
  for (const key of ['is_builtin', 'is_built_in', 'builtin', 'built_in', 'is_system', 'is_deckster', 'is_default_library']) {
    ok(!lib.isUserOwnedLibraryItem({ ...own, [key]: true }), `${key}: true is not the person's own`)
    ok(lib.isUserOwnedLibraryItem({ ...own, [key]: false }), `${key}: false is`)
  }
  for (const owner of ['Deckster', ' system ', 'BUILTIN', 'built-in', 'built_in']) for (const field of ['owner', 'user_id', 'source', 'origin', 'created_by']) ok(!lib.isUserOwnedLibraryItem({ ...own, [field]: owner }), `${field}: ${owner}`)
  ok(lib.isUserOwnedLibraryItem({ ...own, user_id: 'person@example.com', source_session_id: 'deckster' }), 'a real owner, and a field that merely mentions deckster, stay owned')
  ok(lib.isUserOwnedLibraryItem({ ...own, is_standard: true }), 'the person\'s standard theme is still their own')

  const list = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }]
  is(lib.selectionAfterRemoval(list, 'a', 'b'), 'b', 'another row selected: unchanged'); is(lib.selectionAfterRemoval(list, 'b', 'b'), 'c', 'the row below'); is(lib.selectionAfterRemoval(list, 'c', 'c'), 'b', 'else the row above')
  is(lib.selectionAfterRemoval([{ id: 'a', name: 'A' }], 'a', 'a'), null, 'nothing left'); is(lib.selectionAfterRemoval(list, 'zz', 'zz'), 'a', 'a selection not in the list falls to the first'); is(lib.selectionAfterRemoval(list, 'a', null), null)
  eq(lib.renamedItems(list, 'b', 'Z'), [{ id: 'a', name: 'A' }, { id: 'b', name: 'Z' }, { id: 'c', name: 'C' }]); is(lib.renamedItems(null, 'b', 'Z'), null)
  eq(lib.withoutItem(list, 'b'), [{ id: 'a', name: 'A' }, { id: 'c', name: 'C' }]); is(lib.withoutItem(null, 'b'), null)

  // copy
  const themeCopy = lib.deleteDialogCopy('theme', 'Harbor', false), standardCopy = lib.deleteDialogCopy('theme', 'Harbor', true), templateCopy = lib.deleteDialogCopy('template', 'QBR', false)
  is(themeCopy.title, 'Delete this theme?'); is(templateCopy.title, 'Delete this template?')
  ok(themeCopy.body.includes('“Harbor”') && /Presentations already built with it keep their look/.test(themeCopy.body) && /There is no undo\.$/.test(themeCopy.body), 'theme: names it, says decks keep their look, no undo')
  ok(!/standard/.test(themeCopy.body) && /standard theme, so new presentations go back to the session default/.test(standardCopy.body), 'the standard sentence appears only for the standard theme')
  ok(/Presentations already built from it are not changed/.test(templateCopy.body) && /still rebuilding from it cannot continue/.test(templateCopy.body) && !/standard/.test(templateCopy.body), 'template: decks unchanged, a session still rebuilding from it cannot continue')
  ok(!/\b(Director|Supabase|JSON|API|HTTP|500|404)\b/.test(`${themeCopy.body}${templateCopy.body}${lib.renameFailedText('theme', 'A')}${lib.deleteFailedText('theme', 'A')}`), 'plain words: no jargon in any message')
}

// ---- optimistic rename ------------------------------------------------------------------------------------------------------------------------------------------------------
async function renameCase({ commit, items, id = 'b', name = 'Harbor 2', current = () => true, afterStart }) {
  let state = items ?? [{ id: 'a', name: 'Evergreen' }, { id: 'b', name: 'Harbor' }, { id: 'c', name: 'Sunrise' }]
  const seen = []
  const deps = { getItems: () => state, setItems: update => { state = update(state); seen.push(plain(state)) }, isCurrent: current, commit }
  const pending = lib.runLibraryRename('theme', deps, id, name)
  await afterStart?.(() => state)
  const result = await pending
  return { result, state, seen }
}
{
  const gate = deferred(); let during
  const run = renameCase({ commit: async (id, name) => { await gate.promise; return { id, name } }, afterStart: async read => { await tick(2); during = plain(read()) } })
  await tick(4); gate.resolve(); const done = await run
  eq(during.find(i => i.id === 'b'), { id: 'b', name: 'Harbor 2' }, 'the list shows the new name before Director answers')
  eq(done.result, { ok: true, name: 'Harbor 2' }); eq(done.state.map(i => i.name), ['Evergreen', 'Harbor 2', 'Sunrise'])
  const calls = []; await renameCase({ commit: async (...args) => { calls.push(args); return { id: 'b', name: 'Harbor 2' } }, name: '  Harbor 2  ' }); eq(calls, [['b', 'Harbor 2']], 'commit gets the trimmed name, once')
}
{
  const failed = await renameCase({ commit: async () => null })
  eq(failed.state.map(i => i.name), ['Evergreen', 'Harbor', 'Sunrise'], 'not confirmed: the old name comes back'); is(failed.result.ok, false)
  ok(/“Harbor” was not renamed and keeps its old name/.test(failed.result.message) && /Another theme may already use that name/.test(failed.result.message), failed.result.message)
  for (const commit of [async () => { throw new Error('boom') }, async () => ({ id: 'other', name: 'Harbor 2' }), async () => ({ name: 'Harbor 2' }), async () => undefined]) {
    const r = await renameCase({ commit }); eq(r.state.map(i => i.name), ['Evergreen', 'Harbor', 'Sunrise']); is(r.result.ok, false)
  }
  const spelled = await renameCase({ commit: async () => ({ id: 'b', name: 'Harbor Two' }) }); eq(spelled.state.map(i => i.name), ['Evergreen', 'Harbor Two', 'Sunrise'], 'Director\'s spelling wins'); is(spelled.result.name, 'Harbor Two')
  const kept = await renameCase({ commit: async () => ({ id: 'b' }) }); is(kept.result.name, 'Harbor 2', 'no name in the answer: the sent one stays')
  // rollback never undoes a later change of the same row
  let state = [{ id: 'a', name: 'Evergreen' }, { id: 'b', name: 'Harbor' }]
  const result = await lib.runLibraryRename('theme', { getItems: () => state, setItems: u => { state = u(state) }, isCurrent: () => true, commit: async () => { state = state.map(i => i.id === 'b' ? { ...i, name: 'Changed elsewhere' } : i); return null } }, 'b', 'Harbor 2')
  is(result.ok, false); is(state[1].name, 'Changed elsewhere', 'a later name is left alone')
  // refusals before anything is sent
  const sent = []; const commit = async (...args) => { sent.push(args); return { id: 'b', name: 'x' } }
  for (const [name, expected] of [['', 'Enter a name.'], ['   ', 'Enter a name.'], ['x'.repeat(151), 'Use 150 characters or fewer.'], ['evergreen', 'A saved theme has this name. Choose a different name.'], [' SUNRISE ', 'A saved theme has this name. Choose a different name.']]) {
    const r = await renameCase({ commit, name }); is(r.result.message, expected); eq(r.seen, [], 'the list is not touched')
  }
  eq(sent, [], 'nothing was sent for a refused name')
  const same = await renameCase({ commit, name: ' Harbor ' }); eq(same.result, { ok: true, name: 'Harbor' }); eq(sent, [], 'the same name is a no-op'); eq(same.seen, [])
  const ownCase = await renameCase({ commit: async () => ({ id: 'b', name: 'HARBOR' }), name: 'HARBOR' }); is(ownCase.result.ok, true, 'changing only the case of its own name is allowed')
  const gone = await renameCase({ commit, id: 'zz' }); is(gone.result.message, lib.GONE_TEXT); const none = await renameCase({ commit, items: [] , id: 'b' }); is(none.result.ok, false)
  const nullList = await lib.runLibraryRename('theme', { getItems: () => null, setItems() {}, isCurrent: () => true, commit }, 'b', 'X'); is(nullList.ok, false)
  // the page or account changed while the save was out: nothing more is touched or said
  const stale = await renameCase({ commit: async () => ({ id: 'b', name: 'Harbor 2' }), current: () => false }); eq(stale.result, { ok: false, message: '', stale: true }); is(stale.seen.length, 1, 'only the optimistic write happened')
  const staleFail = await renameCase({ commit: async () => null, current: () => false }); is(staleFail.result.stale, true); is(staleFail.seen.length, 1, 'no rollback write into a page that has moved on')
}

// ---- delete ------------------------------------------------------------------------------------------------------------------------------------------------------------------
async function deleteCase({ commit, items, id = 'b', current = () => true }) {
  let state = items ?? [{ id: 'a', name: 'Evergreen' }, { id: 'b', name: 'Harbor' }, { id: 'c', name: 'Sunrise' }]
  const seen = [], committed = []
  const result = await lib.runLibraryDelete('theme', { getItems: () => state, setItems: update => { state = update(state); seen.push(plain(state)) }, isCurrent: current, commit: async (...args) => { committed.push(args); return commit(...args) } }, id)
  return { result, state, seen, committed }
}
{
  const done = await deleteCase({ commit: async () => true })
  eq(done.result, { ok: true, name: 'Harbor' }); eq(done.state.map(i => i.id), ['a', 'c']); eq(done.committed, [['b']], 'commit gets the id only')
  const gate = deferred(); let state = [{ id: 'a', name: 'A' }]; let during
  const pending = lib.runLibraryDelete('theme', { getItems: () => state, setItems: u => { state = u(state) }, isCurrent: () => true, commit: async () => { await gate.promise; return true } }, 'a')
  await tick(3); during = plain(state); gate.resolve(); await pending
  eq(during, [{ id: 'a', name: 'A' }], 'the theme stays in the list until Director confirms'); eq(state, [])
  for (const commit of [async () => false, async () => { throw new Error('boom') }, async () => ({ status: 'deleted' }), async () => 1, async () => undefined]) {
    const r = await deleteCase({ commit }); eq(r.state.map(i => i.id), ['a', 'b', 'c'], 'a refused delete keeps the theme'); eq(r.seen, []); is(r.result.ok, false)
    is(r.result.message, '“Harbor” was not deleted and is still in your library. Try again, or refresh the library to check.')
  }
  const gone = await deleteCase({ commit: async () => true, id: 'zz' }); is(gone.result.message, lib.GONE_TEXT); eq(gone.committed, [], 'an item that is not in the list is never sent')
  const stale = await deleteCase({ commit: async () => true, current: () => false }); eq(stale.result, { ok: false, message: '', stale: true }); eq(stale.seen, [], 'a changed account: the list is not touched')
}

// ================================================================== 3. the wire ============================================================================================
const wire = []
const wireFetch = (responder) => async (url, init) => { wire.push([url, init]); return responder(url, init) }
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => { if (body === undefined) throw new Error('no body'); return body } })
function loadHook(fetchImpl) {
  return loadSource(HOOK_SOURCE, {
    react: { useCallback: fn => fn, useState: initial => [initial, () => {}] },
    '@/lib/theme-fonts': { applyThemeFontPolicy: payload => payload },
  }, { file: THEME_HOOK, globals: { fetch: fetchImpl } }).useThemeProfiles()
}
{
  const saved = { id: 'th 1', name: 'New name', theme_payload: { mode: 'preset', preset_id: 'minimal' } }
  wire.length = 0
  const hook = loadHook(wireFetch(() => response(200, saved)))
  const renamed = await hook.renameTheme('th 1', 'New name')
  eq(renamed, saved); is(wire.length, 1)
  is(wire[0][0], '/api/themes/th%201', 'the id is URL-encoded into the proxy path')
  eq(wire[0][1], { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"name":"New name"}' }, 'PATCH with exactly { name }: no description, palette or standard')
  is(Object.keys(JSON.parse(wire[0][1].body)).join(), 'name')
  for (const [label, responder] of [['HTTP 500', () => response(500, { detail: 'failed to update theme' })], ['HTTP 404', () => response(404, { error: 'theme not found' })], ['HTTP 502 without a body', () => response(502)], ['network down', () => { throw new Error('offline') }]]) {
    wire.length = 0; const h = loadHook(wireFetch(responder)); is(await h.renameTheme('th1', 'X'), null, `${label}: null`)
  }
  wire.length = 0; await loadHook(wireFetch(() => response(200, { id: 'a' }))).deleteTheme('th 1')
  eq(wire.map(([url, init]) => [url, init]), [['/api/themes/th%201', { method: 'DELETE' }]], 'delete is the existing DELETE, unchanged')
  is(await loadHook(wireFetch(() => response(200, {}))).deleteTheme('a'), true); is(await loadHook(wireFetch(() => response(500, {}))).deleteTheme('a'), false); is(await loadHook(wireFetch(() => { throw new Error('x') })).deleteTheme('a'), false)
  ok(/^  return \{\n[\s\S]*renameTheme,\n[\s\S]*\}\n\}\n$/m.test(HOOK_SOURCE), 'renameTheme is returned beside deleteTheme')
}
async function routeCalls(userId) {
  const director = []
  const classes = { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) }, NextRequest: class {} }
  const route = loadSource(read(PROXY), {
    '@/lib/service-url': { requireServiceUrl: () => 'https://director.example.invalid', ServiceUrlConfigError: class extends Error {} },
    'next/server': classes, 'next-auth': { getServerSession: async () => userId === null ? null : { user: { id: userId } } }, '@/lib/auth-options': { authOptions: {} },
  }, { file: PROXY, globals: { fetch: async (url, init) => { director.push([url, init]); return { status: 200, json: async () => ({ status: 'ok' }) } } } })
  return { route, director }
}
{
  const { route, director } = await routeCalls('person@example.com')
  const res = await route.PATCH({ json: async () => ({ name: 'New name' }) }, { params: Promise.resolve({ id: 'th 1' }) })
  eq(director, [['https://director.example.invalid/api/users/person%40example.com/themes/th%201', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"name":"New name"}' }]], 'the proxy forwards PATCH to Director\'s /api/users/{uid}/themes/{id} with the body as sent')
  is(res.status, 200)
  director.length = 0; await route.DELETE({}, { params: Promise.resolve({ id: 'th 1' }) })
  eq(director, [['https://director.example.invalid/api/users/person%40example.com/themes/th%201', { method: 'DELETE' }]], 'and DELETE')
  const anon = await routeCalls(null); const refused = await anon.route.PATCH({ json: async () => ({ name: 'x' }) }, { params: Promise.resolve({ id: 'a' }) }); is(refused.status, 401); eq(anon.director, [], 'no session: Director is never called')
  const same = baseSource(PROXY); if (same !== null) is(read(PROXY), same, 'the proxy file is the base\'s: nothing new was needed')
}

// ================================================================== 4. the row =============================================================================================
const toasts = []
function mountRow(props = {}, { listCalls = [] } = {}) {
  const focusLog = []
  const listStub = { querySelector(selector) { listCalls.push(selector); return { focus: () => focusLog.push(`list:${selector}`) } } }
  let Row
  const runtime = createRuntime(() => Row({ kind: 'theme', name: 'Harbor', otherNames: ['Evergreen', 'Sunrise'], onDelete: async () => ({ ok: true, name: 'Harbor' }), children: { type: 'button', props: { className: 'sl-record' }, key: 'child' }, ...props }), {
    elementFor: (node, focused) => ({ tag: node.type, focus: () => focusLog.push(`${node.type}:${node.props['aria-label'] ?? node.props.className ?? ''}`), select: () => focusLog.push(`select:${node.type}`), closest: () => listStub }),
  })
  const names = ['AlertDialog', 'AlertDialogAction', 'AlertDialogCancel', 'AlertDialogContent', 'AlertDialogDescription', 'AlertDialogFooter', 'AlertDialogHeader', 'AlertDialogTitle']
  const menu = ['DropdownMenu', 'DropdownMenuContent', 'DropdownMenuItem', 'DropdownMenuTrigger']
  Row = loadSource(read(ROW), {
    react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': { Loader2: 'Loader2', MoreVertical: 'MoreVertical' },
    '@/components/ui/alert-dialog': Object.fromEntries(names.map(n => [n, n])), '@/components/ui/dropdown-menu': Object.fromEntries(menu.map(n => [n, n])),
    '@/hooks/use-toast': { toast: options => toasts.push(options) }, '@/lib/studio-library-manage': loadSource(read(LIB), {}, { file: LIB }), './library-manage.css': {},
  }, { file: ROW, globals: { requestAnimationFrame: fn => fn() } }).ManagedLibraryRow
  runtime.render()
  const ev = () => ({ prevented: false, stopped: false, preventDefault() { this.prevented = true }, stopPropagation() { this.stopped = true } })
  const api = {
    rt: runtime, focusLog, ev,
    get tree() { return runtime.tree },
    item: marker => runtime.find(n => n.type === 'DropdownMenuItem' && n.props[marker])[0],
    trigger: () => runtime.one(n => n.type === 'button' && n.props.className === 'sl-row-menu'),
    form: () => runtime.find(n => n.type === 'form')[0], input: () => runtime.find(n => n.type === 'input')[0],
    dialog: () => runtime.one(n => n.type === 'AlertDialog'), content: () => runtime.one(n => n.type === 'AlertDialogContent'), action: () => runtime.one(n => n.type === 'AlertDialogAction'), cancel: () => runtime.one(n => n.type === 'AlertDialogCancel'),
    alertText: () => runtime.find(n => n.props?.role === 'alert').map(text).join('|'),
    startRename() { api.item('data-studio-library-rename').props.onSelect(); runtime.render() },
    type(value) { api.input().props.onChange({ target: { value } }); runtime.render() },
    submit() { const e = ev(); api.form().props.onSubmit(e); runtime.render(); return e },
    openDelete() { api.item('data-studio-library-delete').props.onSelect(); runtime.render() },
  }
  return api
}
{
  // the menu
  const row = mountRow({ onRename: async () => ({ ok: true, name: 'x' }) })
  is(row.trigger().props['aria-label'], 'Manage Harbor', 'the Decks list\'s label'); is(row.trigger().props.disabled, false); is(row.trigger().props.type, 'button')
  eq(row.rt.find(n => n.type === 'DropdownMenuItem').map(n => [text(n), n.props.className ?? '']), [['Rename', ''], ['Delete…', 'text-red-600']], 'Rename, then a red Delete…, as the Decks list does')
  is(row.rt.one(n => n.type === 'DropdownMenuContent').props.align, 'end'); is(row.tree.props['data-studio-library-row'], 'theme')
  is(mountRow({ disabled: true }).trigger().props.disabled, true, 'disabled while the page is busy')
  eq(mountRow({ kind: 'template' }).rt.find(n => n.type === 'DropdownMenuItem').map(text), ['Delete…'], 'no onRename (a template): the menu holds Delete alone')
  ok(mountRow({ kind: 'template' }).item('data-studio-library-rename') === undefined, 'no Rename item at all')
  ok(flat(row.tree).some(n => n.key === 'child'), 'the row\'s own button is drawn as it was'); is(row.form(), undefined, 'no edit field until asked')
  is(row.dialog().props.open, false, 'no dialog until asked')

  // rename
  const calls = []; const gate = deferred()
  const r = mountRow({ onRename: name => { calls.push(name); return gate.promise } })
  r.startRename()
  ok(r.form(), 'Rename opens the field in place'); is(r.input().props.value, 'Harbor', 'prefilled with the current name'); is(r.input().props.maxLength, 150); is(r.tree.props['data-editing'], 'true')
  ok(r.focusLog.includes('select:input') && r.focusLog.includes('input:'), 'the field is focused and selected'); is(text(r.rt.one(n => n.type === 'label')).startsWith('Rename theme'), true)
  r.type('   '); let e = r.submit(); ok(e.prevented, 'the form does not reload the page'); is(r.alertText(), 'Enter a name.'); is(r.input().props['aria-invalid'], true); ok(r.input().props['aria-describedby']); eq(calls, [])
  r.type('evergreen'); r.submit(); is(r.alertText(), 'A saved theme has this name. Choose a different name.'); eq(calls, [], 'a duplicate is refused in the field, nothing is sent')
  r.type('x'.repeat(151)); r.submit(); is(r.alertText(), 'Use 150 characters or fewer.')
  r.type('Harbor 2'); is(r.alertText(), '', 'typing clears the message')
  r.submit(); eq(calls, ['Harbor 2'], 'the draft goes to onRename untouched (the rules trim it)'); is(r.form(), undefined, 'the field closes at once, before Director answers'); is(r.tree.props['data-editing'], undefined)
  ok(r.focusLog.includes('button:Manage Harbor'), 'focus goes back to the ⋮ button'); eq(toasts, [])
  gate.resolve({ ok: true, name: 'Harbor 2' }); await tick(); eq(toasts, [], 'a saved rename shows no error')
  // refused rename -> toast, with the failure message
  const failing = mountRow({ onRename: async () => ({ ok: false, message: 'it did not work' }) }); failing.startRename(); failing.type('Other'); failing.submit(); await tick()
  eq(toasts, [{ variant: 'destructive', title: 'Rename not saved', description: 'it did not work' }], 'a refused rename is a destructive toast with the reason'); toasts.length = 0
  const staleRow = mountRow({ onRename: async () => ({ ok: false, message: '', stale: true }) }); staleRow.startRename(); staleRow.type('Other'); staleRow.submit(); await tick(); eq(toasts, [], 'a stale result says nothing')
  // same name, Escape, Cancel
  const noop = []; const c = mountRow({ onRename: n => { noop.push(n); return Promise.resolve({ ok: true, name: n }) } })
  c.startRename(); c.type(' Harbor '); c.submit(); eq(noop, [], 'the same name closes without a request'); is(c.form(), undefined)
  c.startRename(); c.type('Other'); const esc = c.ev(); c.input().props.onKeyDown({ ...esc, key: 'Escape', preventDefault: esc.preventDefault.bind(esc), stopPropagation: esc.stopPropagation.bind(esc) }); c.rt.render(); is(c.form(), undefined, 'Escape closes the field'); ok(esc.prevented && esc.stopped, 'and does not leak to the page'); eq(noop, [])
  c.startRename(); c.input().props.onKeyDown({ key: 'a', preventDefault() {}, stopPropagation() {} }); ok(c.form(), 'other keys do nothing special')
  const buttons = c.rt.find(n => n.type === 'button' && n.props.type && n.props.className !== 'sl-row-menu'); eq(buttons.map(n => [text(n), n.props.type]), [['Cancel', 'button'], ['Save name', 'submit']], 'Cancel and Save name')
  buttons[0].props.onClick(); c.rt.render(); is(c.form(), undefined, 'Cancel closes the field'); eq(noop, [])
  ok(c.rt.find(n => n.type === 'DropdownMenuContent')[0].props.onCloseAutoFocus, 'the menu hands focus to the field, not back to its button')
  const closeEvent = c.ev(); c.startRename(); c.rt.find(n => n.type === 'DropdownMenuContent')[0].props.onCloseAutoFocus(closeEvent); ok(closeEvent.prevented, 'while the field is open the menu does not take focus back')
}
{
  // delete dialog
  let resolveDelete; const deletes = []
  const r = mountRow({ isStandard: false, onDelete: () => { deletes.push('d'); return new Promise(resolve => { resolveDelete = resolve }) } }, { listCalls: [] })
  r.openDelete(); is(r.dialog().props.open, true, 'Delete… opens the dialog, nothing is deleted yet'); eq(deletes, [])
  eq(r.rt.find(n => n.type === 'AlertDialogTitle').map(text), ['Delete this theme?']); ok(text(r.rt.one(n => n.type === 'AlertDialogDescription')).startsWith('“Harbor” is removed from your library.'), 'the description names the theme')
  ok(!/standard/.test(text(r.rt.one(n => n.type === 'AlertDialogDescription'))), 'and says nothing about a standard for a normal theme')
  is(text(r.action()), 'Delete theme'); is(text(r.cancel()), 'Cancel'); is(r.cancel().props.disabled, false)
  const cancelEvent = r.dialog().props.onOpenChange(false); r.rt.render(); is(r.dialog().props.open, false, 'Cancel / Esc / outside click close it'); eq(deletes, [])
  r.openDelete(); const click = r.ev(); r.action().props.onClick(click); ok(click.prevented, 'the confirm button does not close the dialog by itself'); r.rt.render()
  is(deletes.length, 1); is(text(r.action()), 'Deleting…'.replace('…', '…')); ok(text(r.action()).includes('Deleting'), 'busy label'); is(r.action().props.disabled, true); is(r.cancel().props.disabled, true); is(r.content().props['aria-busy'], true)
  r.action().props.onClick(r.ev()); r.rt.render(); is(deletes.length, 1, 'a second click while deleting does nothing')
  r.dialog().props.onOpenChange(false); r.rt.render(); is(r.dialog().props.open, true, 'cannot be dismissed while deleting')
  const esc = r.ev(); r.content().props.onEscapeKeyDown(esc); ok(esc.prevented, 'Esc is held back while deleting')
  resolveDelete({ ok: false, message: '“Harbor” was not deleted and is still in your library. Try again, or refresh the library to check.' }); await tick(); r.rt.render()
  is(r.dialog().props.open, true, 'a failure keeps the dialog open to try again'); is(r.alertText(), '“Harbor” was not deleted and is still in your library. Try again, or refresh the library to check.'); is(text(r.action()), 'Try again'); is(r.action().props.disabled, false)
  eq(toasts, [{ variant: 'destructive', title: 'Theme not deleted', description: '“Harbor” was not deleted and is still in your library. Try again, or refresh the library to check.' }], 'and a destructive toast'); toasts.length = 0
  r.action().props.onClick(r.ev()); r.rt.render(); is(deletes.length, 2, 'Try again asks again'); is(r.alertText(), '', 'the old message is cleared while it runs')
  resolveDelete({ ok: true, name: 'Harbor' }); await tick(); eq(toasts, [], 'a delete that worked shows no error')
  ok(r.focusLog.some(entry => entry.startsWith('list:.sl-record[aria-pressed="true"]')), 'focus goes to the list\'s selected row once this one is gone')
  // the first match is empty -> falls back to the first row
  const queries = []; const f = mountRow({ onDelete: async () => ({ ok: true, name: 'Harbor' }) }, { listCalls: queries }); f.openDelete(); f.action().props.onClick(f.ev()); await tick(); ok(queries.length >= 1, 'the list is asked for a row to focus')
  // stale
  const s = mountRow({ onDelete: async () => ({ ok: false, message: '', stale: true }) }); s.openDelete(); s.action().props.onClick(s.ev()); await tick(); eq(toasts, [], 'a stale delete says nothing')
  // a rejection from the page (not expected, but never a stuck dialog)
  const boom = mountRow({ onDelete: async () => { throw new Error('boom') } }); boom.openDelete(); boom.action().props.onClick(boom.ev()); await tick(); boom.rt.render()
  is(boom.dialog().props.open, true); is(boom.action().props.disabled, false, 'not stuck on Deleting…'); is(text(boom.action()), 'Try again'); is(boom.alertText(), lib.UNEXPECTED_TEXT); eq(toasts, [{ variant: 'destructive', title: 'Theme not deleted', description: lib.UNEXPECTED_TEXT }]); toasts.length = 0
  const boomRename = mountRow({ onRename: async () => { throw new Error('boom') } }); boomRename.startRename(); boomRename.type('Other'); boomRename.submit(); await tick()
  eq(toasts, [{ variant: 'destructive', title: 'Rename not saved', description: lib.UNEXPECTED_TEXT }], 'a rejected rename is a toast, not an unhandled rejection'); toasts.length = 0
  // standard + template copy in the dialog
  const std = mountRow({ isStandard: true }); std.openDelete(); ok(/standard theme, so new presentations go back to the session default/.test(text(std.rt.one(n => n.type === 'AlertDialogDescription'))), 'the standard theme says what happens to new presentations')
  const tpl = mountRow({ kind: 'template', name: 'QBR' }); tpl.openDelete()
  eq(tpl.rt.find(n => n.type === 'AlertDialogTitle').map(text), ['Delete this template?']); is(text(tpl.action()), 'Delete template')
  const tplFail = mountRow({ kind: 'template', name: 'QBR', onDelete: async () => ({ ok: false, message: 'nope' }) }); tplFail.openDelete(); tplFail.action().props.onClick(tplFail.ev()); await tick()
  eq(toasts, [{ variant: 'destructive', title: 'Template not deleted', description: 'nope' }]); toasts.length = 0
}

// ================================================================== 5. the workspace ======================================================================================
const EVERGREEN = { id: 'th-a', name: 'Evergreen', description: 'Calm greens', theme_payload: { mode: 'preset', preset_id: 'minimal' }, is_standard: true, usage_count: 2, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-02T00:00:00Z' }
const HARBOR = { id: 'th-b', name: 'Harbor', description: null, theme_payload: { mode: 'custom', primary_hex: '#112233', palette_mode: 'both' }, is_standard: false }
const SUNRISE = { id: 'th-c', name: 'Sunrise', description: 'Warm', theme_payload: { mode: 'preset', preset_id: 'corporate_light' }, is_standard: false }
const BUILT_IN = { id: 'th-x', name: 'Deckster Classic', description: 'Ours', theme_payload: { mode: 'preset', preset_id: 'corporate_light' }, is_standard: false, is_builtin: true }
const builder = loadSource(read('lib/theme-builder.ts'), {}, { file: 'lib/theme-builder.ts' })
const themeFonts = loadSource(read('lib/theme-fonts.ts'), {}, { file: 'lib/theme-fonts.ts' })
const darkToggle = loadSource(read('lib/studio-theme-dark-toggle.ts'), {}, { file: 'lib/studio-theme-dark-toggle.ts' })
const previewCanon = loadSource(read('lib/studio-theme-preview-canon.ts'), {}, { file: 'lib/studio-theme-preview-canon.ts' })
const preview = loadSource(read('components/studio-libraries/theme-preview.tsx'), { '@/lib/theme-builder': builder, '@/lib/studio-theme-preview-canon': previewCanon, 'react/jsx-runtime': jsxRuntime }, { file: 'theme-preview.tsx' })
const accountState = { current: true }

const STANDALONE_ACCOUNT = { ready: true, owner: 'person', current: true } // the provider's value inside the standalone Studio shell; null outside it
function mountWorkspace({ source = WORKSPACE_SOURCE, flag, themes = [EVERGREEN, HARBOR, SUNRISE], api: apiOverrides = {}, account = null } = {}) {
  const calls = []
  const api = {
    listThemes: async () => ({ themes: plain(themes), count: themes.length }), saveTheme: async () => null, setStandardTheme: async () => null, clearStandardTheme: async () => true,
    renameTheme: async (id, name) => ({ id, name }), deleteTheme: async () => true, ...apiOverrides,
  }
  const recorded = Object.fromEntries(Object.keys(api).map(name => [name, (...args) => { calls.push([name, ...args]); return api[name](...args) }]))
  let Workspace
  const runtime = createRuntime(() => Workspace())
  const controls = Object.fromEntries(['FittedLibraryStage', 'LibraryLoading', 'LibraryNotice', 'LibrarySearch', 'LibraryWorkspace', 'MetadataDisclosure', 'ReadValue', 'StudioWorkflowLink'].map(n => [n, n]))
  const imports = {
    react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': Object.fromEntries(['ArrowRight', 'Check', 'Copy', 'MoreVertical', 'Palette', 'RefreshCw', 'RotateCcw', 'Save', 'Star'].map(n => [n, n])),
    '@/hooks/use-theme-profiles': { useThemeProfiles: () => ({ error: null, ...recorded }) }, '@/lib/theme-builder': builder, '@/lib/theme-fonts': themeFonts, '@/lib/studio-theme-dark-toggle': darkToggle,
    './library-controls': { ...controls, libraryDate: String }, './theme-preview': preview, './studio-workflow-action': { StudioWorkflowAction: 'StudioWorkflowAction' },
    './base-theme-picker': { BaseThemePicker: 'BaseThemePicker' }, '@/lib/studio-theme-base-dropdown': { STUDIO_THEME_BASE_DROPDOWN_ENABLED: false }, './use-canon-preview-palettes': { useCanonPreviewPalettes: () => undefined },
    './library-account-boundary': { libraryAccountCanStart: () => accountState.current, libraryAccountIsCurrent: () => accountState.current, useStudioLibraryAccount: () => account },
    '@/lib/studio-inspector-focus': { keepStudioScrollFocusVisible: refuse }, './themes-fidelity.css': {},
    './library-manage': { ManagedLibraryRow: 'ManagedLibraryRow' }, '@/lib/studio-library-manage': lib,
  }
  const env = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', ...(flag === undefined ? {} : { [FLAG]: flag }) }
  Workspace = loadSource(source, imports, { env, file: 'themes-workspace.tsx', globals: { window: { addEventListener() {}, removeEventListener() {} } } }).ThemesWorkspace
  runtime.render()
  const h = {
    rt: runtime, calls, get tree() { return runtime.tree },
    async settle() { await runtime.settle(); await tick(4); await runtime.settle() },
    async mode(mode) { runtime.tree.props.onModeChange(mode); runtime.render(); await h.settle() },
    records: () => runtime.find(n => n.type === 'button' && n.props.className === 'sl-record'),
    rows: () => runtime.find(n => n.type === 'ManagedLibraryRow'),
    row: id => runtime.find(n => n.type === 'ManagedLibraryRow').find(n => n.key === id),
    select(id) { h.records().find(n => n.key === id).props.onClick(); runtime.render() },
    notices: () => runtime.find(n => n.type === 'LibraryNotice').map(text),
    names: () => h.records().map(n => text(n.props.children[1].props.children[0])),
    context: () => text(runtime.find(n => n.props?.className === 'sl-context')[0]),
    heading: () => text(runtime.find(n => n.props?.className === 'sl-preview-heading')[0]),
    search(value) { runtime.one(n => n.type === 'LibrarySearch').props.onChange(value); runtime.render() },
  }
  return h
}
{
  const baseWorkspace = baseSource(THEMES_WORKSPACE)
  // ---- flag off is the base --------------------------------------------------------------------------------------------------------------------------------------------
  async function scenario(source, flag) {
    const h = mountWorkspace({ source, flag, themes: [EVERGREEN, HARBOR, SUNRISE, BUILT_IN] })
    const frames = []
    await h.settle(); frames.push(plain(h.tree))
    await h.mode('library'); frames.push(plain(h.tree))
    h.select('th-b'); frames.push(plain(h.tree))
    h.search('sun'); frames.push(plain(h.tree))
    h.search(''); frames.push(plain(h.tree))
    return frames
  }
  const branchOff = await scenario(WORKSPACE_SOURCE, undefined)
  const hashOff = sha(JSON.stringify(branchOff))
  for (const spelling of ['false', '', 'TRUE', 'True', '1', 'yes', 'true ', ' true', 'on']) is(sha(JSON.stringify(await scenario(WORKSPACE_SOURCE, spelling))), hashOff, `flag spelled ${JSON.stringify(spelling)}: the page is the flag-off page`)
  is(sha(JSON.stringify(await scenario(WORKSPACE_SOURCE, 'false'))), hashOff, 'explicit false')
  ok(!JSON.stringify(branchOff).includes('ManagedLibraryRow') && !JSON.stringify(branchOff).includes('sl-row-menu'), 'flag off: no menu anywhere in any state')
  if (baseWorkspace === null) console.log(`(base commit ${BASE_COMMIT} is not in this clone: the flag-off identity and strip proofs against it were skipped)`)
  else {
    const baseFrames = await scenario(baseWorkspace, undefined)
    eq(branchOff, baseFrames, `flag off: create, library, selected, search and cleared frames equal the base's (${BASE_COMMIT})`)
    is(hashOff, sha(JSON.stringify(baseFrames)), 'same hash'); ok(branchOff.length === 5)
    console.log(`flag-off frames sha256 ${hashOff.slice(0, 16)} == base ${sha(JSON.stringify(baseFrames)).slice(0, 16)}`)
    // ---- the strip gives the base back, byte for byte
    for (const rel of [THEMES_WORKSPACE, THEME_HOOK, ENV_FILE]) ok(isBaseFile(rel, stripLibraryManage(rel, read(rel)), baseSource(rel)), `${rel}: without this change's lines it is the base commit's file${rel === ENV_FILE ? ' (its lines in order; a later change\'s block may follow)' : ', byte for byte'}`)
    for (const [rel, table] of Object.entries(LIBRARY_MANAGE_ADDITIONS)) for (const [added] of table) is(read(rel).split(added).length - 1, 1, `${rel}: each added literal occurs exactly once (${added.slice(0, 40).replace(/\n/g, ' ')}…)`)
    // ---- nothing else moved
    const changed = spawnSync('git', ['diff', '--name-only', BASE_COMMIT, '--', 'app', 'components', 'lib', 'hooks', 'middleware.ts'], { cwd: root, encoding: 'utf8' }).stdout.split('\n').filter(Boolean)
    const allowed = new Set([THEMES_WORKSPACE, TEMPLATES_WORKSPACE, THEME_HOOK, ...LIBRARY_MANAGE_NEW_FILES, ...STACKED_PASS3_FILES])
    ok(changed.every(file => allowed.has(file)), `this change touches only the two workspaces, the theme hook and its own three new files (the other Pass 3 changes' files may be stacked on it): ${changed.filter(file => !allowed.has(file)).join(', ') || 'ok'}`)
    ok(!changed.includes('components/builder/chat-input.tsx') && !changed.some(file => /^app\/api\/(templates|themes)\//.test(file)), 'chat-input.tsx and every API proxy are untouched')
    is(read(PAGE), baseSource(PAGE)); is(read('app/(app)/studio/templates/page.tsx'), baseSource('app/(app)/studio/templates/page.tsx'))
  }

  // ---- flag on: who gets a menu ----------------------------------------------------------------------------------------------------------------------------------------
  const h = mountWorkspace({ flag: 'true', themes: [EVERGREEN, HARBOR, SUNRISE, BUILT_IN] })
  await h.settle(); is(h.rows().length, 0, 'create mode has no list and no menu'); await h.mode('library')
  eq(h.rows().map(n => n.key), ['th-a', 'th-b', 'th-c'], 'the person\'s own themes get a row menu; the built-in one does not')
  is(h.records().length, 4, 'all four themes are still listed'); ok(h.records().some(n => n.key === 'th-x'), 'the built-in theme is listed, plain')
  const evergreenRow = h.row('th-a'), harborRow = h.row('th-b')
  eq([evergreenRow.props.kind, evergreenRow.props.name, evergreenRow.props.isStandard, evergreenRow.props.disabled, harborRow.props.isStandard], ['theme', 'Evergreen', true, false, false])
  eq(harborRow.props.otherNames, ['Evergreen', 'Sunrise', 'Deckster Classic'], 'duplicate check sees every other name, the built-in one included')
  ok(typeof harborRow.props.onRename === 'function' && typeof harborRow.props.onDelete === 'function')
  eq(h.rows().map(n => n.props.deleteBlockedReason), [undefined, undefined, undefined], 'a theme\'s Delete is never blocked')
  // the row's own button is exactly the flag-off button
  const offRecords = (await (async () => { const o = mountWorkspace({ themes: [EVERGREEN, HARBOR, SUNRISE, BUILT_IN] }); await o.settle(); await o.mode('library'); return o.records() })())
  for (const id of ['th-a', 'th-b', 'th-c']) eq(h.records().find(n => n.key === id), offRecords.find(n => n.key === id), `the ${id} row's button is the flag-off button`)
  eq(h.rows().map(n => n.props.children.key), ['th-a', 'th-b', 'th-c'], 'each wrapper holds exactly that row')
  ok(h.rows().every(n => typeof n.props.children.props.onClick === 'function'), 'selecting still works through the wrapper')
  h.select('th-b'); is(h.heading().includes('Harbor'), true, 'a click on the row still selects it')

  // ---- rename ------------------------------------------------------------------------------------------------------------------------------------------------------------
  const gate = deferred()
  const slow = mountWorkspace({ flag: 'true', api: { renameTheme: async (id, name) => { await gate.promise; return { id, name, theme_payload: SUNRISE.theme_payload } } } })
  await slow.settle(); await slow.mode('library'); slow.select('th-b')
  const listReads = slow.calls.filter(c => c[0] === 'listThemes').length
  const pending = slow.row('th-b').props.onRename('  Harbor Lights  '); slow.rt.render()
  eq(slow.names(), ['Evergreen', 'Harbor Lights', 'Sunrise'], 'the list shows the new name before Director answers'); ok(slow.heading().includes('Harbor Lights'), 'and so does the preview heading')
  eq(slow.calls.filter(c => c[0] === 'renameTheme'), [['renameTheme', 'th-b', 'Harbor Lights']], 'one rename request: the id and the trimmed name, nothing else')
  gate.resolve(); const renamed = await pending; await slow.settle()
  eq(renamed, { ok: true, name: 'Harbor Lights' }); ok(slow.notices().includes('“Harbor” is now “Harbor Lights”.'), slow.notices().join('|')); eq(slow.names(), ['Evergreen', 'Harbor Lights', 'Sunrise'])
  eq(slow.rows().map(n => n.props.otherNames), [['Harbor Lights', 'Sunrise'], ['Evergreen', 'Sunrise'], ['Evergreen', 'Harbor Lights']], 'the other rows see the new name')
  is(slow.calls.filter(c => c[0] === 'listThemes').length, listReads, 'a rename does not re-read the library')
  eq(slow.rt.find(n => n.type === 'button' && n.props.className === 'sl-record' && n.props['aria-pressed']).map(n => n.key), ['th-b'], 'the selection stays on the renamed theme')
  is(slow.calls.some(c => ['setStandardTheme', 'clearStandardTheme', 'saveTheme'].includes(c[0])), false, 'rename touches nothing else')

  // refused rename: rolled back, no notice, the reason comes back to the row
  const refused = mountWorkspace({ flag: 'true', api: { renameTheme: async () => null } }); await refused.settle(); await refused.mode('library')
  const refusedResult = await refused.row('th-b').props.onRename('Harbor 2'); await refused.settle()
  is(refusedResult.ok, false); ok(/“Harbor” was not renamed and keeps its old name/.test(refusedResult.message)); eq(refused.names(), ['Evergreen', 'Harbor', 'Sunrise'], 'the old name is back'); ok(!refused.notices().some(n => /is now/.test(n)), 'no "renamed" notice')
  const thrown = mountWorkspace({ flag: 'true', api: { renameTheme: async () => { throw new Error('boom') } } }); await thrown.settle(); await thrown.mode('library')
  is((await thrown.row('th-b').props.onRename('Harbor 2')).ok, false); eq(thrown.names(), ['Evergreen', 'Harbor', 'Sunrise'], 'a thrown error rolls back too')
  // names the page refuses never reach Director
  const guarded = mountWorkspace({ flag: 'true', themes: [EVERGREEN, HARBOR, SUNRISE, BUILT_IN], account: STANDALONE_ACCOUNT }); await guarded.settle(); await guarded.mode('library')
  for (const [name, message] of [['', 'Enter a name.'], ['evergreen', 'A saved theme has this name. Choose a different name.'], ['deckster classic', 'A saved theme has this name. Choose a different name.'], ['x'.repeat(151), 'Use 150 characters or fewer.']]) is((await guarded.row('th-b').props.onRename(name)).message, message)
  eq(guarded.calls.filter(c => c[0] === 'renameTheme'), [], 'no request for a refused name')
  // account not ready / changed
  accountState.current = false
  const paused = await guarded.row('th-b').props.onRename('Fine name'); accountState.current = true
  is(paused.ok, false); is(paused.message, 'Another library action is still running. Try again in a moment.'); eq(guarded.calls.filter(c => c[0] === 'renameTheme'), [], 'not while the account is being verified')
  // an account change while the save is out: nothing written, nothing said
  const swap = deferred(); const swapped = mountWorkspace({ flag: 'true', account: STANDALONE_ACCOUNT, api: { renameTheme: async (id, name) => { await swap.promise; return { id, name } } } }); await swapped.settle(); await swapped.mode('library')
  const swapPending = swapped.row('th-b').props.onRename('Moved'); accountState.current = false; swap.resolve(); const swapResult = await swapPending; accountState.current = true
  is(swapResult.stale, true, 'a changed account makes the answer stale')
  // an unmounted page: no writes, no notice
  const gone = deferred(); const leaving = mountWorkspace({ flag: 'true', account: STANDALONE_ACCOUNT, api: { renameTheme: async (id, name) => { await gone.promise; return { id, name } } } }); await leaving.settle(); await leaving.mode('library')
  const leavingPending = leaving.row('th-b').props.onRename('Bye'); leaving.rt.unmount(); gone.resolve(); is((await leavingPending).stale, true, 'an unmounted page: stale, nothing written')
  // a library read already in flight cannot put the old name back
  const readGate = deferred(); let reads = 0
  const racing = mountWorkspace({ flag: 'true', api: { listThemes: async () => { reads++; if (reads === 1) return { themes: plain([EVERGREEN, HARBOR, SUNRISE]), count: 3 }; await readGate.promise; return { themes: plain([EVERGREEN, HARBOR, SUNRISE]), count: 3 } } } })
  await racing.settle(); await racing.mode('library')
  racing.rt.one(n => n.type === 'button' && n.props['aria-label'] === 'Refresh themes').props.onClick(); racing.rt.render()
  const raced = await racing.row('th-b').props.onRename('Renamed during a read'); readGate.resolve(); await racing.settle()
  is(raced.ok, true); eq(racing.names(), ['Evergreen', 'Renamed during a read', 'Sunrise'], 'the late library answer (old names) is dropped')

  // ---- delete ------------------------------------------------------------------------------------------------------------------------------------------------------------
  const del = mountWorkspace({ flag: 'true', themes: [EVERGREEN, HARBOR, SUNRISE, BUILT_IN], account: STANDALONE_ACCOUNT }); await del.settle(); await del.mode('library')
  ok(del.context().includes('Standard for new presentations: Evergreen')); del.select('th-b')
  const gate2 = deferred(); del.calls.length = 0
  const deleteGate = mountWorkspace({ flag: 'true', api: { deleteTheme: async () => { await gate2.promise; return true } } }); await deleteGate.settle(); await deleteGate.mode('library'); deleteGate.select('th-b')
  const deleting = deleteGate.row('th-b').props.onDelete(); deleteGate.rt.render()
  eq(deleteGate.names(), ['Evergreen', 'Harbor', 'Sunrise'], 'the theme stays in the list until Director confirms'); gate2.resolve()
  eq(await deleting, { ok: true, name: 'Harbor' }); await deleteGate.settle()
  eq(deleteGate.names(), ['Evergreen', 'Sunrise'], 'then it leaves'); ok(deleteGate.notices().includes('“Harbor” was deleted from your library.'), deleteGate.notices().join('|'))
  eq(deleteGate.rt.find(n => n.type === 'button' && n.props.className === 'sl-record' && n.props['aria-pressed']).map(n => n.key), ['th-c'], 'the selection moved to the next theme'); ok(deleteGate.heading().includes('Sunrise'))
  eq(deleteGate.calls.filter(c => c[0] === 'deleteTheme'), [['deleteTheme', 'th-b']], 'one DELETE: the id only'); eq(deleteGate.rows().map(n => n.key), ['th-a', 'th-c'])
  // deleting the standard theme: the context line follows, and the dialog already said so
  const std = mountWorkspace({ flag: 'true' }); await std.settle(); await std.mode('library'); ok(std.context().includes('Evergreen')); is(std.row('th-a').props.isStandard, true)
  await std.row('th-a').props.onDelete(); await std.settle(); ok(std.context().includes('No saved standard'), std.context()); eq(std.names(), ['Harbor', 'Sunrise'])
  eq(std.rt.find(n => n.type === 'button' && n.props.className === 'sl-record' && n.props['aria-pressed']).map(n => n.key), ['th-b'], 'the selection fell to the next row')
  // last theme: the empty library
  const last = mountWorkspace({ flag: 'true', themes: [HARBOR] }); await last.settle(); await last.mode('library'); await last.row('th-b').props.onDelete(); await last.settle()
  is(last.rows().length, 0); ok(last.rt.find(n => n.props?.className === 'sl-empty').length === 1, 'the empty state shows'); ok(last.heading().includes('Choose your visual identity'), 'and the preview has nothing selected')
  // refused delete: nothing changes, the reason comes back
  for (const deleteTheme of [async () => false, async () => { throw new Error('boom') }]) {
    const failed = mountWorkspace({ flag: 'true', api: { deleteTheme } }); await failed.settle(); await failed.mode('library'); failed.select('th-b')
    const result = await failed.row('th-b').props.onDelete(); await failed.settle()
    is(result.ok, false); is(result.message, '“Harbor” was not deleted and is still in your library. Try again, or refresh the library to check.'); eq(failed.names(), ['Evergreen', 'Harbor', 'Sunrise'], 'still listed'); ok(failed.heading().includes('Harbor'), 'still selected')
    ok(!failed.notices().some(n => /was deleted/.test(n)), 'no "deleted" notice')
  }
  // a read in flight cannot bring the deleted theme back
  const readGate2 = deferred(); let reads2 = 0
  const racing2 = mountWorkspace({ flag: 'true', api: { listThemes: async () => { reads2++; if (reads2 > 1) await readGate2.promise; return { themes: plain([EVERGREEN, HARBOR, SUNRISE]), count: 3 } } } })
  await racing2.settle(); await racing2.mode('library'); racing2.rt.one(n => n.type === 'button' && n.props['aria-label'] === 'Refresh themes').props.onClick(); racing2.rt.render()
  await racing2.row('th-c').props.onDelete(); readGate2.resolve(); await racing2.settle(); eq(racing2.names(), ['Evergreen', 'Harbor'], 'the late library answer is dropped')
  // account and unmount
  accountState.current = false; const blocked = await del.row('th-b').props.onDelete(); accountState.current = true; is(blocked.ok, false); eq(del.calls.filter(c => c[0] === 'deleteTheme'), [], 'no request while the account is being verified')
  const away = deferred(); const unmounted = mountWorkspace({ flag: 'true', api: { deleteTheme: async () => { await away.promise; return true } } }); await unmounted.settle(); await unmounted.mode('library')
  const awayPending = unmounted.row('th-b').props.onDelete(); unmounted.rt.unmount(); away.resolve(); is((await awayPending).stale, true, 'an unmounted page: nothing written')
  // the menu is disabled while a save is running or the library is loading
  ok(del.rows().every(n => n.props.disabled === false), 'enabled when idle')
}

console.log(`studio-theme-library-manage: ${checks} checks passed`)
