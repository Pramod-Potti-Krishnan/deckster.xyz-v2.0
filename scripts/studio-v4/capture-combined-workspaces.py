"""Minimal actual cross-workspace checks. Isolated local reads, no service writes."""
import asyncio, copy, hashlib, json, re, sys, types
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.async_api import expect

expect.set_options(timeout=20000)
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import native_viewer as nv
OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
PREIMAGES = json.loads((ROOT / 'docs/studio-v4/overnight-fidelity-20261002/evidence/combined-workspaces-integration/port-preimages.json').read_text())
FILES = sorted(set([x['path'] for x in PREIMAGES['candidates']] + list(PREIMAGES['retainedProtectedAndShared']) + ['scripts/studio-v4/capture-combined-workspaces.py']))
def hashes(): return {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in FILES}
START = hashes(); STATES = []; PASSED = False
(OUT / 'probe.py').write_bytes(Path(__file__).read_bytes())
async def skip_thumbnails(self, pw): pass
nv.NativeViewer.thumbnails = skip_thumbnails

async def verify(page, ctx, browser, errors, violations, denied, native, session):
    global PASSED
    original = copy.deepcopy(session)
    def result():
        (OUT / 'results.json').write_text(json.dumps({'passed': PASSED, 'states': STATES, 'source_start': START, 'source_end': hashes(), 'page_errors': errors, 'violations': violations, 'refused_writes': denied, 'scope': 'Actual combined route/navigation/local read fixture. No connected account switch, write, generation or persistence. Owner/loading/paused-start races use unchanged actual-source witnesses. Composer is page-local and is not asserted to survive route unmount.'}, indent=2) + '\n')
    async def go(path):
        response = await page.goto(nv.BASE + path, wait_until='domcontentloaded')
        assert response.status == 200, (path, response.status)
        await page.wait_for_load_state('load')
    async def shot(name, area, facts=None):
        await expect(area).to_be_visible()
        await page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        assert not errors and not violations and not denied, (errors, violations, denied)
        info = await area.evaluate('e=>({text:e.innerText,rect:e.getBoundingClientRect().toJSON(),viewport:{width:innerWidth,height:innerHeight},pageWidth:document.documentElement.scrollWidth,focus:document.activeElement?.outerHTML})')
        assert info['pageWidth'] <= info['viewport']['width'], info
        await page.screenshot(path=str(OUT / (name + '.png')))
        STATES.append({'name': name, 'url': page.url, **info, 'facts': facts or {}}); result()
    async def return_ready(action, item=None):
        await expect(page).to_have_url(re.compile(r'^http://127\.0\.0\.1:8792/builder\?.*session_id=' + re.escape(walkthrough.SESSION) + r'(?:&|$)'))
        q = parse_qs(urlparse(page.url).query)
        assert q.get('studio_action') == [action], q
        if item: assert q.get('studio_item') == [item], q
        await expect(page.locator('[data-studio-v4-composer="true"]')).to_be_visible()
    async def clear_fixture_deck_cache():
        # Only our isolated context, while Builder is unmounted. The proof below
        # deliberately changes the supplied same-session stage between cases.
        await page.evaluate("v=>{for(const prefix of ['deckster_session_v2_','deckster_metadata_v2_'])sessionStorage.removeItem(prefix+encodeURIComponent(v.owner)+'_'+v.session)}", {'owner': walkthrough.USER['id'], 'session': walkthrough.SESSION})
    async def themes():
        await go('/studio/themes')
        area = page.locator('[data-studio-library="themes"]')
        await expect(area.get_by_role('heading', name='Themes & brand', exact=True)).to_be_visible()
        await area.get_by_role('button', name='Library', exact=True).click()
        await area.locator('.sl-record').filter(has_text='Evergreen studio').click()
        await expect(area.get_by_role('button', name='Choose theme in Studio', exact=True)).to_be_enabled()
        return area
    try:
        await page.set_viewport_size({'width': 1440, 'height': 600})
        area = await themes()
        stage = area.locator('.sl-stage-space'); bounds = await stage.bounding_box()
        assert bounds and bounds['height'] > 80 and bounds['y'] + bounds['height'] <= 600, bounds
        await shot('themes-short-identity-layout', area, {'workspaceId': 'themes', 'stageBounds': bounds})
        await area.get_by_role('button', name='Choose theme in Studio', exact=True).click()
        await return_ready('theme', 'fixture-theme-sage')
        await expect(page.locator('[data-studio-v4-saved-theme-notice="locked"]')).to_be_visible()
        await expect(page.get_by_role('button', name='Build theme', exact=True)).to_be_disabled()
        composer = page.locator('[data-studio-v4-composer="true"] textarea')
        await composer.fill('Retained native draft while theme remains locked')
        await shot('theme-return-session-lock', page.locator('[data-studio-v4-shell-workspace="true"]'), {'explicitApplyRefused': True})
        await expect(composer).to_have_value('Retained native draft while theme remains locked')

        await page.set_viewport_size({'width': 390, 'height': 844})
        await go('/studio/templates'); area = page.locator('[data-studio-library="templates"]')
        await expect(area.get_by_role('heading', name='Templates', exact=True)).to_be_visible()
        side, preview = area.locator('.sl-side'), area.locator('.sl-preview-panel')
        a, b = await side.bounding_box(), await preview.bounding_box(); assert a['y'] < b['y'], (a, b)
        await shot('templates-create-narrow-order', area, {'side': a, 'preview': b})
        await area.get_by_role('button', name='Library', exact=True).click()
        await area.locator('.sl-record').filter(has_text='Quarterly business review').click()
        await expect(area.locator('.sl-preview-heading')).to_contain_text('Quarterly business review')
        await expect(area.locator('.sl-stage')).to_contain_text('A quarter of focused progress')
        a, b = await side.bounding_box(), await preview.bounding_box(); assert b['y'] < a['y'], (a, b)
        await shot('templates-library-narrow-order', area, {'side': a, 'preview': b})
        await page.set_viewport_size({'width': 1440, 'height': 900})
        trigger = area.get_by_role('button', name='Import presentation', exact=True)
        await trigger.click(); dialog = page.get_by_role('dialog')
        await expect(dialog).to_be_visible(); await expect(dialog.get_by_role('button', name='Cancel', exact=True)).to_be_enabled()
        await dialog.get_by_role('button', name='Cancel', exact=True).click()
        await expect(dialog).to_have_count(0); await expect(trigger).to_be_focused()
        await shot('templates-import-close-focus', area, {'noFileSelected': True, 'noUpload': True})
        await area.get_by_role('button', name='Back to Studio', exact=True).click(); await return_ready('templates')
        await expect(page.get_by_title('Presentation Viewer', exact=True)).to_have_count(1)
        await shot('templates-return-retained-session', page.locator('[data-studio-v4-shell-workspace="true"]'))

        session.update(currentStage=1, finalPresentationId=None, finalPresentationUrl=None, stateCache={})
        area = await themes(); await clear_fixture_deck_cache(); await area.get_by_role('button', name='Choose theme in Studio', exact=True).click()
        await return_ready('theme', 'fixture-theme-sage')
        menu = page.locator('[data-studio-composer-menu="theme"]')
        await expect(menu).to_be_visible(); await expect(menu.locator('[data-studio-v4-saved-theme-request="true"]')).to_contain_text('Evergreen studio')
        # Type through the normal composer while the modal menu is closed.
        # Filling an inert outside field while Radix owns focus is not user input.
        await menu.locator('[data-studio-theme-action="close"]').click()
        composer = page.locator('[data-studio-v4-composer="true"] textarea')
        await composer.fill('Native unsent draft survives explicit theme selection')
        await expect(composer).to_have_value('Native unsent draft survives explicit theme selection')
        await page.get_by_role('button', name='Build theme', exact=True).click()
        await expect(menu).to_be_visible()
        selected = menu.locator('[data-studio-theme-choice="saved:fixture-theme-sage"]')
        await expect(selected).to_have_attribute('aria-pressed', 'false'); await selected.click()
        await expect(selected).to_have_attribute('aria-pressed', 'true'); await expect(composer).to_have_value('Native unsent draft survives explicit theme selection')
        await shot('theme-return-explicit-apply-unsent', menu, {'noAutomaticApply': True, 'draftKeptDuringApply': True})

        await go('/studio/templates'); area = page.locator('[data-studio-library="templates"]')
        await area.get_by_role('button', name='Library', exact=True).click()
        await area.locator('.sl-record').filter(has_text='Customer growth story').click()
        await expect(area.get_by_role('button', name='Review this template in Studio', exact=False)).to_be_enabled()
        await area.get_by_role('button', name='Review this template in Studio', exact=False).click()
        await return_ready('templates', 'fixture-template-cleanup')
        picker = page.locator('[data-studio-template-picker="true"]')
        await expect(picker).to_be_visible(); await expect(picker).to_contain_text('From your library · not applied')
        await expect(picker).to_contain_text('Customer growth story')
        await expect(page.locator('[data-studio-composer-selection="template"]')).to_have_count(0)
        await shot('templates-owned-hint-not-applied', picker, {'itemId': 'fixture-template-cleanup', 'explicitApplyRequired': True})

        brief = 'Local integrated brief: audience, evidence and decision for review only.'
        for accept in [False, True]:
            await go('/studio/intelligence')
            area = page.locator('[data-studio-personal="intelligence"]')
            await expect(area.get_by_role('heading', name='Intelligence', exact=True)).to_be_visible()
            await area.get_by_role('button', name='Design preview', exact=True).click()
            await expect(area.get_by_role('button', name='Design preview', exact=True)).to_have_attribute('aria-pressed', 'true')
            await expect(area.get_by_role('button', name='Apply to Deckster', exact=True)).to_be_disabled()
            await area.get_by_role('button', name='Current workflows', exact=True).click()
            await expect(area.get_by_role('button', name='Current workflows', exact=True)).to_have_attribute('aria-pressed', 'true')
            await area.locator('.sp-workflow-brief textarea').fill(brief)
            await expect(area.get_by_role('button', name='Reset local briefs', exact=True)).to_be_enabled()
            await area.get_by_role('button', name='Review brief in Studio', exact=False).click()
            await return_ready('brief')
            notice = page.get_by_role('region', name='Brief ready', exact=True)
            await expect(notice).to_be_visible(); composer = page.locator('[data-studio-v4-composer="true"] textarea')
            await composer.fill('Keep my existing unsent message')
            await expect(notice).to_contain_text('replace the current unsent message')
            await notice.get_by_role('button', name='Use brief' if accept else 'Keep my message', exact=True).click()
            await expect(notice).to_have_count(0); await expect(composer).to_have_value(brief if accept else 'Keep my existing unsent message')
            if accept: await expect(composer).to_be_focused()
            await shot('intelligence-explicit-use-unsent' if accept else 'intelligence-keep-existing-unsent', page.locator('[data-studio-v4-shell-workspace="true"]'), {'noSend': True, 'explicitReplacement': accept})

        session.clear(); session.update(copy.deepcopy(original))
        await go('/studio/details'); await clear_fixture_deck_cache(); area = page.locator('.sp-workspace')
        await expect(area.get_by_role('heading', name='Your details', exact=True)).to_be_visible()
        await page.get_by_role('button', name='Footer & logo', exact=True).click(); await expect(page.get_by_role('button', name='Footer & logo', exact=True)).to_have_attribute('aria-pressed', 'true')
        await page.get_by_role('button', name='Open deck details in Studio', exact=True).click(); await return_ready('master')
        await expect(page.get_by_role('heading', name='Master', exact=True)).to_be_visible()
        await shot('details-return-native-master', page.locator('[data-studio-v4-shell-workspace="true"]'))
        session.update(currentStage=1, finalPresentationId=None, finalPresentationUrl=None, stateCache={})
        await go('/studio/details'); await clear_fixture_deck_cache(); await page.get_by_role('button', name='Footer & logo', exact=True).click(); await expect(page.get_by_role('button', name='Footer & logo', exact=True)).to_have_attribute('aria-pressed', 'true')
        await page.get_by_role('button', name='Open deck details in Studio', exact=True).click(); await return_ready('master')
        await expect(page.get_by_role('heading', name='Master', exact=True)).to_have_count(0)
        await expect(page.get_by_title('Presentation Viewer', exact=True)).to_have_count(0)
        await shot('details-master-no-deck-fallback', page.locator('[data-studio-v4-shell-workspace="true"]'), {'noViewerNoMasterWrite': True})
        session.clear(); session.update(copy.deepcopy(original))
        await go('/dashboard'); await clear_fixture_deck_cache()
        link = page.locator('[data-studio-deck-preview="true"]')
        await expect(link).to_have_count(1); await expect(link).to_have_attribute('href', '/builder?session_id=' + walkthrough.SESSION)
        await shot('decks-exact-session-link', page.locator('[data-studio-deck-grid="true"]'), {'href': await link.get_attribute('href')})
        await link.click(); await expect(page).to_have_url(nv.BASE + '/builder?session_id=' + walkthrough.SESSION)
        await expect(page.get_by_title('Presentation Viewer', exact=True)).to_have_count(1)
        expected = ['themes-short-identity-layout','theme-return-session-lock','templates-create-narrow-order','templates-library-narrow-order','templates-import-close-focus','templates-return-retained-session','theme-return-explicit-apply-unsent','templates-owned-hint-not-applied','intelligence-keep-existing-unsent','intelligence-explicit-use-unsent','details-return-native-master','details-master-no-deck-fallback','decks-exact-session-link']
        assert [s['name'] for s in STATES] == expected and START == hashes() and not errors and not violations and not denied
        PASSED = True
    finally:
        await page.screenshot(path=str(OUT / 'final-state.png'))
        (OUT / 'final-state.txt').write_text(page.url + '\n' + await page.locator('body').inner_text())
        result()

mod = types.ModuleType('verify_walkthrough'); mod.verify = verify; sys.modules['verify_walkthrough'] = mod
import walkthrough
sys.argv = ['walkthrough.py', '--verify', '--headless', '--status-path', str(OUT / 'status.json')]
asyncio.run(walkthrough.main())
