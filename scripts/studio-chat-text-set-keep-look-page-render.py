#!/usr/bin/env python3
"""FRONTEND-2 (B49b, 29 Oct): the REAL viewer page half of scripts/test-studio-chat-text-set-keep-look.mjs (NEXT_PUBLIC_STUDIO_CHAT_TEXT_SET_KEEP_LOOK), live mode only.

Adapted from B48's render550.py (workspace streams/frontend/pass3/chat-add-stacking-550): Layout's REAL server.py is served on 127.0.0.1 from a COPY of a layout-builder checkout (the copy is made here, so the checkout is only read),
with the filesystem store and Layout's UAT flags (tools/render/uat_flags_2026-10-04.json); each deck is seeded by POST /api/presentations; the viewer page /p/<id> is rendered in headless Chromium at 1600x900. Loopback only:
every jsDelivr / tailwind request is answered locally (reveal.js from --reveal-dir, the chart libraries and plugins are empty stubs), the Google Fonts ones are aborted (so the text is Arial/Helvetica; sizes and weights are unaffected).
It measures what the page draws for one text box (the computed size / weight / colour of the first text in its .textbox-content, and its line count) and saves a PNG per variant.

Usage: <python with playwright> studio-chat-text-set-keep-look-page-render.py <spec.json>
spec: {layoutDir, layoutPython, revealDir, pngDir, uatFlags, viewport: {width, height}, variants: [{name, deck, elementId, png}]}
Prints "@@RESULT@@" and a JSON object {name: {presentationId, storedContent, tcClass, boxFontSize, boxFontWeight, leafTag, fontSize, fontWeight, color, lines, text}} (storedContent: the box's content in Layout's store).
"""
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

MEASURE_JS = r"""
(id) => {
  const el = document.getElementById(id);
  if (!el) return null;
  const box = el.querySelector('.textbox-content');
  const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, { acceptNode: node => (node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const first = walker.nextNode();
  const leaf = first ? first.parentElement : box;
  const leafStyle = getComputedStyle(leaf), boxStyle = getComputedStyle(box);
  return {
    tcClass: box.className, boxFontSize: boxStyle.fontSize, boxFontWeight: boxStyle.fontWeight,
    leafTag: leaf === box ? 'div' : leaf.tagName.toLowerCase(), fontSize: leafStyle.fontSize, fontWeight: leafStyle.fontWeight, color: leafStyle.color,
    lines: box.innerText.split('\n').filter(line => line.trim() !== '').length, text: box.innerText.trim(),
  };
}
"""


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def uat_flags(path):
    """The Layout flags set on UAT in the newest snapshot on this Mac: the ones with a raw value present and true."""
    if not path or not Path(path).is_file():
        return {}
    flags = json.loads(Path(path).read_text())["services"]["layout"]["flags"]
    raw = {key[: -len("_RAW_PRESENT")] for key, value in flags.items() if key.endswith("_RAW_PRESENT") and value is True}
    return {key: "true" for key, value in flags.items() if key in raw and value is True}


class Server:
    def __init__(self, layout_dir, layout_python, storage, flags_file):
        self.port = free_port()
        self.base = "http://127.0.0.1:%d" % self.port
        env = {k: v for k, v in os.environ.items() if not k.endswith(("_KEY", "_TOKEN", "_SECRET", "_PASSWORD")) and not k.startswith(("SUPABASE", "GOOGLE", "OPENAI", "ANTHROPIC"))}
        env.update(uat_flags(flags_file))
        env.update({"ENABLE_SUPABASE": "false", "REQUIRE_DURABLE_STORAGE": "false", "STORAGE_DIR": str(storage), "PORT": str(self.port), "PYTHONDONTWRITEBYTECODE": "1"})
        code = "import sys; sys.path.insert(0, %r); import uvicorn, server; uvicorn.run(server.app, host='127.0.0.1', port=%d, log_level='warning')" % (str(layout_dir), self.port)
        self.log = open(os.path.join(str(storage), "server.log"), "wb")
        self.proc = subprocess.Popen([str(layout_python), "-B", "-c", code], cwd=str(layout_dir), env=env, stdout=self.log, stderr=self.log, stdin=subprocess.DEVNULL)
        for _ in range(300):
            try:
                if urllib.request.urlopen(self.base + "/health", timeout=1).status == 200:
                    return
            except Exception:
                time.sleep(0.2)
        self.stop()
        raise RuntimeError("Layout server did not become healthy")

    def post(self, payload):
        req = urllib.request.Request(self.base + "/api/presentations", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}, method="POST")
        return json.load(urllib.request.urlopen(req, timeout=30))["id"]

    def get(self, path):
        return json.load(urllib.request.urlopen(self.base + path, timeout=30))

    def stop(self):
        self.proc.terminate()
        try:
            self.proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        self.log.close()


def route_assets(page, reveal_dir):
    reveal = Path(reveal_dir)
    files = {"reveal.js": ("reveal.js", "application/javascript"), "reveal.css": ("reveal.css", "text/css"), "white.css": ("white.css", "text/css")}

    def jsdelivr(route):
        url = route.request.url
        rel = url.split("cdn.jsdelivr.net/npm/", 1)[1].split("?")[0]
        name = rel.rsplit("/", 1)[-1]
        if rel.startswith("reveal.js@") and name in files and (reveal / files[name][0]).is_file():
            route.fulfill(status=200, body=(reveal / files[name][0]).read_bytes(), content_type=files[name][1])
        elif rel.startswith("reveal.js-plugins@"):
            route.fulfill(status=200, body=b"window.RevealChart = { id: 'RevealChart', init: function () {} };", content_type="application/javascript")
        elif rel.startswith("chart.js@"):
            route.fulfill(status=200, body=b"window.Chart = function () {}; Chart.register = function () {}; Chart.getChart = function () { return null; }; Chart.instances = {}; Chart.defaults = {};", content_type="application/javascript")
        elif rel.startswith("chartjs-plugin-datalabels@"):
            route.fulfill(status=200, body=b"window.ChartDataLabels = { id: 'datalabels' };", content_type="application/javascript")
        else:  # a library the decks here do not use: an empty script or sheet, no network
            route.fulfill(status=200, body=b"", content_type="text/css" if rel.endswith(".css") else "application/javascript")

    page.route("https://cdn.jsdelivr.net/**", jsdelivr)
    page.route("https://cdn.tailwindcss.com/**", lambda r: r.fulfill(status=200, body=b"", content_type="application/javascript"))
    page.route("https://fonts.googleapis.com/**", lambda r: r.abort())
    page.route("https://fonts.gstatic.com/**", lambda r: r.abort())


def main(spec_path):
    from playwright.sync_api import sync_playwright

    spec = json.load(open(spec_path, encoding="utf-8"))
    viewport = spec.get("viewport") or {"width": 1600, "height": 900}
    work = Path(tempfile.mkdtemp(prefix="tskl-page-"))
    results = {}
    server = None
    try:
        layout_copy = work / "layout"
        shutil.copytree(spec["layoutDir"], layout_copy, ignore=shutil.ignore_patterns(".git", "__pycache__", "node_modules", "*.pyc"))
        storage = work / "store"
        storage.mkdir()
        server = Server(layout_copy, spec["layoutPython"], storage, spec.get("uatFlags"))
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            for variant in spec["variants"]:
                presentation_id = server.post(variant["deck"])
                stored = server.get("/api/presentations/%s" % presentation_id)
                stored_content = None
                for slide in stored["slides"]:
                    for box in slide.get("text_boxes", []):
                        if box["id"] == variant["elementId"]:
                            stored_content = box["content"]
                context = browser.new_context(viewport=viewport, device_scale_factor=1)
                page = context.new_page()
                route_assets(page, spec["revealDir"])
                external = []
                page.on("request", lambda req: external.append(req.url) if not req.url.startswith(("http://127.0.0.1", "data:", "blob:")) else None)
                page.goto("%s/p/%s" % (server.base, presentation_id), wait_until="load")
                page.wait_for_function("(id) => !!document.getElementById(id)", arg=variant["elementId"], timeout=20000)
                page.add_style_tag(content=".reveal .controls, .reveal .slide-number, .reveal .progress { display: none !important; }")
                page.wait_for_timeout(1500)
                measured = page.evaluate(MEASURE_JS, variant["elementId"])
                if measured is None:
                    raise RuntimeError("the element %s is not on the page" % variant["elementId"])
                if spec.get("pngDir") and variant.get("png"):
                    os.makedirs(spec["pngDir"], exist_ok=True)
                    page.screenshot(path=os.path.join(spec["pngDir"], variant["png"] + ".png"))
                results[variant["name"]] = dict(measured, presentationId=presentation_id, storedContent=stored_content, externalRequests=sorted(set(external)))
                context.close()
            browser.close()
    finally:
        if server is not None:
            server.stop()
        shutil.rmtree(work, ignore_errors=True)
    sys.stdout.write("\n@@RESULT@@" + json.dumps(results))


if __name__ == "__main__":
    main(sys.argv[1])
