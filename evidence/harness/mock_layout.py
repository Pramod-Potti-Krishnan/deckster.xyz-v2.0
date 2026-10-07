"""Local mock of the Layout Service viewer for the J2 harness (no network).

Serves a tiny stateful "viewer" page that speaks the same postMessage protocol
the Studio viewer uses (getCurrentSlideInfo, composeGetState, goToSlide,
addSlide, ...). The deck lives in a Python dict, so a reload (a new iframe URL,
as after a synchronous Slide Composer insert) keeps the slides and resets the
current slide to 1, which is how the real viewer behaves.
"""
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

PRESENTATION_ID = 'j2-harness-deck'


class Deck:
    def __init__(self, titles):
        self.lock = threading.Lock()
        self.seq = 0
        self.slides = [self._new(t) for t in titles]
        self.log = []  # (action, params) as seen by the viewer page
        self.viewer_loads = 0  # GET /p/<id> count: a remount/reload of the iframe shows up here

    def _new(self, title):
        self.seq += 1
        return {'id': f'slide_{self.seq:012x}', 'title': title}

    def insert(self, index, title):
        with self.lock:
            slide = self._new(title)
            self.slides.insert(index, slide)
            return slide, index

    def as_json(self):
        with self.lock:
            return json.dumps(self.slides)


VIEWER_HTML = r'''<!doctype html><html><head><meta charset="utf-8"><title>mock layout viewer</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#fff;font-family:Arial,sans-serif;color:#243438}
body{display:flex;flex-direction:column;justify-content:center;padding:6%}
small{color:#1f6f72;font-weight:bold;letter-spacing:2px;font-size:clamp(8px,2vw,16px)}
h1{font-size:clamp(18px,6vw,48px);margin:4% 0}
#counter{position:absolute;right:3%;bottom:4%;font-size:clamp(9px,2vw,15px);border:1px solid #cfd8d6;border-radius:6px;padding:2px 8px;background:#f4f7f6}
</style></head><body>
<small>LOCAL MOCK LAYOUT VIEWER</small><h1 id="title"></h1><div id="counter"></div>
<script>
const SLIDES = __SLIDES__;
let cur = 0;
const post = (path, body) => fetch(path, {method:'POST', body: JSON.stringify(body)}).catch(() => {});
function render() {
  document.getElementById('title').textContent = (SLIDES[cur] || {}).title || '';
  document.getElementById('counter').textContent = (cur + 1) + ' / ' + SLIDES.length;
}
function order() {
  return {
    real_slide_count: SLIDES.length, visual_section_count: SLIDES.length, total_visual_sections: SLIDES.length,
    placeholders: [], current_placeholder_job_id: null, current_visual_index: cur,
    slides: SLIDES.map((s, i) => ({visual_index: i, layout_index: i, slide_id: s.id})),
  };
}
const handlers = {
  getCurrentSlideInfo: () => ({success: true, data: {index: cur, total: SLIDES.length, layoutId: 'C1'}}),
  composeGetState: () => ({success: true, ...order()}),
  goToSlide: p => { cur = Math.max(0, Math.min(SLIDES.length - 1, p.index)); render(); return {success: true, data: {index: cur}}; },
  isEditModeActive: () => ({success: true, isEditing: false}),
  enterEditMode: () => ({success: true, isEditing: true}),
  toggleEditMode: () => ({success: true, isEditing: true}),
  toggleBorderHighlight: () => ({success: true}),
  getElementMutationReceipt: () => ({success: false, status: 'unknown'}),
  addSlide: async p => {
    const index = Math.max(0, Math.min(SLIDES.length, p.position));
    const res = await fetch('/__insert', {method: 'POST', body: JSON.stringify({index, title: 'New slide (' + (p.layout || 'C1') + ')'})}).then(r => r.json());
    SLIDES.splice(index, 0, res.slide);
    cur = index; render();
    return {success: true, slide_index: index, slide_count: SLIDES.length, slide_id: res.slide.id};
  },
};
window.addEventListener('message', async e => {
  if (e.source !== parent) return;
  const d = e.data;
  if (!d || typeof d.action !== 'string') return;
  post('/__log', {action: d.action, params: d.params || null});
  const h = handlers[d.action];
  let out;
  try { out = h ? await h(d.params || {}) : {success: false, error: 'mock: unsupported ' + d.action}; }
  catch (err) { out = {success: false, error: String(err)}; }
  parent.postMessage({action: d.action, requestId: d.requestId, ...out}, e.origin);
});
render();
</script></body></html>'''


def make_handler(deck):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):  # silence
            pass

        def _send(self, code, body, ctype='application/json'):
            raw = body.encode() if isinstance(body, str) else body
            self.send_response(code)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(raw)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(raw)

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Headers', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
            self.end_headers()

        def do_GET(self):
            path = urlparse(self.path).path
            if path.startswith('/p/'):
                deck.viewer_loads += 1
                return self._send(200, VIEWER_HTML.replace('__SLIDES__', deck.as_json()), 'text/html')
            if path.endswith('/theme/css-variables'):
                return self._send(200, json.dumps({'css_variables': {'--theme-text': '#243438', '--theme-background': '#ffffff'}}))
            if path.startswith('/api/presentations/'):
                with deck.lock:
                    slides = [{'id': s['id'], 'slide_id': s['id'], 'layout': 'C1', 'title': s['title'], 'script': '', 'speaker_notes': '', 'references': []} for s in deck.slides]
                return self._send(200, json.dumps({'id': PRESENTATION_ID, 'title': 'J2 harness deck', 'updated_at': '2026-10-07T04:00:00Z', 'slides': slides}))
            return self._send(404, '{}')

        def do_POST(self):
            path = urlparse(self.path).path
            length = int(self.headers.get('Content-Length') or 0)
            body = json.loads(self.rfile.read(length) or b'{}')
            if path == '/__insert':
                slide, index = deck.insert(body['index'], body['title'])
                return self._send(200, json.dumps({'slide': slide, 'index': index}))
            if path == '/__log':
                deck.log.append((body.get('action'), body.get('params')))
                return self._send(200, '{}')
            return self._send(404, '{}')

    return Handler


def start(port, titles):
    deck = Deck(titles)
    server = ThreadingHTTPServer(('127.0.0.1', port), make_handler(deck))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return deck, server
