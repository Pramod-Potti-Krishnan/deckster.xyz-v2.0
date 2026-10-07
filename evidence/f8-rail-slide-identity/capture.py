#!/usr/bin/env python3
"""Captures the F8 rail evidence PNGs (1600x900) from the page built by build-render.mjs.
Usage: capture.py <render-build dir> <out dir>
No network: the page is served from 127.0.0.1, window.fetch is stubbed by the fixture, and the
synthetic preview images are fulfilled by Playwright's route (https://proj.supabase.co/**)."""
import json, re, subprocess, sys, time, os
from playwright.sync_api import sync_playwright

build, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
PORT = 8881
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', build],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print('server pid', server.pid)
LABELS = {  # slide_id -> (letter, colour, caption)
    'slide_8ea0a04600cf': ('A', '#2b5fa8', 'opening slide'),
    'slide_51f6389579d6': ('B', '#1f7a6d', 'market slide'),
    'slide_06137799b27f': ('N', '#c2641b', 'NEW inserted slide'),
    'slide_d960ba5dbd63': ('C', '#7a3fa0', 'wrap-up slide'),
}

def preview(route):
    m = re.search(r'/(slide_[0-9a-f]+)/', route.request.url)
    letter, colour, caption = LABELS.get(m.group(1) if m else '', ('?', '#555', 'unknown'))
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="{colour}"/>'
           f'<text x="160" y="105" font-family="Arial" font-size="84" font-weight="700" fill="#fff" text-anchor="middle">{letter}</text>'
           f'<text x="160" y="150" font-family="Arial" font-size="15" fill="#fff" text-anchor="middle" opacity=".85">{caption} (synthetic)</text></svg>')
    route.fulfill(status=200, content_type='image/svg+xml', body=svg)

STATE_JS = """() => [...document.querySelectorAll('[data-studio-thumbnail-card]')].map(card => ({
  number: card.querySelector('[data-studio-thumbnail-caption] > button > span:first-child')?.textContent,
  title: card.querySelector('[data-studio-thumbnail-caption] > button > span:nth-child(2)')?.textContent,
  hasPreview: card.querySelector('[data-studio-thumbnail-preview]')?.getAttribute('data-has-preview'),
  image: card.querySelector('img')?.getAttribute('src')?.split('/').slice(-2).join('/') ?? null,
  placeholder: card.querySelector('.studio-thumbnail-placeholder-label')?.textContent ?? null,
}))"""

states = {}
with sync_playwright() as p:
    browser = p.chromium.launch()
    try:
        def open_page(query):
            ctx = browser.new_context(viewport={'width': 1600, 'height': 900})
            page = ctx.new_page()
            page.route('https://proj.supabase.co/**', preview)
            page.on('pageerror', lambda e: print('PAGE ERROR', e))
            page.goto(f'http://127.0.0.1:{PORT}/index.html?{query}')
            page.wait_for_selector('[data-studio-thumbnail-card]')
            return ctx, page

        def settle(page, cards):
            page.wait_for_function(f"document.querySelectorAll('[data-studio-thumbnail-card]').length === {cards}")
            page.wait_for_timeout(700)  # debounce (150 ms) + fetch + image load
            page.wait_for_function("[...document.images].every(i => i.complete)")

        def shoot(page, name, caption, note):
            page.evaluate("([c, n]) => { document.getElementById('caption').textContent = c; document.getElementById('note').textContent = n }", [caption, note])
            path = os.path.join(out, f'{name}-1600x900.png')
            page.screenshot(path=path)
            states[name] = page.evaluate(STATE_JS)
            print('wrote', path)

        BEFORE_NOTE = ("Fixture render. REAL: SlideThumbnailStrip, use-stage-f-thumbnail-cache (structural-ack fence), the viewer's slideThumbnails logic extracted from "
                       "base 6d47cae. SUBSTITUTED: viewer/iframe/Director replayed by a driver; synthetic preview images.")
        AFTER_NOTE = ("Fixture render. REAL: SlideThumbnailStrip, use-slide-rail-identity + lib/slide-rail-identity. SUBSTITUTED: viewer/iframe/Director replayed by a driver; "
                      "Layout inventory GET served from the contract fixtures (F8-fixtures); synthetic preview images.")

        # ---- BEFORE: flag off = today's rail
        ctx, page = open_page('mode=before'); settle(page, 3)
        shoot(page, 'before-1-built', 'BEFORE (flag off) 1/3: deck built, 3 slides with titles and previews', BEFORE_NOTE)
        page.evaluate("() => { __f8.stage = 1; __f8.ack(); __f8.set() }"); settle(page, 4)
        shoot(page, 'before-2-after-insert', 'BEFORE (flag off) 2/3: after inserting a slide at position 3 (J2-F3: every thumbnail is "No preview / Slide N")', BEFORE_NOTE)
        page.evaluate("() => __f8.remount()"); settle(page, 4)
        shoot(page, 'before-3-after-reload', 'BEFORE (flag off) 3/3: after reload (still "No preview / Slide N")', BEFORE_NOTE)
        ctx.close()

        # ---- AFTER: flag on, inventory served (backend flags on)
        ctx, page = open_page('mode=after'); settle(page, 3)
        shoot(page, 'after-1-built', 'AFTER (flag on) 1/4: deck built, 3 slides; rail read from the slide inventory', AFTER_NOTE)
        page.evaluate("() => { __f8.stage = 1; __f8.ack(); __f8.set(); __f8.refresh() }"); settle(page, 4)
        shoot(page, 'after-2-after-insert', 'AFTER (flag on) 2/4: after inserting a slide at position 3: titles and previews stay; the new slide has its own id', AFTER_NOTE)
        page.evaluate("() => __f8.remount()"); settle(page, 4)
        shoot(page, 'after-3-after-reload', 'AFTER (flag on) 3/4: after reload: previews from the inventory, titles remembered by slide_id', AFTER_NOTE)
        page.evaluate("() => { __f8.stage = 2; __f8.refresh(); __f8.set() }"); settle(page, 4)
        shoot(page, 'after-4-after-reorder', 'AFTER (flag on) 4/4: after moving the new slide to the end: each slide keeps its title and preview (keyed by slide_id)', AFTER_NOTE)
        ctx.close()

        # ---- AFTER, backend flag off: the inventory route answers 405, the rail is today's
        ctx, page = open_page('mode=after&absent=1'); settle(page, 3)
        page.evaluate("() => { __f8.stage = 1; __f8.ack(); __f8.set(); __f8.refresh() }"); settle(page, 4)
        shoot(page, 'after-5-endpoint-absent-fallback', 'AFTER (frontend flag on, Layout inventory route absent: 405) : falls back to today\'s rail, nothing breaks', AFTER_NOTE)
        ctx.close()
    finally:
        browser.close()
        server.terminate(); server.wait(timeout=10)
with open(os.path.join(out, 'rail-state.json'), 'w') as fh:
    json.dump(states, fh, indent=1)
print('done')
