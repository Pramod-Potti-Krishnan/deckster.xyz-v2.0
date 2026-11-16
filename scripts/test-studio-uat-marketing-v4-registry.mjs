// FRONTEND-1, uat marketing-v4 registry (test only; OPS-2's condition on the S39 gate of Studio PR #637, 16 Nov). See scripts/studio-uat-marketing-v4-strip.mjs for why.
// Checks:
//   A. list: UAT_MARKETING_V4_FILES is exactly `git diff --name-only <merge-base> <uat>` (41 paths, all under the marketing-v4 roots), when the two commits are in this clone; it is sorted and has no duplicate
//   B. registry: one marked LATER-CHANGE line in scripts/studio-later-changes.mjs names this module, it sits after its predecessor's line (M10 Replace picture), and LATER_CHANGE_FILES holds every scope file
//   C. nothing else: the registry gets no .env.example block and no strip from this change (LATER_ENV_BLOCKS / LATER_STRIPS do not name this module)
//   D. scope, read from the COMMITTED diff of this change's own commits only (by subject, first-parent line, so it holds after a merge): every file is one of its three own files; the registry diff adds
//      exactly one line and removes none; no credential-shaped literal in what it adds
// Plain node, no dependency; git is read, nothing is written. Run: node scripts/test-studio-uat-marketing-v4-registry.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as mod from './studio-uat-marketing-v4-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const has = sha => { try { git('cat-file', '-e', `${sha}^{commit}`); return true } catch { return false } }
const REGISTRY = 'scripts/studio-later-changes.mjs'
const ROOTS = [/^app\/\(marketing-v3\)\//, /^components\/marketing\/v4\//, /^public\/marketing\/v4\//, /^lib\/marketing-v4\.ts$/, /^styles\/marketing-v4\.css$/]
let failed = 0
const check = async (name, fn) => { try { await fn(); console.log(`  ok   ${name}`) } catch (error) { failed++; console.log(`  FAIL ${name}\n       ${String(error.message).split('\n').slice(0, 6).join('\n       ')}`) } }

await check('A. list: the 41 uat paths, sorted, unique, all marketing-v4, equal to merge-base..uat when both commits are here', () => {
  const files = mod.UAT_MARKETING_V4_FILES
  assert.equal(files.length, 41, 'forty-one paths'); assert.equal(new Set(files).size, files.length, 'no duplicate'); assert.deepEqual([...files].sort(), files, 'sorted')
  for (const rel of files) assert.ok(ROOTS.some(re => re.test(rel)), `under a marketing-v4 root: ${rel}`)
  if (has(mod.UAT_COMMIT) && has(mod.UAT_MERGE_BASE)) {
    assert.deepEqual(git('diff', '--name-only', mod.UAT_MERGE_BASE, mod.UAT_COMMIT).split('\n').filter(Boolean), files, 'equal to git diff --name-only merge-base uat')
    assert.equal(git('merge-base', mod.UAT_COMMIT, mod.BASE_COMMIT).trim(), mod.UAT_MERGE_BASE, 'the stated merge-base is the merge-base of uat and the base commit')
  } else console.log('       (uat commits not in this clone: list compared by shape only)')
  for (const rel of mod.UAT_MARKETING_V4_OWN_FILES) assert.ok(mod.UAT_MARKETING_V4_SCOPE_FILES.has(rel), `own file in scope: ${rel}`)
  assert.equal(mod.UAT_MARKETING_V4_SCOPE_FILES.size, 44, 'scope = 41 + 3 own files')
})

await check('B. registry: one marked line, after its predecessor, and LATER_CHANGE_FILES holds every scope file', () => {
  const lines = fs.readFileSync(path.join(root, REGISTRY), 'utf8').split('\n')
  const mine = lines.map((text, at) => ({ text, at })).filter(({ text }) => text.includes("import('./studio-uat-marketing-v4-strip.mjs')"))
  assert.equal(mine.length, 1, 'exactly one line names this module'); assert.match(mine[0].text, /UAT_MARKETING_V4_SCOPE_FILES, \/\/ LATER-CHANGE: FRONTEND-1, /, 'marked LATER-CHANGE, in LATER_CHANGE_FILES')
  const before = lines.findIndex(text => text.includes("import('./studio-replace-picture-strip.mjs')).REPLACE_PICTURE_SCOPE_FILES"))
  assert.ok(before >= 0 && before < mine[0].at, 'after M10 Replace picture (its predecessor)')
  const end = lines.findIndex((text, at) => at > before && text === '])'); assert.ok(mine[0].at < end, 'inside the LATER_CHANGE_FILES list')
  for (const rel of mod.UAT_MARKETING_V4_SCOPE_FILES) assert.ok(registry.LATER_CHANGE_FILES.has(rel), `registered: ${rel}`)
})

await check('C. nothing else: no .env.example block and no strip from this change', () => {
  const source = fs.readFileSync(path.join(root, REGISTRY), 'utf8')
  assert.equal((source.match(/studio-uat-marketing-v4-strip\.mjs/g) || []).length, 1, 'the module is named once in the registry')
  for (const text of registry.LATER_ENV_BLOCKS) assert.ok(!/marketing-v4/i.test(String(text)), 'no env block of this change')
})

await check('D. scope: this change\'s own commits touch its three files only; the registry gains one line; no credential-shaped literal', () => {
  const own = git('rev-list', '--first-parent', '--no-merges', `${mod.BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)
    .filter(sha => mod.UAT_MARKETING_V4_COMMIT_SUBJECT.test(git('log', '-1', '--format=%s', sha).trim()))
  if (!own.length) { console.log('       (no own commit on this first-parent line: the change is merged or not yet committed; nothing to read)'); return }
  const touched = new Set(own.flatMap(sha => git('show', '--name-only', '--format=', sha).split('\n').filter(Boolean)))
  const stray = [...touched].filter(rel => !mod.UAT_MARKETING_V4_OWN_FILES.includes(rel)); assert.deepEqual(stray, [], `files outside this change: ${stray.join(', ')}`)
  const diff = own.map(sha => git('show', '-U0', '--format=', sha, '--', REGISTRY)).join('\n').split('\n')
  assert.equal(diff.filter(line => /^\+(?!\+\+)/.test(line)).length, 1, 'the registry gains one line'); assert.equal(diff.filter(line => /^-(?!--)/.test(line)).length, 0, 'the registry loses none')
  const added = own.map(sha => git('show', '-U0', '--format=', sha)).join('\n').split('\n').filter(line => /^\+(?!\+\+)/.test(line)).join('\n')
  for (const pattern of [/AKIA[0-9A-Z]{16}/, /sk-[A-Za-z0-9]{20,}/, /xox[bap]-[A-Za-z0-9-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./]) assert.ok(!pattern.test(added), `credential-shaped text: ${pattern}`)
})

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed')
process.exit(failed ? 1 : 0)
