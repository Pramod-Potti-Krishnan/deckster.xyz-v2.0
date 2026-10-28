// NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE (FRONTEND-2 B33): Layout's REAL load path and REAL save endpoints, for the reload-persistence table of scripts/test-studio-chat-edit-targeted.mjs.
//
// What runs is Layout's, unchanged (a layout-builder checkout):
//  - the load (drag-drop.js loaded, as the page loads it, so restored elements are draggable): viewer/presentation-viewer.html's restoreTextBoxes / restoreImages (cut out by exact anchors), then, for every slide, direct-element-creator.js
//    createElementsForTemplate(slide, i, layout, slide.content, deck, n), the call renderPresentation makes for a direct-element template (C1 here), with
//    src/templates/template-registry.js and src/utils/semantic-slot-catalog.js, over the viewer world of scripts/studio-chat-element-edit-layout.mjs (element-manager.js inserts);
//  - the save: Layout's own server (server.py, in process through httpx's ASGI transport, storage replaced by a dict) answers the PUT the viewer made: today's whole-deck
//    PUT /api/presentations/{id}/slides, or the targeted PUT .../elements/{id}/chat-save (LAYOUT_CHAT_TARGETED_SAVE_ENABLED on). That needs a Python with Layout's
//    requirements (CHAT_EDIT_TARGETED_LAYOUT_PYTHON, e.g. a layout venv); offline the proof reads what this recorded.
// What is not Layout's: the fake DOM's cssText (parsed into the inline style properties the browser would set) and a deterministic crypto.getRandomValues (element ids).
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'

export const RELOAD_SCRIPTS = ['src/utils/drag-drop.js', 'src/templates/template-registry.js', 'src/utils/semantic-slot-catalog.js', 'src/utils/direct-element-creator.js']

const camel = name => name.trim().replace(/-([a-z])/g, (_m, letter) => letter.toUpperCase())

/** Makes `world` able to run Layout's load path: cssText on new nodes, deterministic random ids, the creator's scripts, the cut-out restore functions. */
function prepare(world, layoutDir) {
  const ctx = world.context
  if (ctx.__reloadReady) return
  ctx.Uint8Array = Uint8Array
  let seed = 0
  ctx.crypto.getRandomValues = array => { for (let i = 0; i < array.length; i++) array[i] = (++seed * 37 + 11) & 255; return array }
  const make = ctx.document.createElement
  ctx.document.createElement = tag => {
    const node = make(tag)
    Object.defineProperty(node.style, 'cssText', { configurable: true, enumerable: false,
      get() { return Object.entries(this).map(([key, value]) => `${key}: ${value}`).join('; ') },
      set(text) { for (const key of Object.keys(this)) delete this[key]; for (const part of String(text).split(';')) { const at = part.indexOf(':'); if (at > 0) this[camel(part.slice(0, at))] = part.slice(at + 1).trim() } } })
    // innerHTML: the markup string as given, plus its top-level <tag class="..."></tag> children as nodes (element-manager.js builds an
    // image / chart wrapper from a template string: drag handle, .element-content, delete button, resize handles)
    node.replaceChildren = (...kids) => { node.children.slice().forEach(child => node.removeChild(child)); kids.forEach(kid => node.appendChild(kid)) }
    node.append = (...kids) => kids.forEach(kid => node.appendChild(typeof kid === 'string' ? ctx.document.createTextNode(kid) : kid))
    let markup = ''
    Object.defineProperty(node, 'innerHTML', { configurable: true, enumerable: true,
      get() { return markup },
      set(text) {
        markup = String(text)
        if (!/<\w/.test(markup) || !/class="element-content"/.test(markup)) return
        node.children.slice().forEach(child => node.removeChild(child))
        for (const match of markup.matchAll(/<(\w+)([^>]*)>([^<]*)<\/\1>/g)) {
          const child = ctx.document.createElement(match[1])
          const cls = /class="([^"]*)"/.exec(match[2])
          if (cls) child.className = cls[1]
          node.appendChild(child)
        }
      } })
    return node
  }
  for (const file of RELOAD_SCRIPTS) vm.runInContext(fs.readFileSync(path.join(layoutDir, file), 'utf8'), ctx, { filename: file })
  const html = fs.readFileSync(path.join(layoutDir, 'viewer/presentation-viewer.html'), 'utf8')
  const cut = name => {
    const head = `\n    function ${name}(slides) {\n`
    if (html.split(head).length !== 2) throw new Error(`viewer html: expected one ${name}`)
    const start = html.indexOf(head) + 1
    const end = html.indexOf('\n    }\n', start) + '\n    }\n'.length
    return html.slice(start, end)
  }
  vm.runInContext(`${cut('restoreTextBoxes')}${cut('restoreImages')}\nwindow.__restoreTextBoxes = restoreTextBoxes; window.__restoreImages = restoreImages;`, ctx, { filename: 'viewer-restore.js' })
  ctx.__reloadReady = true
}

/** Loads a stored deck the way the viewer does: restore the stored collections, then the template's own elements for every slide. */
export function renderStoredDeck(world, deck, layoutDir) {
  prepare(world, layoutDir)
  const ctx = world.context
  deck.slides.forEach((slide, index) => { const section = world.slide(index); section.setAttribute('data-slide-id', slide.slide_id); section.setAttribute('data-layout', slide.layout) })
  ctx.currentPresentationData = JSON.parse(JSON.stringify(deck))
  ctx.__deck = JSON.parse(JSON.stringify(deck))
  vm.runInContext(`__restoreTextBoxes(__deck.slides); __restoreImages(__deck.slides);
    __deck.slides.forEach((slide, index) => createElementsForTemplate(document.querySelectorAll('.reveal .slides > section')[index], index, slide.layout, slide.content, __deck, __deck.slides.length));`, ctx, { filename: 'viewer-load.js' })
}

/** What shows for one element: present, its grid box (logical, 32 x 18), z-index, and its text weight / size. */
export function elementState(world, id) {
  const node = world.document.getElementById(id)
  if (!node) return { present: false }
  const GC = world.context.GridConverter
  const content = node.querySelector('.textbox-content')
  return { present: true, row: GC.toLogical(node.style.gridRow), col: GC.toLogical(node.style.gridColumn), z: String(node.style.zIndex ?? ''),
    weight: content ? String(content.style.fontWeight ?? '') : null }
}

/** The id of a slide's layout-text box for a slot (direct-element-creator.js's own, data-slot-name). */
export function slotElementId(world, slideIndex, slot) {
  const found = world.slide(slideIndex).querySelectorAll('.inserted-textbox').find(node => node.getAttribute('data-slot-name') === slot)
  return found ? found.id : null
}

const SERVER_APPLY = String.raw`
import asyncio, io, json, os, sys, contextlib
from copy import deepcopy
layout = sys.argv[1]
sys.path.insert(0, layout)
os.chdir(layout)
os.environ["LAYOUT_CHAT_TARGETED_SAVE_ENABLED"] = "true"
os.environ["ENABLE_SUPABASE"] = "false"
jobs = json.load(open(sys.argv[2], encoding="utf-8"))
with contextlib.redirect_stdout(io.StringIO()):
    import config, server, httpx
    config.reload_settings()
class Memory:
    def __init__(self, deck): self.presentation, self.updates = deck, []
    async def load(self, pid): return deepcopy(self.presentation) if pid == self.presentation["id"] else None
    async def update(self, pid, updates, **kw):
        self.updates.append(kw.get("change_summary")); self.presentation = {**self.presentation, **deepcopy(updates)}; return self.presentation
async def main():
    out = []
    for job in jobs:
        store = Memory(job["deck"]); server.storage = store
        statuses, bodies = [], []
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://layout") as client:
            for request in job["requests"]:
                response = await client.request(request["method"], request["url"], json=request["body"])
                statuses.append(response.status_code)
                bodies.append(response.json())
        out.append({"deck": store.presentation, "statuses": statuses, "bodies": bodies, "summaries": store.updates})
    return out
with contextlib.redirect_stdout(io.StringIO()):
    result = asyncio.run(main())
sys.stdout.write("\n@@RESULT@@" + json.dumps(result))
`

/** Each job {deck, requests:[{method, url, body}]} answered by Layout's own server: the stored deck after the requests, their statuses and version summaries. */
export function applyWithLayoutServer(python, layoutDir, jobs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-edit-targeted-save-')) // the jobs go by file, not stdin (a stdin pipe to python hung intermittently on this Mac)
  const file = path.join(dir, 'jobs.json')
  fs.writeFileSync(file, JSON.stringify(jobs))
  let out
  try {
    out = execFileSync(python, ['-B', '-c', SERVER_APPLY, layoutDir, file], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, stdio: ['ignore', 'pipe', 'ignore'] })
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  return JSON.parse(out.slice(out.lastIndexOf('@@RESULT@@') + '@@RESULT@@'.length))
}
