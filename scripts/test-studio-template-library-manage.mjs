// FRONTEND-2 Pass 3 track 4 (delete) + FRONTEND-1 Pass 3 (rename): delete and rename on the user's own saved templates in the Templates library (/studio/templates). Flag NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE (exact "true"), default off, read at build time.
// DELETE is FRONTEND-2's: Director has DELETE /api/users/{uid}/templates/{id} (200 { status: "deleted", id }); the Next proxy app/api/templates/[id]/route.ts forwards it and hooks/use-templates.ts has deleteTemplate.
// RENAME is Director's DIRECTOR-2 route PATCH /api/users/{uid}/templates/{id} body { name } (1..150 characters, trimmed; Director !519, behind DIRECTOR_TEMPLATE_RENAME_ENABLED, default off, then it answers 405 Allow: GET): 200 the list-row
// summary, 404 { detail: "template not found" } (missing, another user's, a hidden import row: one body), 409 a name the person already has, 422 a refused name, 401/403 the REST entitlement refusal. Studio side: a PATCH in the proxy (404 while the
// flag is off, before any session read or Director call; only { name } is forwarded), renameTemplate in the hook (which reads each answer as one reason), runLibraryRename in the workspace (optimistic, the old name comes back with the reason) and a
// Rename item in the row's menu, as on the Themes page. A Director that answers 405 (or a 404 that is not "template not found") has its rename switched off: Rename then shows disabled with a reason. Composer (stage-carrier) templates rename
// too (name only, COMPOSER-2); they stay undeletable in v1 (Director's DELETE would leave the carrier bytes and "uses" rows behind). Every Director answer Director recorded (scripts/fixtures/template-rename/*.json, all 14) is replayed here
// through the real hook and the real proxy. Not deployed, so every request goes to a recording fake. No network, no secrets, no model call.
//
// Run: node scripts/test-studio-template-library-manage.mjs     (plain node: the real TypeScript transpiled and run in a vm with a small fake React)
//   --mutation-check   also: break the code in several ways in memory, each must be caught by this suite (a mutant whose text is missing or occurs twice is reported INVALID, never as caught)
//
// What it pins: 1. the flag (exact "true", default off, documented; read inline in the Templates workspace and in the rename proxy only); 2. the wire (deleteTemplate -> DELETE, unchanged; renameTemplate -> PATCH /api/templates/{id} with { name }
// only -> Director) and how each answer is read; 3. Director's recorded answers, replayed end to end; 4. flag off the Templates page renders exactly what the base renders and, with this change's lines stripped, the workspace, the hook,
// the proxy and .env.example are the base's, byte for byte; 5. flag on: only the person's own templates (Composer ones included) get a menu, built-ins none; delete leaves the list only when Director confirms; rename is optimistic and every
// refusal puts the old name back and says why; the selection and the preview follow; failure, a library read in flight, an optimization request, an account change and an unmount.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LIBRARY_MANAGE_ADDITIONS, ENV_FILE, LIBRARY_MANAGE_NEW_FILES, TEMPLATES_WORKSPACE, THEME_HOOK, THEMES_WORKSPACE, stripLibraryManage } from './studio-library-manage-strip.mjs'
import { BASE_COMMIT, STACKED_P2_FILES, STACKED_PASS3_FILES, baseSource, createRuntime, deferred, isBaseFile, jsxRuntime, loadSource, makeReader, plain, root, sha, text, tick } from './studio-library-manage-harness.mjs'

const here = fileURLToPath(import.meta.url)
const FLAG = 'NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE'
const LIB = 'lib/studio-library-manage.ts'
const ROW = 'components/studio-libraries/library-manage.tsx'
const PAGE = 'app/(app)/studio/templates/page.tsx'
const PROXY = 'app/api/templates/[id]/route.ts'
const USE_TEMPLATES = 'hooks/use-templates.ts'

const MUTATIONS = [
  // ---- delete (FRONTEND-2's)
  { name: 'a refused delete still leaves the list', file: LIB, from: '  if (!deleted) return { ok: false, message: deleteFailedText(kind, item.name) }\n', to: '' },
  { name: 'delete leaves the list before Director answers', file: LIB, from: '  let deleted = false\n', to: "  deps.setItems(list => withoutItem(list, id))\n  let deleted = false\n" },
  { name: 'a built-in row counts as the person\'s own', file: LIB, from: "'is_builtin', ", to: '' },
  { name: 'selection does not move after a delete', file: LIB, from: '  if (selectedId !== removedId) return selectedId\n', to: '  return selectedId\n' },
  { name: 'template dialog copy loses the rebuilding warning', file: LIB, from: ' A Studio session that is still rebuilding from it cannot continue with it.', to: '' },
  { name: 'flag read loosely', file: TEMPLATES_WORKSPACE, from: "process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE === 'true'", to: 'Boolean(process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE)' },
  { name: 'built-in rows get a menu', file: TEMPLATES_WORKSPACE, from: 'TEMPLATE_LIBRARY_MANAGE && isUserOwnedLibraryItem(template)', to: 'TEMPLATE_LIBRARY_MANAGE' },
  { name: 'the selection is not moved after a delete', file: TEMPLATES_WORKSPACE, from: 'setSelectedId(current => selectionAfterRemoval(before, template.id, current)); ', to: '' },
  { name: 'a library read in flight is not retired by a delete', file: TEMPLATES_WORKSPACE, from: "listRequest.current += 1; setLoading(false); setActionError(''); setActionNotice('') // a library read already in flight must not bring the template back", to: "setLoading(false); setActionError(''); setActionNotice('')" },
  { name: 'delete allowed while an optimization request is out', file: TEMPLATES_WORKSPACE, from: 'if (!canStartAccountAction() || optimizeBusy.current) return { ok: false as const, message: BUSY_TEXT }\n    const before = templates ?? []', to: 'if (!canStartAccountAction()) return { ok: false as const, message: BUSY_TEXT }\n    const before = templates ?? []' },
  { name: 'menu stays enabled during an optimization request', file: TEMPLATES_WORKSPACE, from: 'disabled={!accountReady || loading || Boolean(optimizingId)} deleteBlockedReason=', to: 'disabled={!accountReady || loading} deleteBlockedReason=' },
  { name: 'a Composer template can be deleted (no guard in the handler)', file: TEMPLATES_WORKSPACE, from: "    if ('stage_template_summary' in template) return { ok: false as const, message: COMPOSER_TEMPLATE_DELETE_REASON }", to: '' },
  { name: 'a Composer template row is not marked blocked', file: TEMPLATES_WORKSPACE, from: "deleteBlockedReason={'stage_template_summary' in template ? COMPOSER_TEMPLATE_DELETE_REASON : undefined} ", to: '' },
  { name: 'the Delete item is enabled for a blocked row', file: ROW, from: 'disabled={Boolean(deleteBlockedReason)} aria-describedby', to: 'disabled={false} aria-describedby' },
  { name: 'a blocked row still opens the dialog', file: ROW, from: 'onSelect={() => { if (deleteBlockedReason) return; setDeleteError', to: 'onSelect={() => { setDeleteError' },
  { name: 'a blocked row can still confirm a delete', file: ROW, from: 'if (deleting || deleteBlockedReason) return', to: 'if (deleting) return' },
  { name: 'the reason is not shown', file: ROW, from: '{deleteBlockedReason && <p id={noteId}', to: '{false && <p id={noteId}' },
  { name: 'Delete confirm button does nothing', file: ROW, from: 'onClick={event => { event.preventDefault(); void confirmDelete() }}', to: 'onClick={event => { event.preventDefault() }}' },
  { name: 'window.confirm instead of the dialog', file: ROW, from: "onSelect={() => { if (deleteBlockedReason) return; setDeleteError(''); setConfirming(true) }}", to: "onSelect={() => { if (deleteBlockedReason) return; if (window.confirm('Delete?')) void confirmDelete() }}" },
  { name: 'deleteTemplate uses POST', file: USE_TEMPLATES, from: "{ method: 'DELETE' }", to: "{ method: 'POST' }" },
  // ---- rename: the words (lib)
  { name: 'a refusal leaves the new name on screen', file: LIB, from: "    deps.setItems(list => list ? list.map(candidate => candidate.id === id && candidate.name === name ? { ...candidate, name: previous } : candidate) : list)\n    return { ok: false, message: saved.message", to: "    return { ok: false, message: saved.message" },
  { name: 'a refusal loses its field mark', file: LIB, from: ', ...(saved.field ? { field: true as const } : {})', to: '' },
  { name: 'gone: the message does not say it is gone', file: LIB, from: 'is no longer available, so it was not renamed.', to: 'could not be renamed.' },
  { name: 'gone: the message names no template', file: LIB, from: "case 'gone': return { refused: true, message: `“${previousName}” is no longer", to: "case 'gone': return { refused: true, message: `This template is no longer" },
  { name: 'taken is not a field message', file: LIB, from: "case 'taken': return { refused: true, field: true, message:", to: "case 'taken': return { refused: true, message:" },
  { name: 'taken: the message loses its advice', file: LIB, from: 'A template with that name already exists. Choose a different name.', to: 'A template with that name already exists.' },
  { name: 'invalid is not a field message', file: LIB, from: "case 'invalid': return { refused: true, field: true, message:", to: "case 'invalid': return { refused: true, message:" },
  { name: 'invalid ignores the sentence Director gave', file: LIB, from: 'message: failure.detail || `Use 1 to', to: 'message: `Use 1 to' },
  { name: 'invalid fallback names another limit', file: LIB, from: 'Use 1 to ${LIBRARY_NAME_MAX} characters.', to: 'Use 1 to 300 characters.' },
  { name: 'unavailable is a field message', file: LIB, from: "case 'unavailable': return { refused: true, message:", to: "case 'unavailable': return { refused: true, field: true, message:" },
  { name: 'unavailable: the reason is reworded', file: LIB, from: "export const TEMPLATE_RENAME_UNAVAILABLE_REASON = \"Renaming templates isn't available yet.\"", to: "export const TEMPLATE_RENAME_UNAVAILABLE_REASON = 'Rename is off.'" },
  { name: 'sign-in: the message gives no way on', file: LIB, from: ' Reload the page and try again.`', to: '`' },
  { name: 'any other failure blames the name', file: LIB, from: 'was not renamed and keeps its old name. Try again, or refresh the library to check.', to: 'was not renamed. Another template may already use that name.' },
  // ---- rename: the hook
  { name: 'rename sends PUT', file: USE_TEMPLATES, from: "        method: 'PATCH',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ name }),", to: "        method: 'PUT',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ name })," },
  { name: 'rename sends more than the name', file: USE_TEMPLATES, from: 'body: JSON.stringify({ name }),', to: 'body: JSON.stringify({ name, description: null }),' },
  { name: 'rename goes to the blueprint route', file: USE_TEMPLATES, from: "const res = await fetch(`/api/templates/${encodeURIComponent(id)}`, {\n        method: 'PATCH',", to: "const res = await fetch(`/api/templates/${encodeURIComponent(id)}/blueprint`, {\n        method: 'PATCH'," },
  { name: 'the id is not URL-encoded for a rename', file: USE_TEMPLATES, from: "const res = await fetch(`/api/templates/${encodeURIComponent(id)}`, {\n        method: 'PATCH',", to: "const res = await fetch(`/api/templates/${id}`, {\n        method: 'PATCH'," },
  { name: 'a 200 without an id counts as saved', file: USE_TEMPLATES, from: "      if (!data || typeof data.id !== 'string') return { ok: false, reason: 'failed' };\n", to: '' },
  { name: 'a network error throws out of the rename', file: USE_TEMPLATES, from: "      return { ok: false, reason: 'failed' };\n    } finally {", to: "      throw e;\n    } finally {" },
  { name: 'the hook does not return renameTemplate', file: USE_TEMPLATES, from: '    deleteTemplate,\n    renameTemplate,\n    updateTemplateBlueprint,', to: '    deleteTemplate,\n    updateTemplateBlueprint,' },
  { name: 'a 404 "template not found" reads as unavailable', file: USE_TEMPLATES, from: "detail === 'template not found' ? { reason: 'gone' } : { reason: 'unavailable' }", to: "detail === 'template not found' ? { reason: 'unavailable' } : { reason: 'unavailable' }" },
  { name: 'any 404 reads as gone', file: USE_TEMPLATES, from: "detail === 'template not found' ? { reason: 'gone' } : { reason: 'unavailable' }", to: "detail === 'template not found' ? { reason: 'gone' } : { reason: 'gone' }" },
  { name: 'a 405 reads as a plain failure', file: USE_TEMPLATES, from: "if (status === 405) return { reason: 'unavailable' };", to: "if (status === 405) return { reason: 'failed' };" },
  { name: 'a 409 reads as a plain failure', file: USE_TEMPLATES, from: "if (status === 409) return { reason: 'taken' };", to: "if (status === 409) return { reason: 'failed' };" },
  { name: 'a 422 loses Director\'s sentence', file: USE_TEMPLATES, from: "{ reason: 'invalid', detail: detail.trim() }", to: "{ reason: 'invalid' }" },
  { name: 'a 422 sentence of any length is shown', file: USE_TEMPLATES, from: ' && detail.length <= 200', to: '' },
  { name: 'a 403 reads as a plain failure', file: USE_TEMPLATES, from: "if (status === 401 || status === 403) return { reason: 'sign_in' };", to: "if (status === 401) return { reason: 'sign_in' };" },
  // ---- rename: the proxy
  { name: 'the proxy answers with the flag off', file: PROXY, from: "  if (process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE !== 'true') return NextResponse.json({ error: 'template_rename_not_enabled' }, { status: 404 });\n", to: '' },
  { name: 'the proxy reads the flag loosely', file: PROXY, from: "if (process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE !== 'true')", to: 'if (!process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE)' },
  { name: 'the proxy reads the session before the flag', file: PROXY, from: "{\n  if (process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE !== 'true') return NextResponse.json({ error: 'template_rename_not_enabled' }, { status: 404 });\n  const userId = await resolveUserId();\n", to: "{\n  const userId = await resolveUserId();\n  if (process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE !== 'true') return NextResponse.json({ error: 'template_rename_not_enabled' }, { status: 404 });\n" },
  { name: 'the proxy forwards the whole body', file: PROXY, from: 'body: JSON.stringify({ name }) }', to: 'body: JSON.stringify(payload) }' },
  { name: 'the proxy forwards with PUT', file: PROXY, from: "{ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }", to: "{ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }" },
  { name: 'the proxy forwards without the JSON header', file: PROXY, from: "{ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body", to: "{ method: 'PATCH', body" },
  { name: 'the proxy answers a signed-out call 403', file: PROXY, from: "{ status: 401 });\n  const { id } = await params;\n  let payload", to: "{ status: 403 });\n  const { id } = await params;\n  let payload" },
  { name: 'the proxy lets an unreadable body through', file: PROXY, from: "    return NextResponse.json({ error: 'invalid json' }, { status: 400 });", to: '    payload = {};' },
  { name: 'an unreadable Director body loses its status', file: PROXY, from: 'await r.json().catch(() => ({}));', to: 'await r.json();' },
  // ---- rename: the workspace and the row
  { name: 'the workspace passes no onRename', file: TEMPLATES_WORKSPACE, from: ' onRename={nextName => manageRename(template, nextName)}', to: '' },
  { name: 'the duplicate check includes the template itself', file: TEMPLATES_WORKSPACE, from: 'otherNames={(templates ?? []).filter(item => item.id !== template.id).map(item => item.name)}', to: 'otherNames={(templates ?? []).map(item => item.name)}' },
  { name: 'a library read in flight is not retired by a rename', file: TEMPLATES_WORKSPACE, from: "listRequest.current += 1; setLoading(false); setActionError(''); setActionNotice('') // a library read already in flight must not put the old name back over the new one\n", to: "setLoading(false); setActionError(''); setActionNotice('')\n" },
  { name: 'rename allowed while an optimization request is out', file: TEMPLATES_WORKSPACE, from: 'const manageRename = async (template: SavedTemplate, nextName: string) => {\n    if (!canStartAccountAction() || optimizeBusy.current) return', to: 'const manageRename = async (template: SavedTemplate, nextName: string) => {\n    if (!canStartAccountAction()) return' },
  { name: 'a Composer template cannot be renamed', file: TEMPLATES_WORKSPACE, from: 'const manageRename = async (template: SavedTemplate, nextName: string) => {\n', to: "const manageRename = async (template: SavedTemplate, nextName: string) => {\n    if ('stage_template_summary' in template) return { ok: false as const, message: 'no' }\n" },
  { name: 'an unavailable rename is not remembered', file: TEMPLATES_WORKSPACE, from: "      if (answer.reason === 'unavailable' && isCurrentAccount()) setRenameUnavailable(true)\n", to: '' },
  { name: 'every refusal turns Rename off', file: TEMPLATES_WORKSPACE, from: "if (answer.reason === 'unavailable' && isCurrentAccount()) setRenameUnavailable(true)", to: 'if (isCurrentAccount()) setRenameUnavailable(true)' },
  { name: 'the row is not told Rename is off', file: TEMPLATES_WORKSPACE, from: 'renameBlockedReason={renameUnavailable ? TEMPLATE_RENAME_UNAVAILABLE_REASON : undefined} ', to: '' },
  { name: 'the open preview keeps the old name', file: TEMPLATES_WORKSPACE, from: "      setSnapshot(current => current?.id === id ? { ...current, name: result.name, ...(updated_at ? { updated_at } : {}) } : current)\n", to: '' },
  { name: 'a rename says nothing when it is saved', file: TEMPLATES_WORKSPACE, from: "      if (result.name !== template.name) setActionNotice(`“${template.name}” is now “${result.name}”.`)\n", to: '' },
  { name: 'a refused name is a toast, not a field message', file: ROW, from: "      if (!result.ok && result.field && !result.stale && result.message && alive.current) { setProblem(result.message); setEditing(true); return } // a name Director refused: the field comes back with what was typed\n", to: '' },
  { name: 'the Rename item is enabled while Rename is off', file: ROW, from: 'disabled={Boolean(renameBlockedReason)} aria-describedby={renameBlockedReason ? renameNoteId : undefined}', to: 'disabled={false} aria-describedby={renameBlockedReason ? renameNoteId : undefined}' },
  { name: 'a blocked Rename still opens the field', file: ROW, from: 'onSelect={() => { if (renameBlockedReason) return; startRename() }}', to: 'onSelect={() => { startRename() }}' },
  { name: 'the Rename reason is not shown', file: ROW, from: '{onRename && renameBlockedReason && <p id={renameNoteId}', to: '{false && <p id={renameNoteId}' },
]
const read = makeReader(MUTATIONS, 'TEMPLATE_MANAGE_TEST_MUTATION')
// A mutant is judged by behaviour: with one applied, the byte-for-byte "without this change's lines it is the base's file" pins are skipped (they would trip on any edit of a pinned line and hide whether the behaviour checks notice it). The normal run keeps them.
const MUTATING = process.env.TEMPLATE_MANAGE_TEST_MUTATION !== undefined

if (process.argv.includes('--mutation-check')) {
  let caught = 0, invalid = 0
  MUTATIONS.forEach((mutation, index) => {
    const occurrences = fs.readFileSync(path.join(root, mutation.file), 'utf8').split(mutation.from).length - 1
    if (occurrences !== 1) { console.error(`INVALID: ${mutation.name} (its text occurs ${occurrences} times in ${mutation.file}, not once)`); invalid++; process.exitCode = 1; return }
    const child = spawnSync(process.execPath, [...process.execArgv, here], { env: { ...process.env, TEMPLATE_MANAGE_TEST_MUTATION: String(index) }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    if (child.status === 0) { console.error(`NOT CAUGHT: ${mutation.name}`); process.exitCode = 1 } else if (/no longer applies/.test(child.stderr)) { console.error(`INVALID: ${mutation.name} (its text no longer applies)`); invalid++; process.exitCode = 1 } else { caught++; console.log(`ok   mutant caught: ${mutation.name}`) }
  })
  console.log(`mutation check: ${caught}/${MUTATIONS.length} mutants caught${invalid ? `, ${invalid} invalid` : ''}`)
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
  eq(reads.sort(), [PROXY, TEMPLATES_WORKSPACE], 'only the Templates workspace and the rename proxy read the flag (not the page, the row, the hook or the lib)')
  const PROXY_SOURCE = read(PROXY)
  is(PROXY_SOURCE.split(`process.env.${FLAG}`).length - 1, 1, 'the proxy reads it once'); ok(PROXY_SOURCE.includes(`if (process.env.${FLAG} !== 'true') return NextResponse.json({ error: 'template_rename_not_enabled' }, { status: 404 });`), 'exact "true", and 404 when it is not')
  is(WORKSPACE_SOURCE.split(`process.env.${FLAG} === 'true'`).length - 1, 1, 'exact "true", read inline once'); is(WORKSPACE_SOURCE.split(`process.env.${FLAG}`).length - 1, 1)
  is((read('.env.example').match(new RegExp(`^${FLAG}="false"$`, 'gm')) ?? []).length, 1, '.env.example documents the flag, default "false", once')
  ok(read('.env.example').indexOf('# PASS3 LIBRARY MANAGE') > read('.env.example').indexOf('NEXT_PUBLIC_STUDIO_P2_POLISH="false"') && read('.env.example').indexOf('NEXT_PUBLIC_STUDIO_P2_POLISH="false"') > 0, '.env.example: the block comes after the polish flag\'s block (the polish pin holds everything before that block to its base)')
  ok(!read('.env.example').split('\n').some(line => /^NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE=/.test(line) && !/="false"$/.test(line)), 'and it is never documented as on')
  const envText = read('.env.example'), envFlat = envText.replace(/\n# ?/g, ' ')
  ok(/There is NO Rename for a template: Director has no template rename route/.test(envFlat), '.env.example: the older block is untouched (append-only), so its sentence is still there...')
  ok(/this block supersedes the sentence above that says a template has no Rename/.test(envFlat) && envText.indexOf('# TEMPLATE RENAME (FRONTEND-1') > envText.indexOf('NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE="false"'), '...and a later block says so: it supersedes that sentence')
  is((envText.match(/^# TEMPLATE RENAME \(FRONTEND-1/gm) ?? []).length, 1, 'once')
  is(envText.charAt(envText.indexOf('# TEMPLATE RENAME (FRONTEND-1') - 2), '\n', 'a blank line closes the flag block above it (the Docs pin requires one after its flag line)')
  ok(envText.slice(envText.indexOf('# TEMPLATE RENAME (FRONTEND-1')).split('\n').filter(Boolean).every(line => line.startsWith('# ')), 'the whole block is comment lines (no new flag, no new assignment)')
  ok(/Studio calls PATCH \/api\/templates\/\{id\} with \{ name \} only, which forwards to Director's PATCH \/api\/users\/\{uid\}\/templates\/\{id\}/.test(envFlat) && /DIRECTOR_TEMPLATE_RENAME_ENABLED on the Director \(default off, and it then answers 405\)/.test(envFlat), 'the block names the route, the Director flag and its 405')
  ok(/A Composer template renames too: only its name changes \(Delete stays disabled for it\)/.test(envFlat) && /Renaming templates isn't available yet\./.test(envFlat), 'and the Composer rule and the words shown while the route is off')
  ok(!/exact "true" enables it/.test(envText.slice(envText.indexOf('# TEMPLATE RENAME (FRONTEND-1'))), 'the block avoids the phrase another flag\'s test pins')
  const basePage = baseSource(PAGE); if (basePage !== null) is(read(PAGE), basePage, 'the Templates page file is the base\'s')
  ok(!/\b(window\.)?(confirm|alert|prompt)\s*\(/.test(read(ROW).replace(/\/\/[^\n]*/g, '')), 'the row never calls window.confirm / alert / prompt')
}

// ================================================================== 2. the wire: delete (unchanged) and rename ===============================================================
const reactStub = { useCallback: fn => fn, useState: initial => [initial, () => {}] }
const hookWith = fetchImpl => loadSource(read(USE_TEMPLATES), { react: reactStub }, { file: USE_TEMPLATES, globals: { fetch: fetchImpl } })
const wire = []
{
  const hookExports = hookWith(async (url, init) => { wire.push([url, init]); return { ok: true, status: 200, json: async () => ({ status: 'deleted' }) } })
  const hook = hookExports.useTemplates()
  is(await hook.deleteTemplate('tp 1'), true); eq(wire, [['/api/templates/tp%201', { method: 'DELETE' }]], 'deleteTemplate: DELETE /api/templates/{id}, the id URL-encoded, no body')
  const bad = hookWith(async () => ({ ok: false, status: 500, json: async () => ({}) })).useTemplates()
  is(await bad.deleteTemplate('a'), false, 'a refused delete is false'); is(await hookWith(async () => { throw new Error('offline') }).useTemplates().deleteTemplate('a'), false, 'and so is a network error')
  eq(Object.keys(hook).sort(), ['deleteTemplate', 'error', 'getTemplate', 'listTemplates', 'loading', 'renameTemplate', 'reoptimizeTemplate', 'saveTemplate', 'updateTemplateBlueprint', 'watchTemplateStatus'], 'the hook: every function it had, plus renameTemplate')
  ok(Object.keys(hookExports).includes('templateRenameFailure'), 'the reading of Director\'s answer is exported (and pure)')
}
{
  // rename: the request, then each answer read as one reason
  const sent = []
  const answering = (status, body, { throws } = {}) => hookWith(async (url, init) => {
    sent.push([url, init]); if (throws) throw new Error('offline')
    return { ok: status >= 200 && status < 300, status, json: async () => { if (body === undefined) throw new Error('no body'); return body } }
  }).useTemplates()
  const SAVED = { id: 'tp 1', name: 'New name', updated_at: '2026-10-22T10:00:00Z' }
  eq(await answering(200, SAVED).renameTemplate('tp 1', 'New name'), { ok: true, template: SAVED }, 'a 200 is the saved row')
  eq(sent, [['/api/templates/tp%201', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"name":"New name"}' }]], 'renameTemplate: PATCH /api/templates/{id}, the id URL-encoded, a body of exactly { name }')
  eq(Object.keys(JSON.parse(sent[0][1].body)), ['name'], 'nothing but the name is ever sent')
  const reason = async (status, body, options) => (await answering(status, body, options).renameTemplate('a', 'b'))
  eq(await reason(200, {}), { ok: false, reason: 'failed' }, 'a 200 that is not a saved row is not a rename'); eq(await reason(200, undefined), { ok: false, reason: 'failed' }, 'nor is a 200 with no body'); eq(await reason(200, null), { ok: false, reason: 'failed' })
  eq(await reason(0, undefined, { throws: true }), { ok: false, reason: 'failed' }, 'a network error is a plain failure and never throws')
  const { templateRenameFailure } = hookWith(async () => ({}))
  for (const [status, body, expected, why] of [
    [404, { detail: 'template not found' }, { reason: 'gone' }, 'Director\'s 404 (missing, another user\'s, a hidden import row): the template is no longer there'],
    [404, { detail: 'Not Found' }, { reason: 'unavailable' }, 'a 404 with any other body is a missing route, not a missing template'],
    [404, { error: 'template_rename_not_enabled' }, { reason: 'unavailable' }, 'Studio\'s own proxy with the flag off'],
    [404, {}, { reason: 'unavailable' }, 'a 404 with no body'], [404, null, { reason: 'unavailable' }, 'a 404 whose body is null'], [404, 'text', { reason: 'unavailable' }, 'a 404 whose body is text'],
    [405, { detail: 'Method Not Allowed' }, { reason: 'unavailable' }, 'Director with DIRECTOR_TEMPLATE_RENAME_ENABLED off (its default)'], [405, undefined, { reason: 'unavailable' }, 'a 405 with no body'],
    [409, { detail: 'A template with that name already exists.' }, { reason: 'taken' }, 'a name the person already has'],
    [422, { detail: 'A template name is required.' }, { reason: 'invalid', detail: 'A template name is required.' }, 'a refused name, in Director\'s words'],
    [422, { detail: '  Padded.  ' }, { reason: 'invalid', detail: 'Padded.' }, 'trimmed'], [422, { detail: '   ' }, { reason: 'invalid' }, 'a blank sentence is not shown'], [422, { detail: ['not', 'a', 'sentence'] }, { reason: 'invalid' }, 'a list of validation errors is not shown'],
    [422, { detail: 'x'.repeat(201) }, { reason: 'invalid' }, 'an essay is not shown'], [422, {}, { reason: 'invalid' }, 'no sentence'],
    [401, { detail: 'x' }, { reason: 'sign_in' }, 'the sign-in could not be confirmed'], [403, { detail: 'x' }, { reason: 'sign_in' }, 'the sign-in is for another account'],
    [400, {}, { reason: 'failed' }, 'anything else'], [500, {}, { reason: 'failed' }, 'a server error'], [502, { error: 'director_unreachable' }, { reason: 'failed' }, 'Director unreachable'], [503, { error: 'x', code: 'y' }, { reason: 'failed' }, 'a service URL that is not configured'],
  ]) { eq(await reason(status, body), { ok: false, ...expected }, `${status} ${JSON.stringify(body)}: ${why}`); eq(templateRenameFailure(status, body), expected, `templateRenameFailure(${status}) reads the same`) }
}
// the proxy: PATCH, behind the flag
function proxyWith({ flag, session = { user: { id: 'person@example.com' } }, director = async () => ({ status: 200, json: async () => ({ id: 'tp 1', name: 'x' }) }), configError = false } = {}) {
  const calls = { session: 0, director: [] }
  class ServiceUrlConfigError extends Error { constructor() { super('Director URL is not configured'); this.code = 'SERVICE_URL_MISSING' } }
  const route = loadSource(read(PROXY), {
    '@/lib/service-url': { requireServiceUrl: () => { if (configError) throw new ServiceUrlConfigError(); return 'https://director.example.invalid' }, ServiceUrlConfigError },
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) }, NextRequest: class {} },
    'next-auth': { getServerSession: async () => { calls.session++; return session } }, '@/lib/auth-options': { authOptions: {} },
  }, { file: PROXY, env: flag === undefined ? {} : { [FLAG]: flag }, globals: { fetch: async (url, init) => { calls.director.push([url, init]); return director(url, init) } } })
  return { route, calls }
}
const untouched = () => { const reads = { params: 0, body: 0 }; return { reads, req: { json: async () => { reads.body++; return { name: 'x' } } }, ctx: { params: { get then() { reads.params++; throw new Error('parameters must not be read') } } } } }
{
  const director = []
  const { route } = proxyWith({ flag: 'true', director: async (url, init) => { director.push([url, init]); return { status: 200, json: async () => ({ status: 'deleted', id: 'tp 1' }) } } })
  await route.DELETE({}, { params: Promise.resolve({ id: 'tp 1' }) })
  eq(director, [['https://director.example.invalid/api/users/person%40example.com/templates/tp%201', { method: 'DELETE' }]], 'the proxy forwards DELETE to Director\'s /api/users/{uid}/templates/{id}, unchanged')
  eq(Object.keys(route).sort(), ['DELETE', 'GET', 'PATCH'], 'the proxy has GET, DELETE and now PATCH (no PUT, no POST)')
  is(typeof route.PATCH, 'function')
  // flag off (any spelling but "true"): 404 before the session, the body, the parameters or Director are touched
  for (const flag of [undefined, 'false', '', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'on']) {
    const p = proxyWith({ flag }); const u = untouched()
    eq(await p.route.PATCH(u.req, u.ctx), { body: { error: 'template_rename_not_enabled' }, status: 404 }, `flag ${JSON.stringify(flag)}: 404`)
    eq([p.calls.session, p.calls.director.length, u.reads.params, u.reads.body], [0, 0, 0, 0], `flag ${JSON.stringify(flag)}: no session read, no Director call, no body, no parameters`)
  }
  // flag on, signed out: 401 before the body or the parameters
  for (const session of [null, {}, { user: {} }]) {
    const p = proxyWith({ flag: 'true', session }); const u = untouched()
    eq(await p.route.PATCH(u.req, u.ctx), { body: { error: 'Unauthorized' }, status: 401 }); eq([p.calls.director.length, u.reads.params, u.reads.body], [0, 0, 0], 'signed out: nothing is read, nothing is sent')
  }
  // flag on: exactly { name } goes to Director, for the id the session owns
  for (const [session, owner] of [[{ user: { id: 'owner/ id?#é', email: 'not-selected@invalid.test' } }, 'owner/ id?#é'], [{ user: { email: 'owner+test@invalid.test' } }, 'owner+test@invalid.test']]) {
    const p = proxyWith({ flag: 'true', session })
    const answer = await p.route.PATCH({ json: async () => ({ name: 'New name', description: 'no', is_standard: true, template_blueprint: { slides: [] }, user_id: 'someone-else' }) }, { params: Promise.resolve({ id: 'resource/ id?#é' }) })
    eq(p.calls.director, [[`https://director.example.invalid/api/users/${encodeURIComponent(owner)}/templates/${encodeURIComponent('resource/ id?#é')}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"name":"New name"}' }]], 'only { name } is forwarded, to the signed-in person\'s own path')
    is(answer.status, 200)
  }
  for (const [payload, body] of [[{}, '{}'], [null, '{}'], [[], '{}'], ['name', '{}'], [{ name: 5 }, '{"name":5}'], [{ name: null }, '{"name":null}'], [{ name: '  padded  ' }, '{"name":"  padded  "}']]) {
    const p = proxyWith({ flag: 'true' }); await p.route.PATCH({ json: async () => payload }, { params: Promise.resolve({ id: 'a' }) })
    is(p.calls.director[0][1].body, body, `a body of ${JSON.stringify(payload)} becomes ${body} (Director refuses what is not a name)`)
  }
  // Director's answer comes back with its own status and body
  for (const [status, body] of [[200, { id: 'a', name: 'B' }], [404, { detail: 'template not found' }], [405, { detail: 'Method Not Allowed' }], [409, { detail: 'dup' }], [422, { detail: 'refused' }], [401, { code: 'ENTITLEMENT_REQUIRED' }], [403, { code: 'USER_MISMATCH' }], [500, { detail: 'boom' }]]) {
    const p = proxyWith({ flag: 'true', director: async () => ({ status, json: async () => body }) })
    eq(await p.route.PATCH({ json: async () => ({ name: 'B' }) }, { params: Promise.resolve({ id: 'a' }) }), { body, status }, `Director's ${status} goes back as it is`)
  }
  const noBody = proxyWith({ flag: 'true', director: async () => ({ status: 404, json: async () => { throw new Error('<html>') } }) })
  eq(await noBody.route.PATCH({ json: async () => ({ name: 'B' }) }, { params: Promise.resolve({ id: 'a' }) }), { body: {}, status: 404 }, 'a Director answer that is not JSON keeps its status (404 stays a 404, not a 502)')
  const badJson = proxyWith({ flag: 'true' })
  eq(await badJson.route.PATCH({ json: async () => { throw new Error('Supplied invalid JSON') } }, { params: Promise.resolve({ id: 'a' }) }), { body: { error: 'invalid json' }, status: 400 }); is(badJson.calls.director.length, 0, 'an unreadable body is a 400 and Director hears nothing')
  const down = proxyWith({ flag: 'true', director: async () => { throw new Error('offline') } })
  eq(await down.route.PATCH({ json: async () => ({ name: 'B' }) }, { params: Promise.resolve({ id: 'a' }) }), { body: { error: 'director_unreachable' }, status: 502 }, 'Director unreachable: 502')
  const unconfigured = proxyWith({ flag: 'true', configError: true })
  eq(await unconfigured.route.PATCH({ json: async () => ({ name: 'B' }) }, { params: Promise.resolve({ id: 'a' }) }), { body: { error: 'Director URL is not configured', code: 'SERVICE_URL_MISSING' }, status: 503 }, 'a Director URL that is not configured: 503, like the other methods')
  // the PATCH reads the parameters only after the session (like the other methods in this file)
  const order = proxyWith({ flag: 'true' }); const seen = []
  await order.route.PATCH({ json: async () => { seen.push('body'); return { name: 'x' } } }, { params: { get then() { seen.push('params'); return undefined } } })
  eq(seen, ['params', 'body'], 'the session is read first (it is checked above), then the parameters, then the body')
}

// ================================================================== 3. Director's recorded answers, replayed end to end ======================================================
// scripts/fixtures/template-rename/*.json are the real answers of Director's real route (DIRECTOR-2, 22 Oct 2026; see the README there). Each one goes through the real proxy (flag on) and the real hook; the words are the lib's.
const FIXTURE_DIR = path.join(root, 'scripts/fixtures/template-rename')
const RECORDED = fs.readdirSync(FIXTURE_DIR).filter(file => /^\d\d-.+\.json$/.test(file)).sort().map(file => ({ file, ...JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8')) }))
const EXPECT = {
  '01-200-ok.json': { ok: true, name: 'Q3 report' },
  '02-200-ok-composer-carrier.json': { ok: true, name: 'Quarterly original' },
  '03-404-not-found.json': { reason: 'gone' }, '04-404-other-user.json': { reason: 'gone' }, '05-404-hidden-import.json': { reason: 'gone' },
  '06-409-duplicate-name.json': { reason: 'taken' },
  '07-422-empty-name.json': { reason: 'invalid', detail: 'A template name is required.' }, '08-422-whitespace-only-name.json': { reason: 'invalid', detail: 'A template name is required.' },
  '09-422-name-too-long.json': { reason: 'invalid', detail: 'A template name can be at most 150 characters.' }, '10-422-not-a-name-body.json': { reason: 'invalid', detail: 'Only the template name can be changed here.' },
  '11-405-flag-off.json': { reason: 'unavailable' },
  '12-401-entitlement-missing.json': { reason: 'sign_in' }, '13-403-entitlement-other-user.json': { reason: 'sign_in' },
  '14-200-ok-with-entitlement.json': { ok: true, name: 'Q3 report' },
}
function recordedChain(rec) {
  const { route, calls } = proxyWith({ flag: 'true', session: { user: { id: 'user-a' } }, director: async () => ({ status: rec.response.status, json: async () => JSON.parse(JSON.stringify(rec.response.json_body)) }) })
  const hook = hookWith(async (url, init) => {
    const answer = await route.PATCH({ json: async () => JSON.parse(init.body) }, { params: Promise.resolve({ id: decodeURIComponent(url.split('/').pop()) }) })
    return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, json: async () => answer.body }
  }).useTemplates()
  return { hook, route, director: calls.director, id: rec.request.path.split('/').pop() }
}
const REFUSAL_WORDS = {
  gone: { message: '“April report” is no longer available, so it was not renamed. Refresh the library to see your current templates.' },
  taken: { message: 'A template with that name already exists. Choose a different name.', field: true },
  unavailable: { message: "Renaming templates isn't available yet. “April report” keeps its name." },
  sign_in: { message: "We couldn't confirm your sign-in for this change, so “April report” was not renamed. Reload the page and try again." },
}
{
  is(RECORDED.length, 14, 'fourteen recorded answers'); eq(RECORDED.map(rec => rec.file), Object.keys(EXPECT).sort(), 'every recorded answer has an expectation here, and none is left out')
  for (const rec of RECORDED) {
    const expected = EXPECT[rec.file]
    ok(rec.request.method === 'PATCH' && /^\/api\/users\/user-a\/templates\/[^/]+$/.test(rec.request.path), `${rec.file}: recorded as PATCH /api/users/{uid}/templates/{id}`)
    // the proxy hands Director the recorded request: the same path, PATCH, a body of { name } and nothing else (the recorded body of case 10 carries a description Studio never sends)
    const direct = recordedChain(rec)
    const proxied = await direct.route.PATCH({ json: async () => rec.request.json_body }, { params: Promise.resolve({ id: direct.id }) })
    eq(direct.director.map(([url, init]) => [url, init.method, init.body]), [[`https://director.example.invalid${rec.request.path}`, 'PATCH', JSON.stringify({ name: rec.request.json_body.name })]], `${rec.file}: Director is sent the recorded request, { name } only`)
    eq([proxied.status, proxied.body], [rec.response.status, rec.response.json_body], `${rec.file}: the proxy returns Director's status and body untouched`)
    // the hook reads it
    const chain = recordedChain(rec)
    const typed = rec.request.json_body.name
    const answer = await chain.hook.renameTemplate(chain.id, typed)
    eq(chain.director.map(([url, init]) => [url, init.body]), [[`https://director.example.invalid${rec.request.path}`, JSON.stringify({ name: typed })]], `${rec.file}: through the hook the same request goes out`)
    if (expected.ok) {
      eq(answer, { ok: true, template: rec.response.json_body }, `${rec.file}: the saved row, whole`); is(answer.template.name, expected.name)
      const before = rec.list_row_before_rename
      if (before) { is(before.id, answer.template.id); ok(before.name !== answer.template.name, `${rec.file}: the recorded list row before the rename had another name`); eq(Object.keys(answer.template).filter(key => !(key in before)), [], `${rec.file}: the saved row has no key the list row lacks`) }
    } else {
      eq(answer, { ok: false, reason: expected.reason, ...(expected.detail ? { detail: expected.detail } : {}) }, `${rec.file}: read as "${expected.reason}"`)
      const refusal = lib.templateRenameRefusal(answer, 'April report')
      eq(refusal, { refused: true, ...(expected.reason === 'invalid' ? { message: expected.detail, field: true } : REFUSAL_WORDS[expected.reason]) }, `${rec.file}: the words the person reads`)
    }
  }
  // the carrier's reply keeps its stage summary (a rename changes the name only)
  const carrier = RECORDED.find(rec => rec.file.startsWith('02')); eq(Object.keys(carrier.response.json_body.stage_template_summary).sort(), ['schema_version', 'sha256', 'slide_count'], 'the carrier\'s reply still carries its stage_template_summary')
  // 405 is Director's flag-off answer: Allow: GET, and no 404 anywhere in what Director recorded for it
  const flagOff = RECORDED.find(rec => rec.file.startsWith('11')); eq([flagOff.response.status, flagOff.response.headers.allow], [405, 'GET'])
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

// ---- the row's Rename for a template (the row is shared with the Themes page; this is what a template adds) ---------------------------------------------------------------
const rowToasts = []
function mountTemplateRow(props = {}) {
  const focusLog = []
  const listStub = { querySelector() { return { focus: () => focusLog.push('list') } } }
  let RowComponent
  const runtime = createRuntime(() => RowComponent({ kind: 'template', name: 'April report', otherNames: ['Board deck', 'Quarterly review'], onDelete: async () => ({ ok: true, name: 'April report' }), children: { type: 'button', props: { className: 'sl-record' }, key: 'child' }, ...props }), {
    elementFor: (node) => ({ tag: node.type, focus: () => focusLog.push(`${node.type}:${node.props['aria-label'] ?? node.props.className ?? ''}`), select: () => focusLog.push(`select:${node.type}`), closest: () => listStub }),
  })
  const alertNames = ['AlertDialog', 'AlertDialogAction', 'AlertDialogCancel', 'AlertDialogContent', 'AlertDialogDescription', 'AlertDialogFooter', 'AlertDialogHeader', 'AlertDialogTitle']
  const menuNames = ['DropdownMenu', 'DropdownMenuContent', 'DropdownMenuItem', 'DropdownMenuTrigger']
  RowComponent = loadSource(read(ROW), {
    react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': { Loader2: 'Loader2', MoreVertical: 'MoreVertical' },
    '@/components/ui/alert-dialog': Object.fromEntries(alertNames.map(n => [n, n])), '@/components/ui/dropdown-menu': Object.fromEntries(menuNames.map(n => [n, n])),
    '@/hooks/use-toast': { toast: options => rowToasts.push(options) }, '@/lib/studio-library-manage': lib, './library-manage.css': {},
  }, { file: ROW, globals: { requestAnimationFrame: fn => fn() } }).ManagedLibraryRow
  runtime.render()
  const api = {
    rt: runtime, focusLog,
    item: marker => runtime.find(n => n.type === 'DropdownMenuItem' && n.props[marker])[0],
    form: () => runtime.find(n => n.type === 'form')[0], input: () => runtime.find(n => n.type === 'input')[0],
    problem: () => runtime.find(n => n.props?.['data-studio-library-rename-problem']).map(text).join('|'),
    startRename() { api.item('data-studio-library-rename').props.onSelect(); runtime.render() },
    type(value) { api.input().props.onChange({ target: { value } }); runtime.render() },
    submit() { api.form().props.onSubmit({ preventDefault() {} }); runtime.render() },
  }
  return api
}
{
  const calls = []; const gate = deferred()
  const row = mountTemplateRow({ onRename: name => { calls.push(name); return gate.promise } })
  eq(row.rt.find(n => n.type === 'DropdownMenuItem').map(text), ['Rename', 'Delete…'], 'a template with a rename route: Rename, then Delete…')
  is(row.item('data-studio-library-rename').props.disabled, false, 'Rename is enabled'); is(row.item('data-studio-library-rename').props['aria-describedby'], undefined)
  is(row.rt.find(n => n.props?.['data-studio-library-rename-note']).length, 0, 'and has no note')
  row.startRename(); ok(row.form(), 'Rename opens the field in place'); is(text(row.rt.one(n => n.type === 'label')).startsWith('Rename template'), true, 'labelled "Rename template"'); is(row.input().props.value, 'April report'); is(row.input().props.maxLength, 150)
  row.type('  '); row.submit(); is(row.problem(), 'Enter a name.'); row.type('board DECK'); row.submit(); is(row.problem(), 'A saved template has this name. Choose a different name.', 'a name another template has, ignoring case, is refused in the field')
  row.type('x'.repeat(151)); row.submit(); is(row.problem(), 'Use 150 characters or fewer.'); eq(calls, [], 'nothing is sent for any of them')
  row.type('Q3 report'); row.submit(); eq(calls, ['Q3 report'], 'a good name goes to onRename'); is(row.form(), undefined, 'the field closes at once'); eq(rowToasts, [])
  gate.resolve({ ok: true, name: 'Q3 report' }); await tick(); eq(rowToasts, [], 'a saved rename says nothing here (the page says it)')
  // a refusal Director gave about the name: the field comes back with what was typed, and the reason under it; no toast
  const taken = mountTemplateRow({ onRename: async () => ({ ok: false, message: 'A template with that name already exists. Choose a different name.', field: true }) })
  taken.startRename(); taken.type('Hidden import'); taken.submit(); is(taken.form(), undefined, 'closed at once'); await tick(); taken.rt.render()
  ok(taken.form(), 'a refused name reopens the field'); is(taken.input().props.value, 'Hidden import', 'with what was typed'); is(taken.problem(), 'A template with that name already exists. Choose a different name.', 'and the reason under it')
  is(taken.input().props['aria-invalid'], true); ok(taken.focusLog.filter(entry => entry === 'select:input').length >= 2, 'the field takes focus again'); eq(rowToasts, [], 'no toast for it')
  taken.type('Hidden import 2'); is(taken.problem(), '', 'typing clears the reason')
  // any other refusal is a toast, and the field stays closed
  const gone = mountTemplateRow({ onRename: async () => ({ ok: false, message: '“April report” is no longer available, so it was not renamed.' }) }); gone.startRename(); gone.type('Other'); gone.submit(); await tick(); gone.rt.render()
  is(gone.form(), undefined); eq(rowToasts, [{ variant: 'destructive', title: 'Rename not saved', description: '“April report” is no longer available, so it was not renamed.' }], 'a refusal that is not about the name is a toast'); rowToasts.length = 0
  // a field refusal whose answer is stale (the account changed) says nothing and reopens nothing
  const stale = mountTemplateRow({ onRename: async () => ({ ok: false, message: '', stale: true, field: true }) }); stale.startRename(); stale.type('Other'); stale.submit(); await tick(); stale.rt.render(); is(stale.form(), undefined); eq(rowToasts, [])
  // Rename is off (Director has the route switched off): disabled, with the reason, and a stray select does nothing
  const off = mountTemplateRow({ onRename: async () => ({ ok: true, name: 'x' }), renameBlockedReason: lib.TEMPLATE_RENAME_UNAVAILABLE_REASON })
  const offItem = off.item('data-studio-library-rename'); is(text(offItem), 'Rename'); is(offItem.props.disabled, true, 'Rename is disabled')
  const note = off.rt.one(n => n.props?.['data-studio-library-rename-note']); is(text(note), "Renaming templates isn't available yet.", 'with the reason under it'); is(offItem.props['aria-describedby'], note.props.id, 'which the item points at')
  offItem.props.onSelect(); off.rt.render(); is(off.form(), undefined, 'a stray select does not open the field')
  is(off.item('data-studio-library-delete').props.disabled, false, 'Delete is not affected'); is(off.rt.find(n => n.props?.['data-studio-library-delete-note']).length, 0)
  // both notes at once (a Composer template while Rename is off): one reason under each item
  const both = mountTemplateRow({ onRename: async () => ({ ok: true, name: 'x' }), renameBlockedReason: 'R', deleteBlockedReason: 'D' })
  eq(both.rt.find(n => n.props?.['data-studio-library-rename-note'] || n.props?.['data-studio-library-delete-note']).map(text), ['R', 'D'], 'the Rename reason sits under Rename, the Delete reason under Delete')
  // no onRename: no Rename and no note, even with a reason (nothing to explain)
  const none = mountTemplateRow({ renameBlockedReason: 'R' }); eq(none.rt.find(n => n.type === 'DropdownMenuItem').map(text), ['Delete…']); is(none.rt.find(n => n.props?.['data-studio-library-rename-note']).length, 0)
}

// ================================================================== 4 + 5. the workspace ===================================================================================
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
    reoptimizeTemplate: async id => ({ id, blueprint_enrichment_status: 'queued' }), watchTemplateStatus: () => () => {}, deleteTemplate: async () => true,
    renameTemplate: async (id, name) => ({ ok: true, template: { ...plain(templates.find(t => t.id === id)), name } }), ...apiOverrides,
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
    if (!MUTATING) for (const rel of [TEMPLATES_WORKSPACE, ENV_FILE, USE_TEMPLATES, PROXY]) ok(isBaseFile(rel, stripLibraryManage(rel, read(rel)), baseSource(rel)), `${rel}: without this change's lines (delete and rename) it is the base commit's file${rel === ENV_FILE ? ' (its lines in order; a later change\'s block may follow)' : ', byte for byte'}`)
    if (!MUTATING) for (const [rel, table] of Object.entries(LIBRARY_MANAGE_ADDITIONS)) for (const [added] of table) is(read(rel).split(added).length - 1, 1, `${rel}: each added literal occurs exactly once`)
    const changed = spawnSync('git', ['diff', '--name-only', BASE_COMMIT, '--', 'app', 'components', 'lib', 'hooks', 'middleware.ts'], { cwd: root, encoding: 'utf8' }).stdout.split('\n').filter(Boolean)
    const allowed = new Set([THEMES_WORKSPACE, TEMPLATES_WORKSPACE, THEME_HOOK, USE_TEMPLATES, PROXY, ...LIBRARY_MANAGE_NEW_FILES, ...STACKED_PASS3_FILES, ...STACKED_P2_FILES])
    ok(changed.every(file => allowed.has(file)), `this change touches only the two workspaces, the theme hook, the template hook and proxy (the rename) and its own three new files (the other Pass 3 changes' files and the Pass 2 pages' files may be stacked on it): ${changed.filter(file => !allowed.has(file)).join(', ') || 'ok'}`)
    ok(!changed.some(file => (/^app\/api\/(templates|themes)\//.test(file) && file !== PROXY) || /admission/i.test(file)), 'no API proxy but the template one (the rename) and nothing of the admission report is touched')
  }

  // ---- flag on: who gets a menu --------------------------------------------------------------------------------------------------------------------------------------------
  const h = mountWorkspace({ flag: 'true', templates: [QBR, BOARD, IMPORTED, BUILT_IN] })
  await h.settle(); is(h.rows().length, 0, 'create mode has no list and no menu'); await h.mode('library')
  eq(h.rows().map(n => n.key), ['tp-a', 'tp-b', 'tp-c'], 'the person\'s own templates (the Composer one too) get a menu; the built-in one does not')
  is(h.records().length, 4, 'all four are still listed'); ok(h.records().some(n => n.key === 'tp-x'), 'the built-in template is listed, plain')
  for (const row of h.rows()) { is(row.props.kind, 'template'); is(typeof row.props.onRename, 'function', 'every row can be renamed, the Composer one too'); is(row.props.renameBlockedReason, undefined, 'and none is blocked'); is(typeof row.props.onDelete, 'function'); is(row.props.disabled, false) }
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

  // ============================================================== rename ==============================================================
  const NAMES = ['Quarterly review', 'Board update', 'Imported deck']
  const previewOf = h => h.rt.find(n => n.props?.snapshot).map(n => [n.props.snapshot.name, n.props.snapshot.updated_at]) // what the open preview (the inspector) is handed
  eq(h.rows().map(n => n.props.otherNames), [['Board update', 'Imported deck', 'Deckster starter'], ['Quarterly review', 'Imported deck', 'Deckster starter'], ['Quarterly review', 'Board update', 'Deckster starter']], 'each row is checked against every OTHER template\'s name (the built-in one included), never its own')
  // the happy path: the name shows at once, Director's reply decides the spelling and the date, the preview and the notice follow
  {
    const gate = deferred(); const asked = []
    const r = mountWorkspace({ flag: 'true', api: { renameTemplate: async (id, name) => { asked.push([id, name]); await gate.promise; return { ok: true, template: { ...BOARD, name: `${name} (saved)`, updated_at: '2026-10-22T10:00:00Z' } } } } })
    await r.settle(); await r.mode('library'); r.select('tp-b'); await r.settle(); eq(previewOf(r), [['Board update', '2026-10-02T00:00:00Z']], 'the open preview is handed the template\'s name and updated date'); r.calls.length = 0
    const pending = r.row('tp-b').props.onRename('  Roadmap  '); r.rt.render()
    eq(r.names(), ['Quarterly review', 'Roadmap', 'Imported deck'], 'the new name shows at once, trimmed, before Director answers'); eq(r.selected(), ['tp-b']); ok(r.heading().includes('Roadmap'), 'the preview heading follows')
    eq(asked, [['tp-b', 'Roadmap']], 'one PATCH: the id and the trimmed name')
    gate.resolve(); eq(await pending, { ok: true, name: 'Roadmap (saved)' }, 'Director\'s spelling is the answer'); await r.settle()
    eq(r.names(), ['Quarterly review', 'Roadmap (saved)', 'Imported deck'], 'and the row takes it'); ok(r.heading().includes('Roadmap (saved)'))
    ok(r.notices().includes('“Board update” is now “Roadmap (saved)”.'), r.notices().join('|')); eq(r.selected(), ['tp-b'], 'the selection stays')
    eq(previewOf(r), [['Roadmap (saved)', '2026-10-22T10:00:00Z']], 'and, after the rename, the new name and the date Director gave'); eq(r.calls.filter(c => c[0] === 'renameTemplate'), [['renameTemplate', 'tp-b', 'Roadmap']], 'asked once')
    // the preview\'s own name is the new one too: a retry notice (it names the snapshot) uses it
    const retry = r.rt.find(n => n.type === 'button' && text(n).includes('Retry optimization'))[0]; ok(retry); retry.props.onClick(); await r.settle()
    ok(r.notices().some(notice => notice.startsWith('“Roadmap (saved)” optimization requested')), `the open preview carries the new name: ${r.notices().join('|')}`)
    eq(r.rows().map(n => n.props.renameBlockedReason), [undefined, undefined, undefined], 'Rename stays on')
  }
  // a Composer template renames (name only); its Delete stays blocked
  {
    const r = mountWorkspace({ flag: 'true' }); await r.settle(); await r.mode('library'); r.select('tp-c'); await r.settle(); r.calls.length = 0
    const result = await r.row('tp-c').props.onRename('Quarterly original'); await r.settle()
    eq(result, { ok: true, name: 'Quarterly original' }); eq(r.calls.filter(c => c[0] === 'renameTemplate'), [['renameTemplate', 'tp-c', 'Quarterly original']], 'a PATCH for a carrier template')
    eq(r.names(), ['Quarterly review', 'Board update', 'Quarterly original']); eq(r.selected(), ['tp-c']); ok(r.records().find(n => n.key === 'tp-c'), 'still listed')
    eq(r.rows().find(n => n.key === 'tp-c').props.deleteBlockedReason, "Composer templates can't be deleted here yet.", 'its Delete is still blocked'); ok(r.notices().includes('“Imported deck” is now “Quarterly original”.'))
  }
  // the field's rules run before anything is sent; the same name sends nothing
  {
    const r = mountWorkspace({ flag: 'true', templates: [QBR, BOARD, IMPORTED, BUILT_IN] }); await r.settle(); await r.mode('library'); r.calls.length = 0
    for (const [typed, message] of [['', 'Enter a name.'], ['   ', 'Enter a name.'], ['x'.repeat(151), 'Use 150 characters or fewer.'], ['quarterly REVIEW', 'A saved template has this name. Choose a different name.'], ['Deckster starter', 'A saved template has this name. Choose a different name.']]) {
      eq(await r.row('tp-b').props.onRename(typed), { ok: false, message }, `${JSON.stringify(typed.slice(0, 20))}: refused before any request`)
    }
    eq(await r.row('tp-b').props.onRename(' Board update '), { ok: true, name: 'Board update' }, 'the same name (after trimming) is a success that sends nothing')
    eq(r.calls.filter(c => c[0] === 'renameTemplate'), [], 'no PATCH for any of them'); eq(r.names(), [...NAMES, 'Deckster starter'])
    eq(await r.row('tp-b').props.onRename('BOARD UPDATE'), { ok: true, name: 'BOARD UPDATE' }, 'a change of case alone is a rename'); eq(r.calls.filter(c => c[0] === 'renameTemplate'), [['renameTemplate', 'tp-b', 'BOARD UPDATE']])
  }
  // every refusal puts the old name back and says why; nothing is announced
  for (const [answer, expected, rowsAfter] of [
    [{ ok: false, reason: 'gone' }, { ok: false, message: '“Board update” is no longer available, so it was not renamed. Refresh the library to see your current templates.' }, undefined],
    [{ ok: false, reason: 'taken' }, { ok: false, message: 'A template with that name already exists. Choose a different name.', field: true }, undefined],
    [{ ok: false, reason: 'invalid', detail: 'A template name is required.' }, { ok: false, message: 'A template name is required.', field: true }, undefined],
    [{ ok: false, reason: 'invalid' }, { ok: false, message: 'Use 1 to 150 characters.', field: true }, undefined],
    [{ ok: false, reason: 'sign_in' }, { ok: false, message: "We couldn't confirm your sign-in for this change, so “Board update” was not renamed. Reload the page and try again." }, undefined],
    [{ ok: false, reason: 'failed' }, { ok: false, message: '“Board update” was not renamed and keeps its old name. Try again, or refresh the library to check.' }, undefined],
    [{ ok: false, reason: 'unavailable' }, { ok: false, message: "Renaming templates isn't available yet. “Board update” keeps its name." }, "Renaming templates isn't available yet."],
    ['throws', { ok: false, message: '“Board update” was not renamed and keeps its old name. Try again, or refresh the library to check.' }, undefined],
  ]) {
    const label = answer === 'throws' ? 'a thrown error' : `reason ${answer.reason}`
    const r = mountWorkspace({ flag: 'true', api: { renameTemplate: async () => { if (answer === 'throws') throw new Error('boom'); return answer } } }); await r.settle(); await r.mode('library'); r.select('tp-b'); await r.settle()
    const result = await r.row('tp-b').props.onRename('Roadmap'); await r.settle()
    eq(result, expected, `${label}: the words`); eq(r.names(), NAMES, `${label}: the old name is back`); eq(r.selected(), ['tp-b']); ok(r.heading().includes('Board update'))
    ok(!r.notices().some(notice => /is now/.test(notice)), `${label}: nothing is announced`)
    eq(r.rows().map(n => n.props.renameBlockedReason), [rowsAfter, rowsAfter, rowsAfter], rowsAfter ? `${label}: Rename is turned off on every row, with the reason` : `${label}: Rename stays on`)
  }
  // a refused rename that Director answered with a taken name, then a good one: the second goes through
  {
    let first = true
    const r = mountWorkspace({ flag: 'true', api: { renameTemplate: async (id, name) => { if (first) { first = false; return { ok: false, reason: 'taken' } } return { ok: true, template: { ...BOARD, name } } } } }); await r.settle(); await r.mode('library')
    eq((await r.row('tp-b').props.onRename('Hidden deck')).field, true); eq(r.names(), NAMES); eq(await r.row('tp-b').props.onRename('Roadmap'), { ok: true, name: 'Roadmap' }); await r.settle(); eq(r.names(), ['Quarterly review', 'Roadmap', 'Imported deck'])
  }
  // a library read already in flight cannot put the old name back
  {
    const readGate = deferred(); let reads = 0
    const r = mountWorkspace({ flag: 'true', api: { listTemplates: async () => { reads++; if (reads > 1) await readGate.promise; return { templates: plain([QBR, BOARD, IMPORTED]), count: 3 } } } })
    await r.settle(); await r.mode('library'); r.refreshButton().props.onClick(); r.rt.render()
    await r.row('tp-b').props.onRename('Roadmap'); readGate.resolve(); await r.settle(); eq(r.names(), ['Quarterly review', 'Roadmap', 'Imported deck'], 'the late library answer is dropped')
  }
  // an optimization request is out: no rename, and the menu is off
  {
    const optGate = deferred(); const r = mountWorkspace({ flag: 'true', templates: [QBR, BOARD, IMPORTED], api: { reoptimizeTemplate: async id => { await optGate.promise; return { id, blueprint_enrichment_status: 'queued' } } } })
    await r.settle(); await r.mode('library'); r.select('tp-b'); await r.settle(); r.rt.find(n => n.type === 'button' && text(n).includes('Retry optimization'))[0].props.onClick(); r.rt.render(); r.calls.length = 0
    eq(await r.row('tp-b').props.onRename('Roadmap'), { ok: false, message: 'Another library action is still running. Try again in a moment.' }); eq(r.calls.filter(c => c[0] === 'renameTemplate'), [], 'no PATCH then'); eq(r.names(), NAMES)
    optGate.resolve(); await r.settle()
  }
  // the account is being verified / changes while the answer is out / the page goes away
  {
    const acct = mountWorkspace({ flag: 'true', account: STANDALONE_ACCOUNT }); await acct.settle(); await acct.mode('library'); acct.calls.length = 0
    accountState.current = false; const paused = await acct.row('tp-a').props.onRename('Roadmap'); accountState.current = true
    is(paused.ok, false); eq(acct.calls.filter(c => c[0] === 'renameTemplate'), [], 'not while the account is being verified')
    const swap = deferred(); const swapped = mountWorkspace({ flag: 'true', account: STANDALONE_ACCOUNT, api: { renameTemplate: async () => { await swap.promise; return { ok: false, reason: 'unavailable' } } } }); await swapped.settle(); await swapped.mode('library')
    const swapPending = swapped.row('tp-a').props.onRename('Roadmap'); accountState.current = false; swap.resolve(); const swapResult = await swapPending; accountState.current = true
    is(swapResult.stale, true, 'a changed account makes the answer stale'); eq(swapped.rows().map(n => n.props.renameBlockedReason), [undefined, undefined, undefined], 'and it does not turn Rename off for the new account')
    const away = deferred(); const gone = mountWorkspace({ flag: 'true', account: STANDALONE_ACCOUNT, api: { renameTemplate: async () => { await away.promise; return { ok: true, template: { ...QBR, name: 'Roadmap' } } } } }); await gone.settle(); await gone.mode('library')
    const awayPending = gone.row('tp-a').props.onRename('Roadmap'); gone.rt.unmount(); away.resolve(); is((await awayPending).stale, true, 'an unmounted page: nothing written')
    ok(!gone.notices().some(notice => /is now/.test(notice)), 'and nothing announced')
  }
  // flag off (or any other spelling): no row has a menu, so there is no way to call rename at all
  for (const flag of [undefined, 'false', 'TRUE', '1']) { const r = mountWorkspace({ flag }); await r.settle(); await r.mode('library'); is(r.rows().length, 0, `flag ${JSON.stringify(flag)}: no menu`); eq(r.calls.filter(c => c[0] === 'renameTemplate'), []) }

  // ---- every recorded answer, through the whole chain: row -> workspace -> hook -> proxy -> Director's recorded answer ---------------------------------------------------------------
  for (const rec of RECORDED) {
    const expected = EXPECT[rec.file]; const before = rec.list_row_before_rename ?? { id: rec.request.path.split('/').pop(), name: 'April report' }
    const chain = recordedChain(rec); const typed = 'Replay name'
    const row = T(before.id, before.name, { ...(before.stage_template_summary ? { stage_template_summary: before.stage_template_summary } : {}) })
    const r = mountWorkspace({ flag: 'true', templates: [row, T('tp-other', 'Another template')], api: { renameTemplate: (id, name) => chain.hook.renameTemplate(id, name) } }); await r.settle(); await r.mode('library')
    const result = await r.row(before.id).props.onRename(typed); await r.settle()
    eq(chain.director.map(([url, init]) => [url, init.body]), [[`https://director.example.invalid${rec.request.path}`, JSON.stringify({ name: typed })]], `${rec.file}: Director is sent the recorded path and { name }`)
    if (expected.ok) {
      eq(result, { ok: true, name: expected.name }, `${rec.file}: the row takes Director's spelling`); eq(r.names(), [expected.name, 'Another template'], `${rec.file}: listed under the saved name`)
      ok(r.notices().includes(`“${before.name}” is now “${expected.name}”.`), `${rec.file}: ${r.notices().join('|')}`)
      eq(r.rows().map(n => n.props.renameBlockedReason), [undefined, undefined], `${rec.file}: Rename stays on`)
    } else {
      const words = expected.reason === 'invalid' ? { message: expected.detail, field: true } : { ...REFUSAL_WORDS[expected.reason], message: REFUSAL_WORDS[expected.reason].message.replace('April report', before.name) }
      eq(result, { ok: false, ...words }, `${rec.file}: the words`); eq(r.names(), [before.name, 'Another template'], `${rec.file}: the old name is back`)
      ok(!r.notices().some(notice => /is now/.test(notice)), `${rec.file}: nothing announced`)
      const blocked = expected.reason === 'unavailable' ? "Renaming templates isn't available yet." : undefined
      eq(r.rows().map(n => n.props.renameBlockedReason), [blocked, blocked], `${rec.file}: ${blocked ? 'Rename is turned off on every row' : 'Rename stays on'}`)
    }
  }
}

console.log(`studio-template-library-manage: ${checks} checks passed`)
