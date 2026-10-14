// MULTITAB J1 P1b: "a second tab on the same session disconnects both tabs, with no explanation" (frontend-2, PK-approved UX, OPS-2 approved
// the WebSocket close-handler change). Flag NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB (exact "true"), default off.
//
// Director keeps ONE live socket per session and closes the older one with code 4000 and the reason "New connection opened". Studio treated
// that like a network drop, reconnected on its 1.5/3/6/12 s ladder and evicted the other tab in turn (about 9 evictions in 45 s) until one
// tab gave up. With the flag on, that close (and only that close) puts the hook in the `superseded` reconnect status: no timer, no ping, no
// set_theme, nothing sent. The tab says so (header "Open in another tab", a notice with "Use here", the composer placeholder), a send shows
// the notice instead of silently reconnecting, and Add Slide / Add Element / Theme / Template are disabled with the same hint. "Use here" is
// the existing explicit connect(): this tab opens one new socket and the other tab is the one that gets paused.
//
// Proof, all offline (the #371 chat harness: the REAL hook, the real page handlers, the real header / notice / composer; fake socket, virtual
// clock; no network, no real timer):
//   1. units: the close classifier (code AND exact reason), the page predicate, the reconnect policy (a superseded tab never resumes on
//      `online`), the flag read, the PK-approved words;
//   2. three transcripts, each in the modes that are meaningful, compared byte for byte with the committed baselines
//      (scripts/fixtures/studio-one-live-tab/baselines/<transcript>/<mode>/):
//        superseded-by-new-tab           off: today's backoff starts; on: zero reconnect attempts, superseded state, nothing sent
//        use-here-takeover               on:  one connect, the ordinary handshake, a late close of the old socket ignored, paused again by the other tab
//        ordinary-drop-still-reconnects  off and on: 1006 on the 1.5 s then 3 s ladder; 4000 with another reason, 1011, 4000 without a reason,
//                                        the reason in other letters, the reason with another code all reconnect. on == off, file for file.
//      and a fourth, on the theme-restore flag's own runner (#387):
//        use-here-adopts-stored-theme    a takeover meets NEXT_PUBLIC_STUDIO_THEME_RESTORE: the gate starts fresh for the new socket, the theme the
//                                        other tab stored is adopted, and no set_theme (no Auto) goes out; restore off, the tab keeps showing Auto.
//   3. the nine existing Director transcripts x three profiles, flag ON, equal the committed baselines (markup included): a tab that is never
//      evicted is untouched;
//   4. optional --base-root <checkout of the base>: the same transcripts run flag OFF against the BASE tree and against this tree are
//      byte-identical (hashes printed), which is the flag-off-equals-uat proof;
//   5. the wiring, read from the sources (flag read once; the close handler's branch; the page's gates; the four toolbar controls).
//
//   node scripts/test-studio-one-live-tab.mjs                       # all of the above (the base comparison only with --base-root)
//   node scripts/test-studio-one-live-tab.mjs --update              # re-record the new transcripts' baselines (never the existing ones)
//   node scripts/test-studio-one-live-tab.mjs --mutation-check      # also: break the code in thirteen ways in a scratch copy, each must be caught
//   node scripts/test-studio-one-live-tab.mjs --base-root ../fe2-one-live-tab-base
process.env.NODE_ENV = 'production'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { installHostNetworkGuard } from './studio-chat-harness/fake-env.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = name => args.includes(name)
const option = name => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] }
const FLAG = 'NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB'
const FIXTURES = path.join(repoRoot, 'scripts/fixtures/studio-one-live-tab')
const DIRECTOR_CHAT = path.join(repoRoot, 'scripts/fixtures/director-chat')
const release = installHostNetworkGuard(net, dns)
const { runTranscript } = await import('./studio-chat-harness/transcript.mjs')
const { PROFILES } = await import('./studio-chat-harness/profiles.mjs')
const { createModuleLoader } = await import('./studio-chat-harness/module-loader.mjs')
const { runThemeRestoreTranscript } = await import('./studio-chat-harness/theme-restore-transcript.mjs')
const { compareSnapshots, readSnapshot, writeSnapshot, renderDiff, pretty } = await import('./studio-chat-harness/snapshot.mjs')

const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const MODES = { 'superseded-by-new-tab': ['off', 'on'], 'use-here-takeover': ['on'], 'ordinary-drop-still-reconnects': ['off', 'on'] }
// Full markup is recorded for the shipping Studio profile; the other profiles keep hashes (as the main harness does).
const MARKUP_PROFILES = new Set(['studio'])
const loadFixture = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'))
const newFixtures = Object.keys(MODES).map(name => loadFixture(FIXTURES, name))
// The one transcript that meets NEXT_PUBLIC_STUDIO_THEME_RESTORE (#387) on a takeover; it runs on that flag's own runner (theme-restore-transcript.mjs),
// in the modes of THAT flag: `on` = restore on, `off` = restore off, with NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB on in both (the fixture's env).
const INTERPLAY = 'use-here-adopts-stored-theme'
const interplayFixture = loadFixture(FIXTURES, INTERPLAY)
const interplaySnapshot = r => ({ 'outbound.ndjson': r.outbound, 'state.json': pretty({ checkpoints: r.state, notes: r.notes, setThemes: r.setThemes }) })
const chatFixtures = fs.readdirSync(DIRECTOR_CHAT).filter(name => name.endsWith('.json')).sort().map(name => JSON.parse(fs.readFileSync(path.join(DIRECTOR_CHAT, name), 'utf8')))

// The words PK approved (13 Oct 2026), spelled out here on purpose: the product constants must equal them.
const APPROVED = {
  notice: 'This session is open in another tab. Changes there are live; this tab is paused.',
  useHere: 'Use here',
  header: 'Open in another tab',
}

async function run(root, fixture, mode, { profile = 'studio', extra = {} } = {}) {
  const processEnv = { ...PROFILES[profile], ...(mode === 'on' ? { [FLAG]: 'true' } : {}), ...extra }
  const result = await runTranscript({ root, fixture, profile, processEnv, includeMarkup: MARKUP_PROFILES.has(profile) })
  if (result.blockedNetwork.length) throw new Error(`${fixture.name}/${mode}: code under test attempted network access: ${result.blockedNetwork.join(', ')}`)
  return result.files
}
const ndjson = text => text.split('\n').filter(Boolean).map(line => JSON.parse(line))
const handshakes = files => ndjson(files['outbound.ndjson']).filter(entry => entry.kind === 'handshake')
const sends = files => ndjson(files['outbound.ndjson']).filter(entry => entry.kind.startsWith('json:'))
const serverCloses = files => ndjson(files['outbound.ndjson']).filter(entry => entry.kind === 'server-close')
const heartbeats = files => ndjson(files['outbound.ndjson']).filter(entry => entry.kind === 'heartbeat')
const checkpoints = files => JSON.parse(files['state.json']).checkpoints
const notes = files => JSON.parse(files['state.json']).notes
const calls = files => JSON.parse(files['calls.json'])
const meta = files => JSON.parse(files['meta.json'])
const chrome = (files, checkpoint) => files[`markup/${checkpoint}.chrome.html`]
const composer = (files, checkpoint) => files[`markup/${checkpoint}.composer.html`]
const named = (files, label) => checkpoints(files).find(c => c.label === label)
const toastTitles = files => calls(files).filter(c => c.name === 'page.toast').map(c => c.args[0]?.title)

async function checks(root, { identity = true, baselines = true } = {}) {
  const failures = []
  const fail = message => failures.push(message)
  const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
  const stats = { units: 0, snapshots: 0, identity: 0 }
  const same = (label, actual, wanted) => { stats.units++; if (JSON.stringify(actual) !== JSON.stringify(wanted)) fail(`${label}: got ${JSON.stringify(actual)}, wanted ${JSON.stringify(wanted)}`) }

  // ---- 1. units ---------------------------------------------------------------------------------------------------------------------
  const unitEnv = value => ({ process: { env: value === undefined ? {} : { [FLAG]: value } } })
  const lib = value => createModuleLoader({ root, globals: unitEnv(value) }).load('lib/studio-one-live-tab.ts')
  const policy = createModuleLoader({ root, globals: unitEnv() }).load('lib/director-reconnect-policy.ts')
  const L = lib('true')
  for (const [event, wanted, why] of [
    [{ code: 4000, reason: 'New connection opened' }, true, "Director's eviction"],
    [{ code: 4000, reason: 'Director heartbeat timeout' }, false, "Studio's own heartbeat retire (timeout)"],
    [{ code: 4000, reason: 'Director heartbeat send failed' }, false, "Studio's own heartbeat retire (send failed)"],
    [{ code: 4000, reason: '' }, false, '4000 without a reason'],
    [{ code: 4000 }, false, '4000 with no reason field'],
    [{ code: 4000, reason: 'new connection opened' }, false, 'the reason in other letters'],
    [{ code: 4000, reason: 'New connection opened ' }, false, 'the reason with a trailing space'],
    [{ code: 4000, reason: 'New connection opened by another tab' }, false, 'a longer reason'],
    [{ code: 1000, reason: 'New connection opened' }, false, 'the reason with another code'],
    [{ code: 1006, reason: '' }, false, 'an abnormal close'],
    [{ code: 4001, reason: 'Browser offline' }, false, "Studio's own offline close"],
    [{ code: 4409, reason: 'New connection opened' }, false, 'a dedicated code Director may add later is not guessed'],
    [{ code: '4000', reason: 'New connection opened' }, false, 'a string code'],
    [null, false, 'no event'], [undefined, false, 'no event'], [{}, false, 'an empty event'],
  ]) same(`isDirectorSupersededClose(${why})`, L.isDirectorSupersededClose(event), wanted)
  same('close code constant', L.DIRECTOR_SUPERSEDED_CLOSE_CODE, 4000)
  same('close reason constant', L.DIRECTOR_SUPERSEDED_CLOSE_REASON, 'New connection opened')
  same('isTabSuperseded(flag on, superseded)', L.isTabSuperseded(true, 'superseded'), true)
  for (const status of ['idle', 'scheduled', 'paused_offline', 'exhausted', 'manual', undefined, null, '']) same(`isTabSuperseded(flag on, ${status})`, L.isTabSuperseded(true, status), false)
  for (const status of ['superseded', 'idle']) same(`isTabSuperseded(flag off, ${status})`, L.isTabSuperseded(false, status), false)
  for (const [value, wanted] of [[undefined, false], ['false', false], ['', false], ['TRUE', false], ['1', false], ['true ', false], ['true', true]]) same(`flag read for ${JSON.stringify(value)}`, lib(value).STUDIO_ONE_LIVE_TAB_ENABLED, wanted)
  same('approved notice words', L.SUPERSEDED_NOTICE_TEXT, APPROVED.notice)
  same('notice title + detail = the notice', `${L.SUPERSEDED_NOTICE_TITLE} ${L.SUPERSEDED_NOTICE_DETAIL}`, APPROVED.notice)
  same('approved button words', L.SUPERSEDED_USE_HERE_LABEL, APPROVED.useHere)
  same('approved header words', L.SUPERSEDED_STATUS_TEXT, APPROVED.header)
  // The reconnect policy is otherwise untouched: the same ladder, and a paused tab never resumes on `online`.
  same('backoff ladder (attempts 0..3, 1500 ms base)', [0, 1, 2, 3].map(attempts => policy.resolveDirectorReconnectPlan({ reconnectEnabled: true, manualDisconnect: false, connectionDesired: true, online: true, attempts, maxAttempts: 4, baseDelayMs: 1500 })),
    [1500, 3000, 6000, 12000].map((delayMs, i) => ({ kind: 'schedule', attempt: i + 1, delayMs })))
  const online = reconnectStatus => policy.shouldReconnectDirectorOnOnline({ reconnectEnabled: true, manualDisconnect: false, connectionDesired: true, resumingFromOffline: true, reconnectStatus, socketReadyState: null })
  same('online resumes an offline pause (control)', online('paused_offline'), true)
  same('online resumes a scheduled retry (control)', online('scheduled'), true)
  same('online never resumes a superseded tab', online('superseded'), false)
  same('online never clears exhaustion (control)', online('exhausted'), false)
  const toSession = status => policy.shouldRequestBuilderSessionConnection({ sessionKey: 's', lastRequestedSessionKey: null, loading: false, connected: false, connecting: false, reconnectStatus: status })
  same('the session effect connects an idle tab (control)', toSession('idle'), true)
  same('the session effect never connects a superseded tab', toSession('superseded'), false)

  // ---- 2. the three transcripts ----------------------------------------------------------------------------------------------------
  const out = {}
  for (const fixture of newFixtures) for (const mode of MODES[fixture.name]) {
    let files
    try { files = await run(root, fixture, mode) } catch (error) { fail(`${fixture.name}/${mode}: the transcript could not be replayed: ${String(error.message).split('\n')[0]}`); continue }
    out[`${fixture.name}/${mode}`] = files
    if (!baselines) continue
    const dir = path.join(FIXTURES, 'baselines', fixture.name, mode)
    const expected = readSnapshot(dir)
    if (!Object.keys(expected).length) { fail(`${fixture.name}/${mode}: no baseline at ${path.relative(repoRoot, dir)}; record one with --update`); continue }
    const diffs = compareSnapshots(expected, files)
    stats.snapshots++
    if (diffs.length) fail(`${fixture.name}/${mode}: ${diffs.length} file(s) differ from the committed baseline\n${diffs.slice(0, 4).map(d => d.kind === 'changed' ? renderDiff(d.file, expected[d.file], files[d.file], 24) : `  ${d.file}: ${d.kind}`).join('\n')}`)
  }

  // ---- 2a. superseded-by-new-tab: what the flag does and does not do ------------------------------------------------------------------
  const A_on = out['superseded-by-new-tab/on'], A_off = out['superseded-by-new-tab/off']
  if (A_on) {
    same('A on: one handshake for the whole transcript (zero reconnect attempts)', handshakes(A_on).length, 1)
    same('A on: one socket', meta(A_on).diagnostics.sockets, 1)
    same('A on: no timer is left running (no backoff, no heartbeat, no stability timer)', meta(A_on).diagnostics.timersLeft, 0)
    same('A on: the hook asked for no token after the first (no connection attempt)', meta(A_on).diagnostics.fetches.length, 1)
    same('A on: exactly one frame ever sent (the first turn)', sends(A_on).map(s => s.kind), ['json:user_message'])
    const evictedAt = named(A_on, 'evicted by another tab')
    same('A on: after the eviction the hook reports superseded, disconnected, attempt 0', [evictedAt.connection.reconnectStatus, evictedAt.connection.state, evictedAt.connection.reconnectAttempt], ['superseded', 'disconnected', 0])
    const lastSend = sends(A_on).at(-1).at
    same('A on: nothing at all is sent after the first turn (no ping, no set_theme)', ndjson(A_on['outbound.ndjson']).filter(e => e.at > lastSend && !['client-close', 'server-close', 'handshake'].includes(e.kind)).length, 0)
    same('A on: the hook itself closed nothing', ndjson(A_on['outbound.ndjson']).filter(e => e.kind === 'client-close').length, 0)
    for (const label of ['evicted by another tab', 'a minute later', 'send in the paused tab', 'offline and online while paused', 'two more minutes']) {
      const c = named(A_on, label)
      same(`A on / ${label}: superseded, no socket added`, [c.connection.reconnectStatus, c.connection.sockets, c.connection.connected, c.connection.connecting], ['superseded', 1, false, false])
    }
    // the words, from the rendered header, notice and composer
    const slug = label => `${String(checkpoints(A_on).findIndex(c => c.label === label) + 1).padStart(2, '0')}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
    const paused = chrome(A_on, slug('evicted by another tab')), connected = chrome(A_on, slug('connected, one turn sent'))
    if (!/data-studio-chat-header-state="superseded">Open in another tab<\/span>/.test(paused || '')) fail('A on: the Director header must read "Open in another tab" while superseded')
    if (!(paused || '').includes(APPROVED.notice)) fail('A on: the paused-tab notice must carry the approved words')
    if (!/<button[^>]*data-studio-superseded-part="use-here"[^>]*>Use here<\/button>/.test(paused || '')) fail('A on: the notice must offer "Use here"')
    if ((connected || '').includes('data-studio-superseded-notice')) fail('A on: a connected tab must not show the paused-tab notice')
    if (!/placeholder="Open in another tab"/.test(composer(A_on, slug('evicted by another tab')) || '')) fail('A on: the composer placeholder must not promise "send to reconnect" while paused')
    // the send in the paused tab
    same('A on: the send showed the notice as a toast (title and description)', calls(A_on).filter(c => c.name === 'page.toast').map(c => c.args[0]), [{ description: 'Changes there are live; this tab is paused.', title: 'This session is open in another tab.' }])
    if (!notes(A_on).some(note => note.includes('typed turn blocked by preflight'))) fail('A on: the send must be stopped by the page preflight')
    // the draft stays in the box
    same('A on: the draft stays in the composer after the blocked send', named(A_on, 'send in the paused tab').page.composer.inputMessage, 'Make the title shorter')
  }
  if (A_off) {
    // The same transcript with the flag off is today's behaviour: the close starts the ladder.
    if (handshakes(A_off).length < 2) fail('A off: the 4000 close must start a reconnect (today: a second handshake follows within 1.5 s)')
    same('A off: scheduled right after the close', named(A_off, 'evicted by another tab').connection.reconnectStatus, 'scheduled')
    if (handshakes(A_off).length >= 2) same('A off: the first reconnect handshake comes exactly 1500 ms after the close', handshakes(A_off)[1].at - serverCloses(A_off)[0].at, 1500)
  }

  // ---- 2b. use-here-takeover -------------------------------------------------------------------------------------------------------------
  const B_on = out['use-here-takeover/on'], C_on = out['ordinary-drop-still-reconnects/on'], C_off = out['ordinary-drop-still-reconnects/off']
  if (B_on) {
    const hs = handshakes(B_on)
    same('B: two handshakes in all (the first connect and ONE Use here)', hs.length, 2)
    same('B: the paused tab sent nothing while paused (still the first turn only)', named(B_on, 'send blocked, draft kept').connection.sockets, 1)
    same('B: a direct hook send in a paused tab gives up at once (0 ms of virtual time) and starts no connection', notes(B_on).filter(n => n.includes('hook send returned')), ['step 15: hook send returned false after 0 ms'])
    same('B: Use here moved the hook out of superseded, connecting', [named(B_on, 'Use here: connecting').connection.reconnectStatus, named(B_on, 'Use here: connecting').connection.connecting], ['idle', true])
    same('B: after the sync the tab is connected again', [named(B_on, 'took the session back').connection.connected, named(B_on, 'took the session back').connection.reconnectStatus], [true, 'idle'])
    same('B: a late close of the OLD socket changes nothing', [named(B_on, 'late close of the old socket ignored').connection.connected, named(B_on, 'late close of the old socket ignored').connection.reconnectStatus, named(B_on, 'late close of the old socket ignored').connection.sockets], [true, 'idle', 2])
    same('B: the draft kept in the paused tab is sent once, on the new socket', sends(B_on).map(s => [s.kind, s.socket]), [['json:user_message', 0], ['json:user_message', 1]])
    same('B: paused again by the other tab: superseded, still two sockets after two minutes', [named(B_on, 'paused again, still one eviction each').connection.reconnectStatus, named(B_on, 'paused again, still one eviction each').connection.sockets], ['superseded', 2])
    same('B: the hook closed nothing itself', ndjson(B_on['outbound.ndjson']).filter(e => e.kind === 'client-close').length, 0)
    same('B: the notice\'s Use here handler is the page\'s connect() (one call recorded)', calls(B_on).filter(c => c.name === 'superseded.onUseHere').length, 1)
    // "normal handshake bytes": the Use here URL has exactly the shape of an ordinary reconnect's (compared with the 1006 transcript)
    if (C_on) {
      const shape = url => { const u = new URL(url); return `${u.origin}${u.pathname}?${[...u.searchParams.keys()].join('&')}` }
      same('B: the Use here handshake has the ordinary reconnect handshake\'s shape', shape(hs[1].url), shape(handshakes(C_on)[1].url))
      same('B: the Use here handshake asks for history exactly like an ordinary reconnect (skip_history, message_count)', [new URL(hs[1].url).searchParams.get('skip_history'), new URL(hs[1].url).searchParams.get('message_count')],
        [new URL(handshakes(C_on)[1].url).searchParams.get('skip_history'), new URL(handshakes(C_on)[1].url).searchParams.get('message_count')])
      same('B: the Use here handshake offers the same protocols as an ordinary reconnect', hs[1].subprotocols, handshakes(C_on)[1].subprotocols)
    }
  }

  // ---- 2c. ordinary-drop-still-reconnects --------------------------------------------------------------------------------------------
  if (C_on && C_off) {
    for (const file of ['outbound.ndjson', 'state.json', 'calls.json', 'keys.json', 'cache.json', 'composer.json']) if (C_on[file] !== C_off[file]) fail(`C: ${file} differs between flag on and flag off (every ordinary close must behave exactly as before)`)
    const hs = handshakes(C_on)
    same('C: eight handshakes (the first connect + one reconnect per ordinary close)', hs.length, 8)
    const closes = serverCloses(C_on)
    same('C: the seven server closes in the transcript (1006 twice, then five other ordinary closes)', closes.map(c => [c.code, c.reason]),
      [[1006, ''], [1006, ''], [4000, 'Director heartbeat timeout'], [1011, 'internal error'], [4000, ''], [4000, 'new connection opened'], [1000, 'New connection opened']])
    same('C: retry 1 comes 1500 ms after the first 1006, retry 2 comes 3000 ms after retry 1 was refused (today\'s ladder)', [hs[1].at - closes[0].at, hs[2].at - closes[1].at], [1500, 3000])
    same('C: every later ordinary close is followed by a reconnect handshake exactly 1500 ms later', closes.slice(2).map((c, i) => hs[3 + i].at - c.at), closes.slice(2).map(() => 1500))
    same('C: never superseded, the hook never closed anything', [checkpoints(C_on).some(c => c.connection.reconnectStatus === 'superseded'), ndjson(C_on['outbound.ndjson']).filter(e => e.kind === 'client-close').length], [false, 0])
  }

  // ---- 2d. use-here-adopts-stored-theme: a takeover meets the theme restore --------------------------------------------------------------------
  const interplay = {}
  for (const mode of ['off', 'on']) {
    let r
    try { r = await runThemeRestoreTranscript({ root, fixture: interplayFixture, mode }) } catch (error) { fail(`${INTERPLAY}/${mode}: the transcript could not be replayed: ${String(error.message).split('\n')[0]}`); continue }
    interplay[mode] = r
    for (const failure of r.failures) fail(`${INTERPLAY}: ${failure}`)
    if (r.diagnostics.blockedNetwork.length || r.diagnostics.console.length || r.diagnostics.uncaught.length) fail(`${INTERPLAY}/${mode}: diagnostics are not clean: ${JSON.stringify(r.diagnostics).slice(0, 200)}`)
    if (!baselines) continue
    const dir = path.join(FIXTURES, 'baselines', INTERPLAY, mode)
    const expected = readSnapshot(dir), actual = interplaySnapshot(r)
    if (!Object.keys(expected).length) { fail(`${INTERPLAY}/${mode}: no baseline at ${path.relative(repoRoot, dir)}; record one with --update`); continue }
    const diffs = compareSnapshots(expected, actual)
    stats.snapshots++
    if (diffs.length) fail(`${INTERPLAY}/${mode}: ${diffs.length} file(s) differ from the committed baseline\n${diffs.slice(0, 3).map(d => d.kind === 'changed' ? renderDiff(d.file, expected[d.file], actual[d.file], 24) : `  ${d.file}: ${d.kind}`).join('\n')}`)
  }
  if (interplay.on) {
    same('interplay on: not one set_theme in the whole transcript (neither at the first connect nor at the takeover)', interplay.on.setThemes.length, 0)
    same('interplay on: exactly two sockets (the first connect and ONE Use here)', interplay.on.outbound.split('\n').filter(l => l.startsWith('{"handshake"')).length, 2)
    same('interplay on: the takeover adopted the theme the other tab stored', interplay.on.state.at(-1).buildThemeSelection, { mode: 'preset', preset_id: 'vibrant' })
    same('interplay on: the restore gate was fresh for the new socket (waiting) before its restore arrived', interplay.on.state.find(c => c.label === 'Use here: socket open, nothing received yet').gate.phase, 'waiting')
  }
  if (interplay.off) same('interplay off (the restore flag off, today): the first connect\'s socket-ready Auto is the only set_theme, and the other tab\'s theme is never adopted', [interplay.off.setThemes.length, interplay.off.state.at(-1).buildThemeSelection], [1, { mode: 'auto' }])

  // ---- 3. flag on, tabs that are never evicted: the nine existing transcripts are unchanged --------------------------------------------
  if (identity) {
    for (const fixture of chatFixtures) for (const profile of Object.keys(PROFILES)) {
      let files
      try { files = await run(root, fixture, 'on', { profile }) } catch (error) { fail(`identity ${fixture.name}/${profile}: ${String(error.message).split('\n')[0]}`); continue }
      const expected = readSnapshot(path.join(DIRECTOR_CHAT, 'baselines', fixture.name, profile))
      // a fixture's own env (the element-preflight ones) is part of its baseline; the flag adds one key to env.json and nothing else
      const diffs = compareSnapshots(expected, files, { skip: name => name === 'env.json' })
      const envOk = (() => { try { const a = JSON.parse(expected['env.json']), b = JSON.parse(files['env.json']); delete b.env[FLAG]; return JSON.stringify(a) === JSON.stringify(b) } catch { return false } })()
      stats.identity++
      if (diffs.length || !envOk) fail(`identity ${fixture.name}/${profile}: flag ON changed ${diffs.map(d => d.file).slice(0, 4).join(', ') || 'env.json'} (a tab that is never evicted must be untouched)`)
    }
  }

  // ---- 5. wiring, read from the sources ------------------------------------------------------------------------------------------------
  const hook = read('hooks/use-deckster-websocket-v2.ts')
  const page = read('app/builder/page.tsx')
  const viewer = read('components/presentation-viewer.tsx')
  const count = (text, re) => (text.match(re) || []).length
  const onclose = hook.slice(hook.indexOf('ws.onclose = (event) => {'), hook.indexOf('      })();\n      return started;'))
  const branchStart = onclose.indexOf('if (STUDIO_ONE_LIVE_TAB_ENABLED && isDirectorSupersededClose(event)) {')
  const branch = branchStart < 0 ? '' : onclose.slice(branchStart, onclose.indexOf('scheduleReconnect(`close:${event.code}`)'))
  if (!branch) fail('hook: ws.onclose must start with `if (STUDIO_ONE_LIVE_TAB_ENABLED && isDirectorSupersededClose(event)) {` before scheduleReconnect(`close:...`)')
  else {
    if (!/setReconnectStatus\('superseded'/.test(branch) || !/\breturn;/.test(branch)) fail('hook: the superseded branch must set the superseded status and return (no scheduleReconnect)')
    if (/\b(?:send|startConnection|connect|ensureConnected|scheduleReconnect|setTimeout|fetch|new WebSocket)\s*\(/.test(branch.replace(/\/\/.*$/gm, ''))) fail('hook: the superseded branch must not send, connect or set a timer')
  }
  if (count(hook, /isDirectorSupersededClose\(/g) !== 1) fail('hook: isDirectorSupersededClose must be used exactly once (the close handler)')
  if (count(hook, /scheduleReconnect\(`close:\$\{event\.code\}`\)/g) !== 1) fail('hook: the ordinary close must still schedule the reconnect, once')
  if (!/reconnectStatusRef\.current === 'exhausted' \|\|\s*\/\/[^\n]*\n\s*reconnectStatusRef\.current === 'superseded'/.test(hook)) fail("hook: handleOffline must leave a superseded tab alone (an offline pause would be resumed by `online`)")
  if (!/if \(STUDIO_ONE_LIVE_TAB_ENABLED && reconnectStatusRef\.current === 'superseded'\) return false;/.test(hook)) fail('hook: sendMessageWhenConnected must give up at once on a superseded tab')
  const flagReads = []
  const walk = dir => { for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) { const rel = path.join(dir, entry.name); if (entry.isDirectory()) { if (!['node_modules', '.next', '.git', 'docs', 'public'].includes(entry.name)) walk(rel) } else if (/\.(ts|tsx)$/.test(entry.name) && fs.readFileSync(path.join(root, rel), 'utf8').includes('process.env.NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB')) flagReads.push(rel) } }
  for (const dir of ['app', 'components', 'hooks', 'lib']) walk(dir)
  same('the flag is read in exactly one place', flagReads, ['lib/studio-one-live-tab.ts'])
  if ((page.match(/<StudioSupersededNotice\b[^>]*onUseHere=\{connect\}[^>]*\/>/g) || []).length !== 1) fail('page: <StudioSupersededNotice> must be rendered once with onUseHere={connect} (the hook\'s own explicit connect)')
  if (!/const oneLiveTabSuperseded = isTabSuperseded\(STUDIO_ONE_LIVE_TAB_ENABLED, reconnectStatus\)/.test(page)) fail('page: oneLiveTabSuperseded must be isTabSuperseded(STUDIO_ONE_LIVE_TAB_ENABLED, reconnectStatus)')
  const preflight = page.slice(page.indexOf('const preflightDirectorTurn = useCallback('), page.indexOf('const handleSendMessage = useCallback('))
  if (!/if \(oneLiveTabSuperseded\) \{\s*toast\(\{ title: SUPERSEDED_NOTICE_TITLE, description: SUPERSEDED_NOTICE_DETAIL \}\)\s*return false\s*\}/.test(preflight)) fail('page: preflightDirectorTurn must show the notice and refuse while superseded')
  if (!/\[user, oneLiveTabSuperseded,/.test(preflight)) fail('page: oneLiveTabSuperseded must be a dependency of preflightDirectorTurn')
  if (!page.includes('pausedInOtherTab={oneLiveTabSuperseded}')) fail('page: the composer must get pausedInOtherTab={oneLiveTabSuperseded}')
  if (!page.includes('studioTabPausedHint={oneLiveTabSuperseded ? SUPERSEDED_NOTICE_TEXT : undefined}')) fail('page: the canvas must get the hint only while superseded')
  if (!/<StudioDirectorHeader connectionState=\{connectionState\} isLoadingSession=\{session\.isLoadingSession\} reconnectStatus=\{reconnectStatus\}/.test(page)) fail('page: the Director header must still get the hook\'s reconnectStatus')
  // The four controls: each is disabled and hinted while paused, and the wrapper/hint exist only with a hint.
  if (!/const tabPaused = Boolean\(studioTabPausedHint\)/.test(viewer)) fail('viewer: tabPaused must be Boolean(studioTabPausedHint)')
  const controls = [
    ['Add Slide', /disabled=\{!viewerIsReady \|\| templateModeOn \|\| isSlideMutationPending \|\| tabPaused\}\s*className="min-w-\[80px\] justify-center"/],
    ['Add Element', /disabled=\{!viewerIsReady \|\| templateModeOn \|\| isSlideMutationPending \|\| tabPaused\}\s*className=\{cn\(toolbarButtonClass, toolbarBtnBase, "min-w-\[96px\]"\)\}\s*title=\{tabPaused \? studioTabPausedHint : "Add an element"\}/],
    ['Template (menu)', /disabled=\{!viewerIsReady \|\| tabPaused\}\s*className=\{cn\(toolbarButtonClass, toolbarBtnBase\)\}\s*title=\{tabPaused \? studioTabPausedHint : "Template options"\}/],
    ['Template (workspace picker)', /<StudioTemplatePicker\s*disabled=\{!viewerIsReady \|\| tabPaused\}/],
    ['Theme', /disabled=\{!viewerIsReady \|\| templateModeOn \|\| tabPaused\}\s*className=\{cn\(toolbarButtonClass, toolbarBtnBase\)\}\s*title=\{tabPaused \? studioTabPausedHint : "Presentation theme"\}/],
  ]
  for (const [name, re] of controls) if (!re.test(viewer)) fail(`viewer: ${name} must be disabled and hinted while the tab is paused`)
  if (!/tabPausedWrap\(<SlideLayoutPicker/.test(viewer) || !/tabPausedWrap\(<StudioTemplatePicker/.test(viewer)) fail('viewer: the Add Slide and workspace Template controls must carry the hint on a wrapper (their buttons are inside other components)')
  if (!new RegExp(`pausedInOtherTab\\s*\\? "${APPROVED.header}"`).test(read('components/builder/chat-input.tsx'))) fail('composer: the paused placeholder is missing')
  if (!new RegExp(`if \\(reconnectStatus === "superseded"\\) return \\{ tone: "superseded", text: "${APPROVED.header}" \\}`).test(read('components/builder/chat/studio-director-header.tsx'))) fail('header: superseded must read "Open in another tab"')
  for (const file of ['components/builder/chat-input.tsx', 'components/builder/chat/studio-director-header.tsx']) if (/from ['"]@\/lib\/studio-one-live-tab['"]/.test(read(file))) fail(`${file}: must keep its imports (other tests load it with a fixed import map); the words are literals`)
  const noticeSource = read('components/builder/studio-superseded-notice.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  if (/\b(?:useEffect|useState|useRef|useCallback|setTimeout|setInterval|fetch|WebSocket|sessionStorage|localStorage)\b/.test(noticeSource)) fail('notice: the paused-tab notice must stay pure presentation (no state, effect, timer or request)')
  if (!/^NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB="false"$/m.test(read('.env.example'))) fail('.env.example: NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB="false" is not documented')
  const pkg = JSON.parse(read('package.json'))
  if (pkg.scripts?.['test:studio-one-live-tab'] !== 'node scripts/test-studio-one-live-tab.mjs') fail('package.json: test:studio-one-live-tab is missing')
  return { failures, stats, out }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// --base-root: the same transcripts, flag OFF, run against the BASE tree and against this tree: every file must be byte-identical.
async function baseComparison(baseRoot) {
  const failures = []
  const rows = []
  const total = createHashLike()
  for (const fixture of [...chatFixtures, ...newFixtures.filter(f => MODES[f.name].includes('off'))]) for (const profile of Object.keys(PROFILES)) {
    const label = `${fixture.name}/${profile}`
    let a, b
    try { a = await run(baseRoot, fixture, 'off', { profile }); b = await run(repoRoot, fixture, 'off', { profile }) } catch (error) { failures.push(`${label}: ${String(error.message).split('\n')[0]}`); continue }
    const diffs = compareSnapshots(a, b)
    const hash = sha(Object.keys(b).sort().map(name => `${name}\n${b[name]}`).join('\n--\n'))
    total.add(hash)
    rows.push(`${diffs.length === 0 ? 'IDENTICAL' : 'DIFFERS  '}  ${label.padEnd(54)} ${Object.keys(b).length} files  sha256 ${hash.slice(0, 16)}`)
    if (diffs.length) failures.push(`${label}: flag OFF differs from the base tree in ${diffs.map(d => d.file).slice(0, 5).join(', ')}`)
  }
  return { failures, rows, total: total.digest() }
}
function createHashLike() { const h = crypto.createHash('sha256'); return { add: text => h.update(text + '\n'), digest: () => h.digest('hex') } }

// ---------------------------------------------------------------------------------------------------------------------------------
async function updateBaselines() {
  for (const fixture of newFixtures) for (const mode of MODES[fixture.name]) {
    const files = await run(repoRoot, fixture, mode)
    const dir = path.join(FIXTURES, 'baselines', fixture.name, mode)
    writeSnapshot(dir, files)
    console.log(`UPDATED ${fixture.name}/${mode} (${Object.keys(files).length} files)`)
  }
  for (const mode of ['off', 'on']) {
    const files = interplaySnapshot(await runThemeRestoreTranscript({ root: repoRoot, fixture: interplayFixture, mode }))
    writeSnapshot(path.join(FIXTURES, 'baselines', INTERPLAY, mode), files)
    console.log(`UPDATED ${INTERPLAY}/${mode} (${Object.keys(files).length} files)`)
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Mutation check: copy the sources the replay reads into a scratch directory, break them one way at a time, and require the checks above to
// notice every break (and to pass on the unbroken copy). A fresh copy per mutation: the harness caches the parsed page per root.
async function mutationCheck() {
  const scratches = []
  const makeScratch = () => {
    const scratch = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'one-live-tab-'))
    scratches.push(scratch)
    const copy = relative => { fs.mkdirSync(path.dirname(path.join(scratch, relative)), { recursive: true }); fs.cpSync(path.join(repoRoot, relative), path.join(scratch, relative), { recursive: true }) }
    for (const relative of ['components', 'lib', 'hooks', 'types', 'app/builder/page.tsx', 'package.json', '.env.example', 'tsconfig.json', 'scripts/studio-chat-harness', 'scripts/fixtures']) copy(relative)
    fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(scratch, 'node_modules'))
    return scratch
  }
  const HOOK = 'hooks/use-deckster-websocket-v2.ts', PAGE = 'app/builder/page.tsx', LIB = 'lib/studio-one-live-tab.ts', POLICY = 'lib/director-reconnect-policy.ts'
  const NOTICE = 'components/builder/studio-superseded-notice.tsx', HEADER = 'components/builder/chat/studio-director-header.tsx', VIEWER = 'components/presentation-viewer.tsx'
  const mutations = [
    ['hook: the close branch ignores the flag (flag-off tabs would pause)', HOOK, s => s.replace('if (STUDIO_ONE_LIVE_TAB_ENABLED && isDirectorSupersededClose(event)) {', 'if (isDirectorSupersededClose(event)) {')],
    ['hook: any 4000 pauses the tab (Studio\'s own heartbeat retire too)', LIB, s => s.replace("    && event!.reason === DIRECTOR_SUPERSEDED_CLOSE_REASON\n", '\n')],
    ['hook: the superseded branch falls through to scheduleReconnect', HOOK, s => s.replace("            setReconnectStatus('superseded', reconnectAttemptsRef.current);\n            return;\n", "            setReconnectStatus('superseded', reconnectAttemptsRef.current);\n")],
    ['hook: the superseded status is never set', HOOK, s => s.replace("            setReconnectStatus('superseded', reconnectAttemptsRef.current);\n            return;\n", "            return;\n")],
    ['hook: an offline pause resumes a superseded tab on online', HOOK, s => s.replace("reconnectStatusRef.current === 'exhausted' ||\n        // A tab Director handed over to another tab has nothing to resume when the network returns.\n        reconnectStatusRef.current === 'superseded'", "reconnectStatusRef.current === 'exhausted'")],
    ['hook: sendMessageWhenConnected waits out its window on a superseded tab', HOOK, s => s.replace("    if (STUDIO_ONE_LIVE_TAB_ENABLED && reconnectStatusRef.current === 'superseded') return false;\n", '')],
    ['policy: online resumes a superseded tab', POLICY, s => s.replace(" || reconnectStatus === 'superseded') return false", ') return false')],
    ['page: the preflight lets a send through while paused', PAGE, s => s.replace('    if (oneLiveTabSuperseded) {\n      toast({ title: SUPERSEDED_NOTICE_TITLE, description: SUPERSEDED_NOTICE_DETAIL })\n      return false\n    }\n', '')],
    ['page: Use here is wired to nothing', PAGE, s => s.replace('active={oneLiveTabSuperseded} onUseHere={connect} />', 'active={oneLiveTabSuperseded} onUseHere={() => {}} />')],
    ['notice: the approved words changed', LIB, s => s.replace("'Changes there are live; this tab is paused.'", "'Changes there are live.'")],
    ['header: superseded no longer reads "Open in another tab"', HEADER, s => s.replace('  if (reconnectStatus === "superseded") return { tone: "superseded", text: "Open in another tab" }\n', '')],
    ['notice: the paused-tab notice renders for a connected tab', NOTICE, s => s.replace('if (!active) return null', 'if (false) return null')],
    ['viewer: Add Element stays enabled while paused', VIEWER, s => s.replace('disabled={!viewerIsReady || templateModeOn || isSlideMutationPending || tabPaused}\n                    className={cn(toolbarButtonClass, toolbarBtnBase, "min-w-[96px]")}', 'disabled={!viewerIsReady || templateModeOn || isSlideMutationPending}\n                    className={cn(toolbarButtonClass, toolbarBtnBase, "min-w-[96px]")}')],
  ]
  let ok = true
  try {
    const control = await checks(makeScratch(), { identity: false })
    console.log(control.failures.length === 0 ? 'mutation control: the unbroken scratch copy passes' : `mutation control FAILED: ${control.failures.length} failures on the unbroken copy\n  - ${control.failures.slice(0, 5).join('\n  - ')}`)
    if (control.failures.length) ok = false
    for (const [name, file, edit] of mutations) {
      const scratch = makeScratch()
      const target = path.join(scratch, file), original = fs.readFileSync(target, 'utf8'), mutated = edit(original)
      if (mutated === original) { console.log(`MUTATION NOT APPLIED  ${name}`); ok = false; continue }
      fs.writeFileSync(target, mutated)
      let result
      try { result = await checks(scratch, { identity: false }) } catch (error) { result = { failures: [`threw: ${String(error.message).split('\n')[0]}`] } }
      const caught = result.failures.length > 0
      ok &&= caught
      console.log(`${caught ? 'caught' : 'MISSED'}  ${name}  (${result.failures.length} failure${result.failures.length === 1 ? '' : 's'}; first: ${(result.failures[0] || '-').split('\n')[0].slice(0, 120)})`)
    }
  } finally { for (const scratch of scratches) fs.rmSync(scratch, { recursive: true, force: true }) }
  return ok
}

if (flag('--update')) { await updateBaselines(); release(); process.exit(0) }
const { failures, stats } = await checks(repoRoot)
let mutationsOk = true
if (flag('--mutation-check')) mutationsOk = await mutationCheck()
let base = null
if (option('--base-root')) {
  base = await baseComparison(path.resolve(option('--base-root')))
  console.log(base.rows.join('\n'))
  console.log(`flag-off outputs, ${base.rows.length} transcript x profile runs, run against the base tree and this tree: ${base.failures.length === 0 ? 'ALL IDENTICAL' : 'DIFFERENCES'}  combined sha256 ${base.total}`)
  failures.push(...base.failures)
}
release()
if (failures.length) {
  console.error(`FAIL studio one live tab (${failures.length}):\n` + failures.slice(0, 40).map(line => `  - ${line}`).join('\n') + (failures.length > 40 ? `\n  ... ${failures.length - 40} more` : ''))
  process.exit(1)
}
if (!mutationsOk) { console.error('FAIL studio one live tab: the mutation check did not catch every break'); process.exit(1) }
console.log(`PASS studio one live tab: ${stats.units} unit checks, ${stats.snapshots} transcript snapshots equal their baselines, ${stats.identity} existing transcript x profile runs unchanged with the flag on`
  + (flag('--mutation-check') ? '; all thirteen mutations caught' : '') + (base ? `; flag off == base tree for ${base.rows.length} runs` : ''))
