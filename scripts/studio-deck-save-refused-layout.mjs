// FRONTEND-2 (B46): runs the REAL Layout of MR !263 (LAYOUT_SLIDES_PUT_STALE_GUARD_ENABLED, branch frontend2/layout-put-guard) for scripts/test-studio-deck-save-refused-notice.mjs.
//
// What runs is Layout's, unchanged, from a read-only `git archive` export of one commit (never a working tree):
//   - server.py (FastAPI, the real route, middleware and filesystem store) in a python child on loopback, started by a launcher written to a temp folder here. The export is not written to: the child runs in a temp
//     folder of symlinks to the export's entries, so the store (storage/presentations, storage/versions) and any cache land in the temp folder, which is removed afterwards;
//   - tests/slides_put_stale_guard_viewer.js, !263's own harness: the real src/utils/auto-save.js in a node vm against that server, Director's changes made with node's fetch (foreign writes);
//   - for the one non-refusal error, the same harness with a transport fault injected through `node -r` (the page's PUT /slides answers 500 before it reaches the server; the viewer's reply to it is real).
// Nothing but loopback is touched; no model, no browser, no env value is read or passed on (the children get PATH and the flag only).
//
//   recordTranscripts({ layoutDir, python, flag })  ->  { meta, scenarios }  (what the fixture holds; the proof reads the fixture offline and, with the export given, re-records it live and compares)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFile } from 'node:child_process'

export const REFUSAL_KINDS = ['add', 'duplicate', 'delete', 'undo', 'refine']

const LAUNCHER = `"""B46: Layout's real server.py (an export of one commit, reached through a folder of symlinks) on loopback over a throwaway filesystem store; seeds one deck per scenario."""
import asyncio, json, os, socket, sys, threading, time
from copy import deepcopy
run_dir, storage_dir, flag, *scenarios = sys.argv[1:]
sys.dont_write_bytecode = True
sys.path.insert(0, run_dir)
os.chdir(run_dir)
if flag == "on":
    os.environ["LAYOUT_SLIDES_PUT_STALE_GUARD_ENABLED"] = "true"
else:
    os.environ.pop("LAYOUT_SLIDES_PUT_STALE_GUARD_ENABLED", None)
import config
config.reload_settings()
import server, uvicorn
from storage import FilesystemPresentationStorage
store = FilesystemPresentationStorage(storage_dir)
server.storage = store
def deck():
    return {"title": "Stale guard", "slides": [{"layout": "C1", "content": {"slide_title": t}, "slide_id": "slide_%s%d" % ("abc"[i], i)} for i, t in enumerate(("A", "B", "C"))]}
loop = asyncio.new_event_loop()
decks = {name: loop.run_until_complete(store.save(deepcopy(deck()))) for name in scenarios}
with socket.socket() as s:
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
uv = uvicorn.Server(uvicorn.Config(server.app, host="127.0.0.1", port=port, log_level="warning", lifespan="off"))
thread = threading.Thread(target=uv.run, daemon=True)
thread.start()
deadline = time.time() + 40
while not uv.started and time.time() < deadline:
    time.sleep(0.05)
if not uv.started:
    print(json.dumps({"error": "server did not start"}), flush=True)
    sys.exit(2)
print(json.dumps({"ready": True, "port": port, "decks": decks, "flag": bool(getattr(config.get_settings(), "LAYOUT_SLIDES_PUT_STALE_GUARD_ENABLED", False))}), flush=True)
sys.stdin.read()
uv.should_exit = True
thread.join(timeout=10)
`

// node -r: the page's whole-deck PUT answers 500 at the transport; every other request (the page, Director's writes, the reads) is the real server's.
const FAULT = `const real = globalThis.fetch
globalThis.fetch = async function (url, init) {
  if (init && String(init.method || '').toUpperCase() === 'PUT' && /\\/slides$/.test(String(url)) && !/\\/slides\\/\\d+$/.test(String(url))) {
    return new Response(JSON.stringify({ detail: 'Internal Server Error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
  return real.apply(this, arguments)
}
`

const run = (file, args, { cwd, env, timeout = 120000 } = {}) => new Promise((resolve, reject) => {
  execFile(file, args, { cwd, env, timeout, maxBuffer: 1 << 26, encoding: 'utf8' }, (error, stdout, stderr) => {
    if (error) reject(new Error(`${path.basename(file)} ${args.slice(0, 3).join(' ')}: ${error.message.split('\n')[0]}\n${String(stderr).split('\n').slice(-6).join('\n')}`))
    else resolve(stdout)
  })
})

/** A Layout on loopback: `stop()` closes the child's stdin (it exits), waits, and removes the temp folder. `flag` is "on" or "off". */
export async function startLayout({ layoutDir, python, flag, scenarios }) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'b46-layout-'))
  const runDir = path.join(temp, 'run')
  fs.mkdirSync(runDir)
  for (const entry of fs.readdirSync(layoutDir)) fs.symlinkSync(path.join(layoutDir, entry), path.join(runDir, entry))
  const launcher = path.join(temp, 'launcher.py')
  fs.writeFileSync(launcher, LAUNCHER)
  fs.mkdirSync(path.join(temp, 'store'))
  const child = spawn(python, ['-B', launcher, runDir, path.join(temp, 'store'), flag, ...scenarios], {
    cwd: runDir, env: { PATH: '/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1' }, stdio: ['pipe', 'pipe', 'pipe'],
  })
  let out = '', err = ''
  child.stdout.on('data', chunk => { out += chunk })
  child.stderr.on('data', chunk => { err += chunk })
  const exited = new Promise(resolve => child.on('exit', resolve))
  const stop = async () => {
    try { child.stdin.end() } catch { /* already closed */ }
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 15000))])
    if (child.exitCode === null) child.kill('SIGTERM') // our own child only
    fs.rmSync(temp, { recursive: true, force: true })
  }
  const ready = await new Promise((resolve, reject) => {
    const started = Date.now()
    const timer = setInterval(() => {
      const line = out.split('\n').find(item => item.startsWith('{"ready"') || item.startsWith('{"error"'))
      if (line) { clearInterval(timer); resolve(JSON.parse(line)) }
      else if (child.exitCode !== null || Date.now() - started > 90000) { clearInterval(timer); reject(new Error(`Layout did not start: ${err.split('\n').slice(-8).join('\n')}`)) }
    }, 50)
  }).catch(async error => { await stop(); throw error })
  if (ready.error) { await stop(); throw new Error(ready.error) }
  return { base: `http://127.0.0.1:${ready.port}`, decks: ready.decks, flag: ready.flag, stop, temp }
}

/** The harness' JSON for one scenario, from the export's own tests/slides_put_stale_guard_viewer.js. `fault`: the page's whole-deck PUT answers 500 at the transport. */
export async function viewerScenario({ layoutDir, base, scenario, deckId, fault = false, flush = false, tempDir }) {
  const args = [path.join(layoutDir, 'tests/slides_put_stale_guard_viewer.js'), path.join(layoutDir, 'src/utils/auto-save.js'), base, scenario, deckId, ...(flush ? ['flush'] : [])]
  if (fault) {
    const preload = path.join(tempDir, 'fault.cjs')
    fs.writeFileSync(preload, FAULT)
    args.unshift('-r', preload)
  }
  const stdout = await run(process.execPath, args, { cwd: tempDir, env: { PATH: '/usr/bin:/bin' } })
  return JSON.parse(stdout)
}

/** A stale whole-deck save sent straight to the server (what the viewer's PUT is): the refusal's status and body. */
export async function staleSave({ base, deckId, expected, ids }) {
  const response = await fetch(`${base}/api/presentations/${deckId}/slides`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Layout-Deck-Version': JSON.stringify(expected) },
    body: JSON.stringify({ slides: ids.map(id => ({ slide_id: id })), updated_by: 'user', change_summary: 'Auto-save from editor', expected_updated_at: expected }),
  })
  return { status: response.status, body: await response.json().catch(() => null) }
}

const frameOf = message => JSON.parse(JSON.stringify(message))

/** Record what Studio's handler is fed. Flag on: a refusal for every kind of change by Director, the viewer's own saves, a non-refusal error. Flag off: the same stale save is stored, no deckChanged. */
export async function recordTranscripts({ layoutDir, python, sha }) {
  const scenarios = {}
  const on = await startLayout({ layoutDir, python, flag: 'on', scenarios: [...REFUSAL_KINDS.map(kind => `stale:${kind}`), 'own', 'fault'] })
  try {
    for (const kind of REFUSAL_KINDS) {
      const name = `stale:${kind}`
      const out = await viewerScenario({ layoutDir, base: on.base, scenario: name, deckId: on.decks[name], tempDir: on.temp })
      const stored = await (await fetch(`${on.base}/api/presentations/${on.decks[name]}`)).json()
      const loaded = out.deckAfterChange
      scenarios[name] = {
        layoutFlagServed: out.flagServed, putStatuses: out.afterSave.puts.map(put => put.status), putsAfterTimers: out.putsAfterTimers,
        pendingAfterRefusal: out.afterSave.pending, deckUnchanged: JSON.stringify(out.deckEnd) === JSON.stringify(out.deckAfterChange),
        refusal: await staleSave({ base: on.base, deckId: on.decks[name], expected: '1999-01-01T00:00:00', ids: stored.slides.map(slide => slide.slide_id) }),
        frames: out.messages.map(frameOf), after: { slidesAfterChange: loaded.slides.length },
      }
    }
    const own = await viewerScenario({ layoutDir, base: on.base, scenario: 'own', deckId: on.decks.own, tempDir: on.temp })
    scenarios.own = { layoutFlagServed: own.flagServed, putStatuses: own.puts.map(put => put.status), finalStatus: frameOf(own.status), frames: [frameOf(own.status)] }
    // the unload flush (one request, no retry timers) of a page whose whole-deck PUT fails at the transport: the viewer's own "error" frame, with no deckChanged
    const fault = await viewerScenario({ layoutDir, base: on.base, scenario: 'keepalive', deckId: on.decks.fault, tempDir: on.temp, fault: true, flush: true })
    scenarios.fault = { layoutFlagServed: fault.flagServed, putStatuses: fault.ownFlush.puts.map(put => put.status), frames: fault.messages.map(frameOf) }
  } finally { await on.stop() }
  const off = await startLayout({ layoutDir, python, flag: 'off', scenarios: ['stale:refine'] })
  try {
    const out = await viewerScenario({ layoutDir, base: off.base, scenario: 'stale:refine', deckId: off.decks['stale:refine'], tempDir: off.temp })
    scenarios['layout-flag-off:stale:refine'] = { layoutFlagServed: out.flagServed, putStatuses: out.afterSave.puts.map(put => put.status), frames: out.messages.map(frameOf) }
  } finally { await off.stop() }
  return { meta: { layoutCommit: sha, layoutMr: '!263 (frontend2/layout-put-guard)', how: 'tests/slides_put_stale_guard_viewer.js (the real src/utils/auto-save.js) against the real server.py on loopback, from a git archive export' }, scenarios }
}
