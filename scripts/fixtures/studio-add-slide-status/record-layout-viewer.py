# PASS2B J2-04. Records what the REAL Layout Service answers to the commands the Studio sends after "Generate slide" in the Add Slide panel.
#
#   python3 record-layout-viewer.py <layout-builder checkout at uat> <out.json>
#
# Needs a Python with the layout-builder requirements and playwright (a Chromium installed). Re-record with a clean checkout of uat, then run
# record-director-frames.py on the result (the two share the deck and the slide ids).
#
# It starts the real server (server.py, filesystem storage, no Supabase, no keys), creates a three-slide deck through the real
# POST /api/presentations, opens the real viewer (viewer/presentation-viewer.html, served by that server) in headless Chromium inside a
# host page on an allowed parent origin, and sends it, one at a time and with the real postMessage envelope the frontend's sendCommand uses
# ({ action, params, requestId }), exactly the commands the page's compose code sends:
#   generate-ready:  goToSlide (the user is on slide 2) -> composePlaceholderAdd at visual index 2 -> composeGetState
#                    -> [Slide Builder inserts the real slide: the real POST /api/presentations/{id}/slides, position 2]
#                    -> composeSlideReconcile -> composeGetState -> goToSlide index 2 ("Go to slide") -> getCurrentSlideInfo
#   fail-retry-ready: composePlaceholderAdd -> composePlaceholderFail -> composeGetState -> composePlaceholderAdd with replace_job_id (the
#                    rail's retry) -> composeGetState -> real insert -> composeSlideReconcile -> composeGetState
# Every reply is kept verbatim (only requestId, which the caller mints, is dropped). Nothing leaves the machine except the viewer's own CDN
# script loads. The node test (scripts/test-studio-add-slide-status.mjs) replays these replies; it never starts a server or a browser.
import json
import os
import socket
import subprocess
import sys
import time
import threading
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

LAYOUT = Path(sys.argv[1]).resolve()
OUT = Path(sys.argv[2])


CREATED = []


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def http(method, base, path, body=None):
    req = urllib.request.Request(base + path, method=method, data=None if body is None else json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, json.loads(r.read().decode())


def sha():
    return subprocess.check_output(["git", "-C", str(LAYOUT), "rev-parse", "HEAD"], text=True).strip()


def main():
    from playwright.sync_api import sync_playwright

    api_port, host_port = free_port(), free_port()
    host_origin = f"http://127.0.0.1:{host_port}"
    base = f"http://127.0.0.1:{api_port}"
    env = dict(os.environ, STORAGE_BACKEND="filesystem", PORT=str(api_port), FRONTEND_ALLOWED_ORIGINS=host_origin, ALLOWED_ORIGINS="*")
    storage = LAYOUT / "storage"
    server = subprocess.Popen([sys.executable, "-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", str(api_port), "--log-level", "warning"],
                              cwd=LAYOUT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(120):
            try:
                urllib.request.urlopen(base + "/health", timeout=1)
                break
            except Exception:
                time.sleep(0.5)
        else:
            raise SystemExit("layout server did not start")

        out = {"_provenance": {
            "layout_builder_sha": sha(),
            "note": "Recorded by running the REAL layout-builder server and viewer (viewer/presentation-viewer.html) in headless Chromium; "
                    "replies are verbatim except the caller-minted requestId. Frontend envelope: presentation-viewer.tsx sendCommand.",
            "recorder": "scripts/fixtures/studio-add-slide-status/record-layout-viewer.py",
        }, "scenarios": {}}

        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            try:
                for name, steps in SCENARIOS.items():
                    out["scenarios"][name] = run_scenario(browser, base, host_origin, name, steps)
            finally:
                browser.close()
        OUT.write_text(json.dumps(out, indent=1) + "\n")
        print("recorded", {k: len(v["steps"]) for k, v in out["scenarios"].items()}, "->", OUT)
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except Exception:
            server.kill()
        # The server's filesystem storage lives in the checkout: remove only the decks this run created.
        for pid in CREATED:
            for folder in ("presentations", "versions"):
                for path in (storage / folder).glob(pid + "*"):
                    subprocess.run(["rm", "-rf", str(path)])


HOST_HTML = """<!doctype html><html><body><iframe id="v" src="%(src)s" style="width:1280px;height:720px;border:0"></iframe>
<script>
window.__replies = []; window.__pending = new Map();
window.addEventListener('message', e => {
  if (e.source !== document.getElementById('v').contentWindow) return;
  window.__replies.push(e.data);
  const p = window.__pending.get(e.data && e.data.requestId); if (p) { window.__pending.delete(e.data.requestId); p(e.data); }
});
window.cmd = (action, params, ms) => new Promise((resolve, reject) => {
  const requestId = 'rec-' + Math.random().toString(36).slice(2);
  const t = setTimeout(() => { window.__pending.delete(requestId); reject(new Error('timeout ' + action)); }, ms || 8000);
  window.__pending.set(requestId, d => { clearTimeout(t); resolve(d); });
  document.getElementById('v').contentWindow.postMessage({ action, params, requestId }, %(origin)s);
});
</script></body></html>"""


def deck_slides(titles):
    return [{"layout": "L25", "content": {"slide_title": t, "subtitle": "Recorded deck", "rich_content": "<div>" + t + "</div>"}} for t in titles]


def serve_host(port, html_for):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            body = html_for().encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    httpd = HTTPServer(("127.0.0.1", port), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def run_scenario(browser, base, host_origin, name, steps):
    status, created = http("POST", base, "/api/presentations", {"title": f"J2-04 {name}", "slides": deck_slides(["Opening", "Findings", "Next steps"])})
    pid = created["id"]
    CREATED.append(pid)
    viewer_url = f"{base}/p/{pid}"
    ctx = browser.new_context(viewport={"width": 1400, "height": 800})
    page = ctx.new_page()
    html = HOST_HTML % {"src": viewer_url, "origin": json.dumps(base)}
    httpd = serve_host(int(host_origin.rsplit(":", 1)[1]), lambda: html)
    page.goto(host_origin + "/host.html")
    deadline = time.time() + 90
    while True:
        try:
            r = page.evaluate("() => window.cmd('getCurrentSlideInfo', {}, 2000)")
            if r.get("success"):
                break
        except Exception:
            pass
        if time.time() > deadline:
            raise SystemExit("viewer never answered")
        time.sleep(1)
    time.sleep(1.5)
    recorded = []
    ids = {"presentation_id": pid, "real_slide_ids": []}
    for step in steps:
        if step["do"] == "command":
            fill = {"{presentation_id}": pid, "{real_slide_id}": ids["real_slide_ids"][-1] if ids["real_slide_ids"] else ""}
            params = {k: (fill.get(v, v) if isinstance(v, str) else v) for k, v in step["params"].items()}
            reply = page.evaluate("([a, p]) => window.cmd(a, p)", [step["action"], params])
            reply.pop("requestId", None)
            recorded.append({"do": "command", "action": step["action"], "params": params, "reply": reply})
            time.sleep(0.4)
        elif step["do"] == "layout_insert":
            # What Slide Builder does at the end of a compose job: add the real slide at the job's target position.
            body = {"layout": "L25", "position": step["position"], "content": {"slide_title": step["title"], "subtitle": "Built by the composer", "rich_content": "<div>" + step["title"] + "</div>"}}
            status, res = http("POST", base, f"/api/presentations/{pid}/slides", body)
            _, deck = http("GET", base, f"/api/presentations/{pid}")
            slides = deck["slides"]
            at = [i for i, s in enumerate(slides) if (s.get("slide_id") or s.get("id")) not in ids["real_slide_ids"] and s.get("content", {}).get("slide_title") == step["title"]]
            real_id = slides[at[0]].get("slide_id") or slides[at[0]].get("id")
            ids["real_slide_ids"].append(real_id)
            recorded.append({"do": "layout_insert", "request": {"method": "POST", "path": "/api/presentations/{presentation_id}/slides", "body": body},
                             "status": status, "real_slide_id": real_id, "layout_index": at[0], "slide_count": len(slides)})
    page.close()
    ctx.close()
    httpd.shutdown()
    httpd.server_close()
    return {"presentation_id": pid, "titles": ["Opening", "Findings", "Next steps"], "steps": recorded}


def cmd(action, **params):
    return {"do": "command", "action": action, "params": params}


SCENARIOS = {
    # The user is on slide 2 of 3 and presses Generate: the placeholder goes in at visual index 2, the real slide lands there.
    "generate-ready": [
        cmd("goToSlide", index=1),
        cmd("getCurrentSlideInfo"),
        cmd("composePlaceholderAdd", job_id="job-add-1", visual_index=2),
        cmd("composeGetState"),
        {"do": "layout_insert", "position": 2, "title": "Why a phased rollout"},
        cmd("composeSlideReconcile", job_id="job-add-1", real_slide_index=2, real_slide_id="{real_slide_id}", presentation_id="{presentation_id}"),
        cmd("composeGetState"),
        cmd("goToSlide", index=2),
        cmd("getCurrentSlideInfo"),
    ],
    # The build fails; the user presses "Try again" (the rail card's retry: a new job id replaces the failed placeholder); it then lands.
    "fail-retry-ready": [
        cmd("goToSlide", index=1),
        cmd("composePlaceholderAdd", job_id="job-add-2", visual_index=2),
        cmd("composePlaceholderFail", job_id="job-add-2"),
        cmd("composeGetState"),
        cmd("composePlaceholderAdd", job_id="job-add-3", visual_index=2, replace_job_id="job-add-2"),
        cmd("composeGetState"),
        {"do": "layout_insert", "position": 2, "title": "Why a phased rollout, again"},
        cmd("composeSlideReconcile", job_id="job-add-3", real_slide_index=2, real_slide_id="{real_slide_id}", presentation_id="{presentation_id}"),
        cmd("composeGetState"),
    ],
}

if __name__ == "__main__":
    main()
