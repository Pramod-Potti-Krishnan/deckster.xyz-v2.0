// Director chat recorded-transcript harness (PASS2-DIRECTOR-CHAT, PR A).
//
// Replays five sanitised Director transcripts through the REAL WebSocket hook, MessageList,
// QuestionCard, header/notice and page handlers (see scripts/studio-chat-harness/README.md)
// and compares what is observable against baselines recorded from the base commit:
// outbound socket bytes, ordered React keys, handler arguments, hook state, rendered markup.
//
//   node scripts/test-studio-chat-transcripts.mjs                run, compare to baselines
//   node scripts/test-studio-chat-transcripts.mjs --update       re-record baselines
//   node scripts/test-studio-chat-transcripts.mjs --update-sources   re-record ONLY _sources.json (the page-region anchors); the transcripts still must pass
//   node scripts/test-studio-chat-transcripts.mjs --structural   ignore markup (flag-on runs)
//   node scripts/test-studio-chat-transcripts.mjs --env NEXT_PUBLIC_STUDIO_CHAT_LABELS=true --structural
//
// Offline by construction: no real socket, fetch, timer or clock is used.
process.env.NODE_ENV = 'production' // before React loads: smaller, quieter renderer; same markup
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { installHostNetworkGuard } from './studio-chat-harness/fake-env.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixturesDir = path.join(root, 'scripts/fixtures/director-chat')

const args = process.argv.slice(2)
const flag = name => args.includes(name)
const option = name => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] }
const repeated = name => args.flatMap((arg, i) => arg === name ? [args[i + 1]] : [])

if (flag('--help') || flag('-h')) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter(line => line.startsWith('//')).map(line => line.slice(3)).join('\n'))
  process.exit(0)
}

const dependencyVersions = rootDir => Object.fromEntries(['react', 'react-dom', 'react-markdown', 'class-variance-authority', 'clsx', 'tailwind-merge', '@radix-ui/react-slot', 'typescript']
  .map(name => [name, JSON.parse(fs.readFileSync(path.join(rootDir, 'node_modules', name, 'package.json'), 'utf8')).version]))

const release = installHostNetworkGuard(net, dns)
const { runTranscript } = await import('./studio-chat-harness/transcript.mjs')
const { PROFILES } = await import('./studio-chat-harness/profiles.mjs')
const { selfTest } = await import('./studio-chat-harness/selftest.mjs')
const { compareSnapshots, explainOutbound, isMarkupFile, pretty, readSnapshot, renderDiff, writeSnapshot } = await import('./studio-chat-harness/snapshot.mjs')

// Full markup files are recorded for the shipping Studio profile; the other profiles keep hashes.
const MARKUP_PROFILES = new Set(['studio'])
const baselineRoot = path.resolve(option('--baseline-dir') || path.join(fixturesDir, 'baselines'))
const update = flag('--update')
const updateSources = flag('--update-sources')
const structural = flag('--structural')
const full = flag('--full')
const outDir = option('--out')
const extraEnv = Object.fromEntries(repeated('--env').map(pair => { const i = pair.indexOf('='); if (i < 1) throw new Error(`--env expects NAME=VALUE, got "${pair}"`); return [pair.slice(0, i), pair.slice(i + 1)] }))
const onlyFixtures = option('--only')?.split(',')
const onlyProfiles = option('--profile')?.split(',')
if ((update || updateSources) && (structural || Object.keys(extraEnv).length)) {
  console.error('Refusing --update / --update-sources with --structural or --env: baselines are recorded flag-off, with the default profile environment.')
  process.exit(2)
}
if (update && updateSources) { console.error('Use --update or --update-sources, not both.'); process.exit(2) }
for (const profile of onlyProfiles || []) if (!PROFILES[profile]) { console.error(`Unknown profile "${profile}". Known: ${Object.keys(PROFILES).join(', ')}`); process.exit(2) }

const fixtures = fs.readdirSync(fixturesDir).filter(name => name.endsWith('.json')).sort()
  .map(name => JSON.parse(fs.readFileSync(path.join(fixturesDir, name), 'utf8')))
  .filter(fixture => !onlyFixtures || onlyFixtures.includes(fixture.name))
if (onlyFixtures) for (const name of onlyFixtures) if (!fixtures.some(f => f.name === name)) { console.error(`Unknown fixture "${name}"`); process.exit(2) }
if (flag('--list')) {
  for (const fixture of fixtures) console.log(`${fixture.name.padEnd(22)} ${fixture.steps.length} steps  ${fixture.description}`)
  process.exit(0)
}

let failures = 0, passes = 0, written = 0
const failureReports = []

// ---- harness self-test (is the offline React host faithful?) --------------------------------
const selfProblems = await selfTest({ root })
if (selfProblems.length) {
  console.error('FAIL harness self-test\n' + selfProblems.map(line => `  ${line}`).join('\n'))
  process.exit(1)
}

// ---- page-source anchors (regions of page.tsx / use-builder-session.ts the harness executes) -----
let anchorsSnapshot = null

for (const fixture of fixtures) {
  for (const profile of Object.keys(PROFILES)) {
    if (onlyProfiles && !onlyProfiles.includes(profile)) continue
    const label = `${fixture.name}/${profile}`
    let result
    try {
      result = await runTranscript({ root, fixture, profile, processEnv: { ...PROFILES[profile], ...(fixture.env || {}), ...extraEnv }, includeMarkup: MARKUP_PROFILES.has(profile), crossCheck: flag('--crosscheck') })
    } catch (error) {
      failures++
      failureReports.push(`FAIL ${label}: the transcript could not be replayed\n  ${String(flag('--verbose') ? error.stack : error.message).split('\n').join('\n  ')}`)
      continue
    }
    if (flag('--crosscheck')) console.log(`crosscheck ${label}: ${result.crossCheck.map(c => c.equal ? '=' : 'X').join('')}  (X = effect/interaction state that a plain server render cannot show; see README)`)
    anchorsSnapshot ??= { '_sources.json': pretty({ versions: dependencyVersions(root), regions: result.regions, sendSites: result.sendSites }) }
    if (result.blockedNetwork.length) {
      failures++
      failureReports.push(`FAIL ${label}: code under test attempted network access: ${result.blockedNetwork.join(', ')}`)
      continue
    }
    const dir = path.join(baselineRoot, fixture.name, profile)
    if (outDir) writeSnapshot(path.join(outDir, fixture.name, profile), result.files)
    if (update) {
      const before = readSnapshot(dir)
      writeSnapshot(dir, result.files)
      const changed = compareSnapshots(before, result.files).length
      written++
      console.log(`UPDATED ${label} (${Object.keys(result.files).length} files, ${changed} changed)`)
      continue
    }
    const expected = readSnapshot(dir)
    if (!Object.keys(expected).length) {
      failures++
      failureReports.push(`FAIL ${label}: no baseline at ${path.relative(root, dir)}. Record one with --update.`)
      continue
    }
    const diffs = compareSnapshots(expected, result.files, { skip: structural ? name => isMarkupFile(name) || name === 'env.json' : () => false })
    if (diffs.length === 0) {
      passes++
      const sends = result.files['outbound.ndjson'].split('\n').filter(line => line.includes('"kind":"json:')).length
      console.log(`PASS ${label}  (${JSON.parse(result.files['keys.json']).length} checkpoints, ${sends} sends${structural ? ', structural' : ''})`)
    } else {
      failures++
      const parts = diffs.map(d => d.kind === 'changed' ? (d.file === 'outbound.ndjson' && !full ? explainOutbound(expected[d.file], result.files[d.file]) : renderDiff(d.file, expected[d.file], result.files[d.file], full ? Infinity : 40)) : `  ${d.file}: ${d.kind === 'missing' ? 'no longer produced' : 'new file, not in the baseline'}`)
      failureReports.push(`FAIL ${label}: ${diffs.length} file(s) differ from the baseline\n${parts.join('\n')}`)
    }
  }
}

if (anchorsSnapshot && !onlyFixtures && !onlyProfiles) {
  const dir = path.join(baselineRoot)
  const file = path.join(dir, '_sources.json')
  if (update || updateSources) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, anchorsSnapshot['_sources.json']); console.log('UPDATED _sources.json') }
  else {
    const expected = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
    if (expected === anchorsSnapshot['_sources.json']) { passes++; console.log('PASS _sources (dependency versions and the page.tsx / use-builder-session.ts regions the harness executes are unchanged)') }
    else { failures++; failureReports.push(`FAIL _sources: a dependency version or a page region the harness executes changed, or the baseline is missing\n${renderDiff('_sources.json', expected, anchorsSnapshot['_sources.json'], full ? Infinity : 40)}`) }
  }
}

release()
if (update) {
  console.log(`\nRecorded ${written} transcript baseline(s) under ${path.relative(root, baselineRoot)}.`)
  process.exit(failures ? 1 : 0)
}
if (failureReports.length) {
  console.error('\n' + failureReports.join('\n\n'))
  console.error(`\nDirector chat transcripts: ${passes} passed, ${failures} FAILED. If the change is intended, review the diff, then re-record with --update.`)
  process.exit(1)
}
console.log(`\nDirector chat transcripts: ${passes} checks passed (${fixtures.length} transcripts x ${onlyProfiles?.length ?? Object.keys(PROFILES).length} profiles${structural ? ', markup ignored' : ''}). Offline: no socket, fetch or real timer was used.`)
