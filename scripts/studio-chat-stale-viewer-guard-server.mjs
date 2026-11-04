// NEXT_PUBLIC_STUDIO_CHAT_STALE_VIEWER_GUARD (FRONTEND-2 B43): Layout's REAL server (server.py, in process through httpx's ASGI transport, storage replaced by a dict with versions) for the stale-viewer proof.
// It answers what Director does to a deck on the server (add a slide, duplicate, delete, reorder, undo = restore a version), the slide inventory GET Studio reads, and the PUTs of a viewer that was loaded before those changes.
// A job is {deck, versions?, requests:[{method, url, body}]}; the answer carries the stored deck, the versions kept, each status and body. Layout's code is run unchanged: LAYOUT_CHAT_TARGETED_SAVE_ENABLED and LAYOUT_SLIDE_THUMBNAILS_ENABLED
// are set (the targeted save and the inventory the rail reads). What is not Layout's: the storage (a dict; every update keeps the stored deck BEFORE it as a version, as Layout's own storage does; restore_version puts one back after a backup).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const SERVER_APPLY = String.raw`
import asyncio, io, json, os, sys, contextlib
from copy import deepcopy
layout = sys.argv[1]
sys.path.insert(0, layout)
os.chdir(layout)
os.environ["LAYOUT_CHAT_TARGETED_SAVE_ENABLED"] = "true"
os.environ["LAYOUT_SLIDE_THUMBNAILS_ENABLED"] = "true"
os.environ["ENABLE_SUPABASE"] = "false"
jobs = json.load(open(sys.argv[2], encoding="utf-8"))
with contextlib.redirect_stdout(io.StringIO()):
    import config, server, httpx
    config.reload_settings()
class Memory:
    def __init__(self, deck, versions):
        self.presentation, self.versions, self.updates = deck, versions, []
    async def load(self, pid): return deepcopy(self.presentation) if pid == self.presentation["id"] else None
    async def update(self, pid, updates, **kw):
        if kw.get("create_version"):
            self.versions.append({"version_id": "v%d" % (len(self.versions) + 1), "created_by": kw.get("created_by"), "change_summary": kw.get("change_summary"), "presentation": deepcopy(self.presentation)})
        self.updates.append(kw.get("change_summary"))
        self.presentation = {**self.presentation, **deepcopy(updates)}
        return self.presentation
    async def restore_version(self, pid, version_id, create_backup=True):
        found = next((v for v in self.versions if v["version_id"] == version_id), None)
        if not found: return None
        if create_backup:
            self.versions.append({"version_id": "v%d" % (len(self.versions) + 1), "created_by": "system", "change_summary": "Backup before restore", "presentation": deepcopy(self.presentation)})
        self.presentation = deepcopy(found["presentation"])
        return self.presentation
import itertools, uuid
async def main():
    out = []
    for job in jobs:
        store = Memory(job["deck"], job.get("versions") or []); server.storage = store
        # ids Layout draws at random (a new slide's slide_<hex>) are counted instead, from the versions already kept, so a run is the same bytes every time
        counter = itertools.count((len(store.versions) + 1) * 1000)
        fixed_uuid = lambda: uuid.UUID(int=next(counter) << 80)
        server.uuid4 = fixed_uuid; uuid.uuid4 = fixed_uuid
        statuses, bodies = [], []
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://layout") as client:
            for request in job["requests"]:
                response = await client.request(request["method"], request["url"], json=request.get("body"))
                statuses.append(response.status_code)
                try: bodies.append(response.json())
                except Exception: bodies.append(None)
        out.append({"deck": store.presentation, "versions": store.versions, "statuses": statuses, "bodies": bodies, "summaries": store.updates})
    return out
with contextlib.redirect_stdout(io.StringIO()):
    result = asyncio.run(main())
sys.stdout.write("\n@@RESULT@@" + json.dumps(result))
`

/** Each job answered by Layout's own server; throws when the interpreter fails. The jobs go by file, not stdin (a stdin pipe to python hung intermittently on this Mac). */
export function runLayoutServer(python, layoutDir, jobs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-viewer-guard-'))
  const file = path.join(dir, 'jobs.json')
  fs.writeFileSync(file, JSON.stringify(jobs))
  let out
  try {
    out = execFileSync(python, ['-B', '-c', SERVER_APPLY, layoutDir, file], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 120_000,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    throw new Error(`Layout's server could not run the jobs: ${String(error?.stderr ?? error?.message ?? error).split('\n').filter(Boolean).slice(-6).join(' | ').slice(0, 900)}`)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  return JSON.parse(out.slice(out.lastIndexOf('@@RESULT@@') + '@@RESULT@@'.length))
}

/** One server: its stored deck and versions live here between calls. `request` runs one or more requests against it and returns the statuses and bodies. */
export function createServer(python, layoutDir, deck) {
  const state = { deck: JSON.parse(JSON.stringify(deck)), versions: [], log: [] }
  return {
    state,
    request(requests) {
      const [answer] = runLayoutServer(python, layoutDir, [{ deck: state.deck, versions: state.versions, requests }])
      state.deck = answer.deck; state.versions = answer.versions
      for (let i = 0; i < requests.length; i++) state.log.push({ method: requests[i].method, url: requests[i].url, status: answer.statuses[i], summary: answer.summaries[i] ?? null })
      return answer
    },
  }
}
