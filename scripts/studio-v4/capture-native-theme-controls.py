"""Changed native Theme controls; actual UI, exact locally supplied responses only."""
import asyncio, copy, hashlib, json, re, sys, types
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import expect

expect.set_options(timeout=20000)
sys.path.insert(0, str(Path(__file__).resolve().parent))
import native_viewer as nv

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
CONTRAST_ONLY = '--contrast-only' in sys.argv[2:]
SAVED_COLORS_ONLY = '--saved-colors-only' in sys.argv[2:]
assert not (CONTRAST_ONLY and SAVED_COLORS_ONLY)
FILES = ['components/builder/chat-input.tsx', 'components/builder/studio-theme-menu.tsx',
         'components/builder/studio-theme-menu.css',
         'hooks/use-theme-profiles.ts', 'hooks/use-templates.ts', 'lib/theme-builder.ts',
         'scripts/studio-v4/walkthrough.py', 'scripts/studio-v4/capture-native-theme-controls.py']
def hashes():
    return {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in FILES if (ROOT / p).exists()}
START = hashes(); STATES = []; PASSED = False
(OUT / 'probe.py').write_bytes(Path(__file__).read_bytes())
async def skip_thumbnails(self, pw): pass
nv.NativeViewer.thumbnails = skip_thumbnails

async def verify(page, ctx, browser, errors, violations, denied, native, session):
    global PASSED
    original_session = copy.deepcopy(session)
    a = {'id': 'local-A', 'name': 'Palette A · LOCAL', 'theme_payload': {'mode': 'custom', 'primary_hex': '#123456'}, 'is_standard': False}
    b = {'id': 'local-B', 'name': 'Palette B · LOCAL', 'theme_payload': {'mode': 'custom', 'primary_hex': '#456789'}, 'is_standard': False}
    library = [copy.deepcopy(a), copy.deepcopy(b)]
    read_reply = None; reads = []; writes = []; plan = None; gates = []
    async def themes(route):
        nonlocal plan
        req = route.request; u = urlparse(req.url)
        assert u.scheme == 'http' and u.netloc == '127.0.0.1:8792' and not u.query
        if req.method == 'GET':
            assert u.path in ['/api/themes', '/api/themes/standard'], (req.method, u.path)
            reply = copy.deepcopy(read_reply if read_reply is not None else {'themes': library, 'count': len(library)})
            if u.path.endswith('/standard'): reply = {'theme': next((p for p in library if p.get('is_standard')), None)}
            reads.append({'method': 'GET', 'path': u.path, 'supplied': reply})
            await route.fulfill(json=reply); return
        expected = plan
        assert expected is not None and (req.method, u.path) == (expected['method'], expected['path']), (req.method, u.path, expected)
        plan = None
        body = req.post_data_json if req.post_data else None
        if 'body' in expected: assert body == expected['body'], body
        writes.append({'method': req.method, 'path': u.path, 'body': body, 'supplied_status': expected.get('status', 200), 'supplied_response': expected.get('response')})
        expected['started'].set()
        if expected.get('gate'): await expected['gate'].wait()
        await route.fulfill(status=expected.get('status', 200), json=expected.get('response', {}))
    async def presets(route):
        assert route.request.method == 'GET' and route.request.url == walkthrough.PRESETS_URL
        await route.fulfill(json=[{'preset_id': 'corporate_light', 'name': 'Corporate Light', 'description': 'Clean business theme with a blue brand base'},
                                 {'preset_id': 'minimal', 'name': 'Minimal', 'description': 'Quiet, restrained theme for simple narratives'}])
    await ctx.route(re.compile(r'^http://127\.0\.0\.1:8792/api/themes(?:/.*)?$'), themes)
    await ctx.route(walkthrough.PRESETS_URL, presets)
    def write():
        (OUT / 'results.json').write_text(json.dumps({'passed': PASSED, 'states': STATES, 'source_start': START, 'source_end': hashes(),
            'page_errors': errors, 'violations': violations, 'refused_writes': denied, 'intercepted_reads': reads, 'intercepted_writes': writes,
            'scope': 'Actual Builder UI with exact supplied local Theme read/write responses. No services, generation, persistence or connected acknowledgement proof; owner/unmount/readiness races require the separate actual-source witness.'}, indent=2) + '\n')
    def arm(method, path, response=None, status=200, body=None, held=False):
        nonlocal plan
        assert plan is None
        p = {'method': method, 'path': path, 'response': response or {}, 'status': status, 'started': asyncio.Event()}
        if body is not None: p['body'] = body
        if held:
            p['gate'] = asyncio.Event(); gates.append(p['gate'])
        plan = p; return p
    async def fresh(dark=False, locked=False):
        nonlocal page
        await page.close(); session.clear(); session.update(copy.deepcopy(original_session))
        if not locked: session.update(currentStage=1, finalPresentationId=None, finalPresentationUrl=None, stateCache={})
        page = await ctx.new_page(); page.set_default_timeout(20000); await page.set_viewport_size({'width': 1440, 'height': 900})
        response = await page.goto(nv.BASE + '/builder?session_id=' + walkthrough.SESSION, wait_until='domcontentloaded'); assert response.status == 200
        trigger = page.get_by_role('button', name='Build theme', exact=True)
        if locked:
            await expect(trigger).to_be_disabled(); return trigger, None
        await expect(trigger).to_be_enabled()
        if dark:
            # Fresh Stage1 has no presentation Mode toolbar. Supply the existing
            # provider preference and verify the actual resulting document class.
            await page.evaluate("()=>{localStorage.setItem('theme','dark');dispatchEvent(new StorageEvent('storage',{key:'theme',newValue:'dark',oldValue:'light',storageArea:localStorage,url:location.href}))}")
            await expect(page.locator('html')).to_have_class('dark')
        await trigger.click(); menu = page.locator('[data-studio-composer-menu="theme"]')
        await expect(menu).to_be_visible(); await expect(menu.locator('[data-studio-theme-choice="saved:local-A"]')).to_be_visible()
        return trigger, menu
    def action(menu, name): return menu.locator('[data-studio-theme-action="' + name + '"]')
    async def shot(name, area):
        assert not errors and not violations and not denied, (errors, violations, denied)
        await expect(area).to_be_visible()
        await page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        info = await area.evaluate("e=>({text:e.innerText,rect:e.getBoundingClientRect().toJSON(),theme:document.documentElement.className,pageWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,viewportHeight:innerHeight,scrollWidth:e.scrollWidth,width:e.clientWidth,focus:document.activeElement?.outerHTML,fields:[...e.querySelectorAll('input,select')].map(x=>({label:x.getAttribute('aria-label'),value:x.value,disabled:x.disabled})),choices:[...e.querySelectorAll('[data-studio-theme-choice]')].map(x=>({key:x.dataset.studioThemeChoice,selected:x.dataset.studioThemeSelected,disabled:x.disabled,pressed:x.getAttribute('aria-pressed')}))})")
        assert ('dark' in info['theme'].split()) == name.startswith('dark-'), info
        assert info['pageWidth'] <= info['viewportWidth'] and info['scrollWidth'] <= info['width'] + 1, info
        if area != page.locator('body'):
            assert info['rect']['left'] >= -1 and info['rect']['right'] <= info['viewportWidth'] + 1 and info['rect']['top'] >= -1 and info['rect']['bottom'] <= info['viewportHeight'] + 1, info
        await page.screenshot(path=str(OUT / (name + '.png'))); STATES.append({'name': name, **info}); write()
    async def tab_to(target):
        for _ in range(80):
            if await target.evaluate('e=>e===document.activeElement'): return
            await page.keyboard.press('Tab')
        await expect(target).to_be_focused()
    async def settled(menu, state):
        await expect(menu.locator('[data-studio-theme-mutation-state="' + state + '"]')).to_be_visible()
        await expect(menu.locator('[data-studio-theme-mutation-state="loading"]')).to_have_count(0)
    try:
        if SAVED_COLORS_ONLY:
            library.extend([
                {'id': 'local-override', 'name': 'Explicit primary · LOCAL', 'theme_payload': {'mode': 'custom', 'primary_hex': '#123456', 'color_overrides': {'primary': '#abcdef'}}, 'is_standard': False},
                {'id': 'local-unknown', 'name': 'Unknown palette · LOCAL', 'theme_payload': {'mode': 'preset', 'preset_id': 'minimal'}, 'is_standard': False},
            ])
            for dark in [False, True]:
                trigger, menu = await fresh(dark=dark)
                selected = menu.locator('[data-studio-theme-choice="saved:local-B"]')
                await selected.click(); await expect(selected).to_have_attribute('aria-pressed', 'true')
                await tab_to(selected); await expect(selected).to_be_focused()
                colors = []
                for profile, rgb in [(a, 'rgb(18, 52, 86)'), (b, 'rgb(69, 103, 137)'), (library[2], 'rgb(171, 205, 239)')]:
                    row = menu.locator('[data-studio-theme-choice="saved:' + profile['id'] + '"]')
                    glyph = row.locator('.studio-theme-glyph')
                    await expect(glyph).to_have_attribute('aria-hidden', 'true')
                    color = await glyph.evaluate('e=>getComputedStyle(e).backgroundColor')
                    assert color == rgb, (profile, color, rgb)
                    await expect(glyph.locator('svg')).to_have_count(0)
                    colors.append({'id': profile['id'], 'payload': profile['theme_payload'], 'renderedColor': color})
                fallback = menu.locator('[data-studio-theme-choice="saved:local-unknown"] .studio-theme-glyph')
                await expect(fallback).not_to_have_attribute('data-studio-theme-color', re.compile('.+'))
                await expect(fallback.locator('svg')).to_have_count(1)
                for preset in ['corporate_light', 'minimal']:
                    await expect(menu.locator('[data-studio-theme-choice="preset:' + preset + '"] .studio-theme-glyph svg')).to_have_count(1)
                await shot(('dark-' if dark else 'light-') + 'saved-primary-and-unknown-fallback', menu)
                STATES[-1]['savedColors'] = colors
                STATES[-1]['unknownFallback'] = {'id': 'local-unknown', 'payload': library[3]['theme_payload'], 'neutralGlyph': True}
                write()
            assert START == hashes() and not writes and [s['name'] for s in STATES] == ['light-saved-primary-and-unknown-fallback', 'dark-saved-primary-and-unknown-fallback']
            PASSED = True; return
        if CONTRAST_ONLY:
            ratios = []
            for dark in [False, True]:
                trigger, menu = await fresh(dark=dark)
                await menu.locator('[data-studio-theme-choice="preset:corporate_light"]').click()
                await action(menu, 'save-entry').click()
                await menu.get_by_label('Theme name', exact=True).fill('Local contrast witness')
                button = action(menu, 'save')
                await expect(button).not_to_have_attribute('aria-disabled', 'true')
                for state in ['normal', 'hover', 'keyboard-focus']:
                    if state == 'hover': await button.hover()
                    if state == 'keyboard-focus': await tab_to(button); await expect(button).to_be_focused()
                    name = ('dark-' if dark else 'light-') + 'enabled-save-' + state
                    await shot(name, menu)
                    style = await button.evaluate("e=>{const s=getComputedStyle(e);return {color:s.color,background:s.backgroundColor,filter:s.filter,opacity:s.opacity,outline:s.outline,focused:e===document.activeElement}}")
                    def channels(value): return [float(x) for x in re.findall(r'[\d.]+', value)[:3]]
                    factor = float(re.search(r'brightness\(([\d.]+)\)', style['filter']).group(1)) if 'brightness(' in style['filter'] else 1
                    def luminance(value):
                        v = [min(255, x * factor) / 255 for x in channels(value)]
                        linear = [x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in v]
                        return sum(x * y for x, y in zip(linear, [.2126, .7152, .0722]))
                    fg, bg = luminance(style['color']), luminance(style['background'])
                    ratio = (max(fg, bg) + .05) / (min(fg, bg) + .05)
                    assert style['opacity'] == '1', style
                    STATES[-1]['save_style'] = style; STATES[-1]['save_text_contrast'] = ratio
                    ratios.append(ratio); write()
            assert [s['name'] for s in STATES] == [prefix + 'enabled-save-' + state for prefix in ['light-', 'dark-'] for state in ['normal', 'hover', 'keyboard-focus']]
            assert START == hashes() and not writes and min(ratios) >= 4.5, ratios
            PASSED = True; return
        trigger, menu = await fresh()
        await expect(menu.locator('[data-studio-theme-choice="auto"]')).to_have_attribute('aria-pressed', 'true')
        await shot('light-choices-auto', menu)
        await menu.locator('[data-studio-theme-choice="preset:corporate_light"]').click()
        await expect(menu.locator('[data-studio-theme-choice="preset:corporate_light"]')).to_have_attribute('aria-pressed', 'true')
        await shot('light-choices-preset', menu)
        await menu.locator('[data-studio-theme-choice="saved:local-A"]').click()
        await expect(menu.locator('[data-studio-theme-choice="saved:local-A"]')).to_have_attribute('aria-pressed', 'true')
        await shot('light-choices-saved', menu)
        await menu.get_by_label('Brand hex color', exact=True).fill('#abcdef')
        await action(menu, 'save-entry').click(); name = menu.get_by_label('Theme name', exact=True)
        await name.fill('Unsent local theme'); await shot('light-save-draft', menu)
        body = {'name': 'Unsent local theme', 'description': None, 'theme': {'mode': 'custom', 'primary_hex': '#abcdef'}, 'set_standard': False}
        p = arm('POST', '/api/themes', {'error': 'Local supplied refusal'}, 503, body, True)
        await tab_to(action(menu, 'save')); await page.keyboard.press('Enter'); await p['started'].wait()
        await expect(menu.locator('[data-studio-theme-mutation-state="loading"]')).to_be_visible()
        await expect(action(menu, 'save')).to_be_focused(); await expect(action(menu, 'save')).to_have_attribute('aria-disabled', 'true')
        assert not await action(menu, 'save').evaluate('e=>e.disabled')
        await shot('light-save-pending', menu)
        p['gate'].set(); await settled(menu, 'failed'); await expect(name).to_have_value('Unsent local theme')
        await shot('light-save-refused-keeps-draft', menu)
        arm('POST', '/api/themes', {'error': 'Local malformed HTTP200 payload'}, body=body)
        await action(menu, 'save').click(); await settled(menu, 'failed'); await expect(name).to_have_value('Unsent local theme')
        await shot('light-save-malformed-keeps-draft', menu)
        saved = {'id': 'local-saved', 'name': 'Unsent local theme', 'theme_payload': {'mode': 'custom', 'primary_hex': '#abcdef'}, 'is_standard': False}
        library.append(saved); arm('POST', '/api/themes', saved, body=body)
        await action(menu, 'save').click(); await settled(menu, 'success'); await shot('light-save-acknowledged', menu)
        await action(menu, 'back').click(); await action(menu, 'manage-entry').click()
        arm('PUT', '/api/themes/local-saved/standard', {'error': 'Local supplied refusal'}, 503)
        before = len(reads); await action(menu, 'set-standard').click(); await settled(menu, 'failed'); assert len(reads) == before
        await shot('light-manage-set-standard-refusal', menu)
        saved['is_standard'] = True; arm('PUT', '/api/themes/local-saved/standard', {'theme': saved})
        await action(menu, 'set-standard').click(); await settled(menu, 'success'); await shot('light-manage-set-standard-acknowledged', menu)
        arm('DELETE', '/api/themes/standard', {'error': 'Local supplied refusal'}, 503)
        before = len(reads); await action(menu, 'clear-standard').click(); await settled(menu, 'failed'); assert len(reads) == before
        await shot('light-manage-clear-standard-refusal', menu)
        saved['is_standard'] = False; arm('DELETE', '/api/themes/standard')
        await action(menu, 'clear-standard').click(); await settled(menu, 'success'); await shot('light-manage-clear-standard-acknowledged', menu)
        arm('DELETE', '/api/themes/local-saved', {'error': 'Local supplied refusal'}, 503)
        before = len(reads); await action(menu, 'delete').click(); await settled(menu, 'failed'); assert len(reads) == before
        await shot('light-manage-delete-refusal', menu)
        library[:] = [a, b]; arm('DELETE', '/api/themes/local-saved')
        await action(menu, 'delete').click(); await settled(menu, 'success'); await shot('light-manage-delete-acknowledged', menu)
        trigger, menu = await fresh(dark=True)
        await menu.locator('[data-studio-theme-choice="saved:local-B"]').click(); await shot('dark-choices-selected', menu)
        await action(menu, 'save-entry').click(); name = menu.get_by_label('Theme name', exact=True)
        await name.fill('Keep narrow draft')
        await page.set_viewport_size({'width': 1440, 'height': 600}); await tab_to(action(menu, 'save'))
        await expect(action(menu, 'save')).to_be_focused(); await shot('dark-short-save-keyboard-focus', menu)
        await action(menu, 'back').click(); await action(menu, 'manage-entry').click()
        await page.set_viewport_size({'width': 390, 'height': 844}); await tab_to(action(menu, 'set-standard'))
        await expect(action(menu, 'set-standard')).to_be_focused(); await shot('dark-narrow-manage-keyboard-focus', menu)
        trigger, menu = await fresh(locked=True); await shot('light-locked-trigger', trigger)
        expected = ['light-choices-auto','light-choices-preset','light-choices-saved','light-save-draft','light-save-pending','light-save-refused-keeps-draft','light-save-malformed-keeps-draft','light-save-acknowledged','light-manage-set-standard-refusal','light-manage-set-standard-acknowledged','light-manage-clear-standard-refusal','light-manage-clear-standard-acknowledged','light-manage-delete-refusal','light-manage-delete-acknowledged','dark-choices-selected','dark-short-save-keyboard-focus','dark-narrow-manage-keyboard-focus','light-locked-trigger']
        assert START == hashes() and [s['name'] for s in STATES] == expected and plan is None
        PASSED = True
    finally:
        for gate in gates: gate.set()
        await page.screenshot(path=str(OUT / 'final-state.png'))
        (OUT / 'final-state.txt').write_text(page.url + '\n' + await page.locator('body').inner_text()); write()

mod = types.ModuleType('verify_walkthrough'); mod.verify = verify; sys.modules['verify_walkthrough'] = mod
import walkthrough
sys.argv = ['walkthrough.py', '--verify', '--headless', '--status-path', str(OUT / 'status.json')]
asyncio.run(walkthrough.main())
