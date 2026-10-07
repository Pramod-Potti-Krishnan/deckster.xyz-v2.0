"""J2 harness: drive the real Studio builder against a mock Layout viewer (no network).

  python3 evidence/harness/capture.py <scenario> --app http://127.0.0.1:8793 \
      --runtime <runtimeDir> --out <dir> --label base

Scenarios: count (add a slide, sample header vs footer), panel (open the Slide
panel, measure the canvas), generate (type a prompt, measure the Generate button,
run a synchronous compose against a mocked /api/slides/compose, see where the
viewer lands). Every product host other than the app and the local mock Layout
is aborted and recorded; the Director WebSocket is faked. No credentials.

Session reads get a small artificial latency: in `next dev`, React StrictMode
remounts the builder once, and a session restore that resolves instantly would
run with the pre-remount closure and be dropped (a dev-only artefact).
"""
import argparse
import asyncio
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright, expect

sys.path.insert(0, str(Path(__file__).parent))
import mock_layout  # noqa: E402

LAYOUT_PORT = 8895
LAYOUT = f'http://127.0.0.1:{LAYOUT_PORT}'
SESSION = '11111111-1111-4111-8111-111111111111'
NOW = '2026-10-07T04:00:00Z'
USER = {'id': 'j2-harness-local', 'name': 'J2 Harness', 'email': 'j2@example.invalid', 'tier': 'free', 'approved': True, 'walletBalanceCents': 0, 'subscription': None}
TITLES = ['Demand forecasting', 'Data quality risks', 'Signal sources', 'Model selection', 'Rollout plan', 'Governance', 'Next steps']
FOOTER = re.compile(r'^Slide \d+ / \d+$')


def slide_structure(deck):
    return [{'slide_id': s['id'], 'slide_number': i + 1, 'slide_type': 'content', 'title': s['title'], 'narrative': 'Mock metadata', 'key_points': [],
             'analytics_needed': None, 'visuals_needed': None, 'diagrams_needed': None, 'structure_preference': None} for i, s in enumerate(deck.slides)]


class Harness:
    def __init__(self, args):
        self.args = args
        self.deck, self.server = mock_layout.start(LAYOUT_PORT, TITLES)
        self.violations = []
        self.api_seen = []
        self.compose_calls = []
        self.compose_with_identity = not args.no_real_slide_id

    def viewer_url(self):
        return f'{LAYOUT}/p/{mock_layout.PRESENTATION_ID}'

    def session(self):
        url = self.viewer_url()
        return {'id': SESSION, 'userId': USER['id'], 'title': 'J2 harness deck', 'createdAt': NOW, 'updatedAt': NOW, 'currentStage': 6,
                'slideCount': len(self.deck.slides), 'status': 'active', 'messages': [], 'finalPresentationUrl': url,
                'finalPresentationId': mock_layout.PRESENTATION_ID,
                'stateCache': {'activeVersion': 'final', 'slideStructure': {'metadata': {'main_title': 'J2 harness deck', 'overall_theme': 'Minimal', 'target_audience': 'Review', 'presentation_duration': 5}, 'slides': slide_structure(self.deck)}}}

    async def api(self, route):
        req = route.request
        path = urlparse(req.url).path
        self.api_seen.append(f'{req.method} {path}')
        if path == '/api/slides/compose' and req.method == 'POST':
            body = req.post_data_json
            self.compose_calls.append(body)
            await asyncio.sleep(self.args.compose_delay)
            after = body.get('insert_after_index')
            index = (after if after is not None else len(self.deck.slides) - 1) + 1
            slide, index = self.deck.insert(index, 'Generated: ' + (body.get('instruction') or 'slide')[:40])
            built = {'status': 'built', 'presentation_id': mock_layout.PRESENTATION_ID, 'presentation_url': self.viewer_url(),
                     'slide_index': index, 'inserted_at_index': index, 'insert_after_index': after, 'kind': 'compose', 'slides_built': 1,
                     'slide_title': slide['title']}
            if self.compose_with_identity:
                built['real_slide_id'] = slide['id']
            return await route.fulfill(json=built)
        if req.method != 'GET':
            self.violations.append(f'refused {req.method} {path}')
            return await route.fulfill(status=405, json={'error': 'harness is read-only'})
        if path == f'/api/sessions/{SESSION}':
            await asyncio.sleep(0.6)
        s = self.session()
        data = {
            '/api/auth/session': {'user': USER, 'expires': '2099-01-01T00:00:00Z'},
            '/api/director/ws-token': {'auth_enabled': False, 'auth_token': None},
            f'/api/publish/by-session/{SESSION}': {'deck': None},
            '/api/subscription': {'subscription': None},
            '/api/usage/quota': {'tier': 'free', 'tierLabel': 'Free', 'caps': {'dailyCents': 20, 'weeklyCents': 50, 'monthlyCents': 100}, 'spent': {'dailyCents': 0, 'weeklyCents': 0, 'monthlyCents': 0}, 'remainingPct': {'daily': 1, 'weekly': 1, 'monthly': 1}, 'flags': {'dailyNear': False, 'dailyAt': False, 'weeklyNear': False, 'weeklyAt': False}, 'resetAt': {'daily': NOW, 'weekly': NOW}, 'walletBalanceCents': 0, 'totals': {'monthTokens': 0, 'monthSpendCents': 0}},
            '/api/sessions': {'sessions': [s], 'pagination': {'total': 1, 'limit': 20, 'offset': 0, 'hasMore': False}},
            f'/api/sessions/{SESSION}': {'session': s},
            f'/api/sessions/{SESSION}/files': {'files': []},
            f'/api/sessions/{SESSION}/messages': {'messages': []},
            '/api/themes/standard': {'theme': None},
            '/api/themes': {'themes': [], 'count': 0},
            '/api/templates': {'templates': []},
        }
        if path in data:
            return await route.fulfill(json=data[path])
        self.violations.append(f'unmocked GET {path}')
        return await route.fulfill(status=404, json={})

    async def run(self, scenario):
        args = self.args
        out = Path(args.out)
        out.mkdir(parents=True, exist_ok=True)
        app_origin = urlparse(args.app).netloc
        cookie = json.loads((Path(args.runtime) / 'cookie.json').read_text())
        async with async_playwright() as pw:
            browser = await pw.chromium.launch()
            ctx = await browser.new_context(viewport={'width': args.width, 'height': args.height}, service_workers='block')
            await ctx.add_cookies([cookie])
            await ctx.add_init_script("localStorage.setItem('theme','light');" + ("localStorage.setItem('deckster:debug','true');" if args.verbose else '') + ("localStorage.setItem('deckster.slideComposerTrace','true');" if args.trace else ''))

            async def handler(route):
                u = urlparse(route.request.url)
                if u.netloc == app_origin:
                    return await (self.api(route) if u.path.startswith('/api/') else route.continue_())
                if u.netloc == f'127.0.0.1:{LAYOUT_PORT}':
                    return await route.continue_()
                self.violations.append(f'blocked {route.request.method} {route.request.url}')
                return await route.abort()

            await ctx.route('**/*', handler)

            async def ws(ws_route):
                if 'webpack-hmr' in ws_route.url:
                    ws_route.connect_to_server()
                    return
                ws_route.on_message(lambda m: ws_route.send('pong') if m == 'ping' else None)

            await ctx.route_web_socket('**/*', ws)
            page = await ctx.new_page()
            errors, consoles = [], []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('console', lambda m: consoles.append(f'{m.type}: {m.text}') if (args.verbose or args.trace or m.type in ('warning', 'error')) else None)
            result = {'scenario': scenario, 'label': args.label, 'app': args.app, 'viewport': [args.width, args.height]}
            try:
                await page.goto(f'{args.app}/builder?session_id={SESSION}', wait_until='domcontentloaded', timeout=180000)
                await page.add_style_tag(content='nextjs-portal{display:none!important}')
                await expect(page.get_by_title('Presentation Viewer', exact=True)).to_be_visible(timeout=60000)
                await expect(page.get_by_title('Present fullscreen', exact=True)).to_be_enabled(timeout=60000)
                await page.wait_for_timeout(1500)
                await globals()[f'scenario_{scenario}'](self, page, out, result)
            finally:
                result['violations'] = self.violations
                result['page_errors'] = errors
                result['console'] = consoles[-200:] if args.verbose else consoles[-30:]
                result['mock_log'] = self.deck.log[-80:]
                (out / f'{scenario}-{args.label}.json').write_text(json.dumps(result, indent=2) + '\n')
                await browser.close()
        return result


async def fingerprint(page):
    """Hash of the builder workspace DOM with generated ids normalised (flag-off identity proof)."""
    html = await page.evaluate("""() => {
      const root = document.querySelector('[data-studio-v4-shell-workspace]');
      return root ? root.outerHTML : '';
    }""")
    import hashlib
    html = re.sub(r':r[0-9a-z]+:', ':rX:', html)
    html = re.sub(r'radix-[:\w-]+', 'radix-X', html)
    html = re.sub(r'sc_refresh=\d+', 'sc_refresh=N', html)
    return {'sha256_16': hashlib.sha256(html.encode()).hexdigest()[:16], 'bytes': len(html)}


async def read_counts(page):
    """Footer ("Slide x / y") and rail heading read in ONE evaluate, so the pair is a single instant."""
    return await page.evaluate("""() => {
      const footer = [...document.querySelectorAll('span')].find(e => /^Slide \\d+ \\/ \\d+$/.test((e.textContent || '').trim()));
      const rail = document.querySelector('.studio-thumbnail-heading span');
      return {footer: footer ? footer.textContent.trim() : null, rail: rail ? rail.textContent.trim() : null};
    }""")


async def scenario_count(h, page, out, result):
    args = h.args
    await page.screenshot(path=str(out / f'count-{args.label}-0-before.png'))
    result['before'] = await read_counts(page)
    result['dom_before'] = await fingerprint(page)
    await page.get_by_role('button', name='Add Slide', exact=True).first.click()
    await page.get_by_role('button', name=re.compile(r'^Insert .* slide$')).first.click()
    t0 = time.time()
    samples, shot = [], False
    while time.time() - t0 < 8:
        c = await read_counts(page)
        c['t'] = round(time.time() - t0, 2)
        samples.append(c)
        if not shot and c['rail'] and c['rail'] != result['before']['rail']:
            await page.screenshot(path=str(out / f'count-{args.label}-1-just-after-insert.png'))
            shot = True
        await page.wait_for_timeout(150)
    result['samples'] = samples
    total = lambda s: s['footer'].split('/')[-1].strip() if s['footer'] else None
    mism = [s for s in samples if s['footer'] and s['rail'] and total(s) != s['rail']]
    result['mismatch_samples'] = len(mism)
    result['first_mismatch'] = mism[0] if mism else None
    result['last_mismatch_t'] = mism[-1]['t'] if mism else None
    result['final'] = samples[-1]
    await page.screenshot(path=str(out / f'count-{args.label}-2-settled.png'))


async def open_slide_panel(page):
    await page.get_by_role('button', name='Add Slide', exact=True).first.click()
    await page.get_by_role('button', name='Generate', exact=True).first.click()
    await expect(page.locator('[data-studio-v4-panel="slide-generation"]')).to_be_visible()
    await page.wait_for_timeout(900)


async def canvas_metrics(page):
    return await page.evaluate('''() => {
      const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return {x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height)} };
      const vis = e => { if (!e) return null; const s = getComputedStyle(e); return {visibility: s.visibility, display: s.display, opacity: s.opacity} };
      const f = document.querySelector('iframe[title="Presentation Viewer"]');
      const space = document.querySelector('[data-studio-slide-space]');
      const pres = document.querySelector('[data-studio-v4-shell-presentation]');
      const work = document.querySelector('[data-studio-v4-shell-workspace]');
      return {viewport: [innerWidth, innerHeight], workspaceMode: work && work.dataset.studioWorkspaceMode, overlay: work && work.dataset.studioWorkspaceOverlay,
        iframe: r(f), iframeStyle: vis(f), slideSpace: r(space), presentation: r(pres), presentationCovered: (pres && pres.dataset.studioCanvasCovered) || null,
        presentationVis: vis(pres), iframeInDom: !!f};
    }''')


async def prime_edit(page, result):
    # A manual Add leaves the viewer in edit mode (as in the J2 run, steps 2.1-2.5).
    await page.get_by_role('button', name='Add Slide', exact=True).first.click()
    await page.get_by_role('button', name=re.compile(r'^Insert .* slide$')).first.click()
    await page.wait_for_timeout(4500)
    result['after_prime'] = await read_counts(page)


async def scenario_panel(h, page, out, result):
    args = h.args
    if args.prime_edit:
        await prime_edit(page, result)
    result['closed'] = await canvas_metrics(page)
    await page.screenshot(path=str(out / f'panel-{args.label}-0-closed.png'))
    await page.evaluate("window.__iframeBefore = document.querySelector('iframe[title=\"Presentation Viewer\"]')")
    loads_before = h.deck.viewer_loads
    # Sample the viewer iframe's size every animation frame while the panel opens: each distinct
    # size is one more layout pass inside the (cross-origin) Layout viewer.
    await page.evaluate('''() => { window.__sizes = []; const t0 = performance.now();
      const tick = () => { const f = document.querySelector('iframe[title="Presentation Viewer"]');
        if (f) { const r = f.getBoundingClientRect(); window.__sizes.push(Math.round(r.width) + 'x' + Math.round(r.height)); }
        if (performance.now() - t0 < 2200) requestAnimationFrame(tick); };
      requestAnimationFrame(tick); }''')
    await open_slide_panel(page)
    await page.wait_for_timeout(900)
    sizes = await page.evaluate('window.__sizes')
    result['iframe_sizes_during_open'] = {'frames': len(sizes), 'distinct': len(set(sizes)), 'first': sizes[0], 'last': sizes[-1]}
    result['iframe_same_element_after_open'] = await page.evaluate("window.__iframeBefore === document.querySelector('iframe[title=\"Presentation Viewer\"]')")
    result['viewer_page_loads_during_open'] = h.deck.viewer_loads - loads_before
    result['open'] = await canvas_metrics(page)
    result['dom_open'] = await fingerprint(page)
    await page.screenshot(path=str(out / f'panel-{args.label}-1-panel-open.png'))
    fr = page.frame_locator('iframe[title="Presentation Viewer"]')
    result['viewer_title_visible'] = await fr.locator('#title').is_visible()
    result['viewer_title_text'] = await fr.locator('#title').inner_text()


async def go_to_slide(page, n):
    await page.locator(f'[data-studio-thumbnail-navigation][aria-label^="Go to slide {n}"]').first.click()
    await page.wait_for_timeout(800)


async def scenario_generate(h, page, out, result):
    args = h.args
    if args.prime_edit:
        await prime_edit(page, result)
    if args.anchor > 1:
        await go_to_slide(page, args.anchor)
    result['anchor'] = args.anchor
    await open_slide_panel(page)
    panel = page.locator('[data-studio-v4-panel="slide-generation"]')
    box = panel.get_by_label('Generation prompt')
    submit = panel.get_by_role('button', name='Generate (⌘↵)')
    result['submit_rect_empty'] = await submit.bounding_box()
    result['dom_empty'] = await fingerprint(page)
    await page.screenshot(path=str(out / f'generate-{args.label}-0-empty.png'))
    await box.click()
    text = 'Summarise the three biggest risks to forecast accuracy. One line each, no more than eight words per line. ' * 3
    steps, typed = [], 0
    for upto in (1, 12, 40, 90, len(text)):
        await box.type(text[typed:upto], delay=1)
        typed = upto
        await page.wait_for_timeout(120)
        rect = await submit.bounding_box()
        taller = await box.bounding_box()
        steps.append({'chars': upto, 'submit_y': rect['y'], 'textarea_h': taller['height']})
        if upto == 12:
            await page.screenshot(path=str(out / f'generate-{args.label}-0b-short.png'))
    result['submit_steps'] = steps
    result['submit_rect_typed'] = await submit.bounding_box()
    ys = [result['submit_rect_empty']['y']] + [s['submit_y'] for s in steps]
    result['submit_moved_px'] = round(result['submit_rect_typed']['y'] - result['submit_rect_empty']['y'], 1)
    result['submit_y_range_px'] = round(max(ys) - min(ys), 1)
    await page.screenshot(path=str(out / f'generate-{args.label}-1-typed.png'))
    result['before_generate'] = {'footer': (await read_counts(page))['footer'], 'mock_slides': len(h.deck.slides)}
    await submit.click()
    t0 = time.time()
    trail = []
    fr = page.frame_locator('iframe[title="Presentation Viewer"]')
    while time.time() - t0 < args.watch:
        c = await read_counts(page)
        try:
            title = await fr.locator('#title').inner_text(timeout=300)
            counter = await fr.locator('#counter').inner_text(timeout=300)
        except Exception:
            title = counter = None
        trail.append({'t': round(time.time() - t0, 1), 'footer': c['footer'], 'rail': c['rail'], 'iframe_slide': title, 'iframe_counter': counter})
        await page.wait_for_timeout(500)
    result['trail'] = trail
    result['compose_calls'] = h.compose_calls
    result['final'] = trail[-1]
    result['new_slide_index'] = next((i for i, s in enumerate(h.deck.slides) if s['title'].startswith('Generated:')), None)
    await page.screenshot(path=str(out / f'generate-{args.label}-2-after.png'))


async def scenario_debug(h, page, out, result):
    await page.wait_for_timeout(1000)
    # The Slide panel's prompt textarea is mounted (closed) from page load: what height did the auto-grow effect give it?
    result['closed_panel_textarea'] = await page.evaluate('''() => {
      const t = document.querySelector('[data-studio-v4-panel="slide-generation"] textarea');
      return t ? {inlineHeight: t.style.height, clientWidth: t.clientWidth, scrollHeight: t.scrollHeight} : null;
    }''')
    await page.screenshot(path=str(out / 'debug.png'))
    result['url'] = page.url


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('scenario', choices=['count', 'panel', 'generate', 'debug'])
    ap.add_argument('--app', required=True)
    ap.add_argument('--runtime', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--label', required=True)
    ap.add_argument('--width', type=int, default=1600)
    ap.add_argument('--height', type=int, default=900)
    ap.add_argument('--compose-delay', type=float, default=1.5)
    ap.add_argument('--watch', type=float, default=14)
    ap.add_argument('--no-real-slide-id', action='store_true')
    ap.add_argument('--prime-edit', action='store_true', help='do a manual Add first so the viewer is in edit mode')
    ap.add_argument('--anchor', type=int, default=1, help='slide to select before opening the panel (1-based)')
    ap.add_argument('--verbose', action='store_true')
    ap.add_argument('--trace', action='store_true', help='enable the Slide Composer trace (SC_TRACE console lines)')
    a = ap.parse_args()
    r = asyncio.run(Harness(a).run(a.scenario))
    print(json.dumps({k: v for k, v in r.items() if k not in ('samples', 'trail', 'mock_log', 'console')}, indent=1))
