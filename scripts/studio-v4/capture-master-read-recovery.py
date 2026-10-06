"""Actual Master leaf, supplied local read refusal, original native read recovery.

No native asset is edited. The isolated iframe intercepts one refused read at a
time; successful retries use its original getDerivativeElements handler. Every
HTTP request remains under walkthrough's exact read-only interception policy.
"""
import asyncio, hashlib, json, subprocess, sys, types
from pathlib import Path
from playwright.async_api import expect

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import native_viewer as nv

OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
FILES = ['components/presentation-settings-panel.tsx', 'components/studio-master-panel.css',
         'components/studio-editor-dialogs.css', 'lib/layout-viewer-messaging.ts',
         'app/builder/page.tsx', 'components/layout/studio-shell.css',
         'scripts/test-studio-master-panel.mjs', 'scripts/studio-v4/walkthrough.py',
         'scripts/studio-v4/native_viewer.py', 'scripts/studio-v4/capture.py',
         'scripts/studio-v4/capture-next.py', 'scripts/studio-v4/workspace-fixtures.json',
         'scripts/studio-v4/ten-hour-knowledge-fixture.json',
         'public/logo-icon.png',
         str(Path(__file__).relative_to(ROOT))]
def hashes(): return {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in FILES}
START = hashes(); COMMIT = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
STATES = []; PASSED = False; EVENTS = []
EXPECTED = ['wide-light-initial-read-error', 'wide-light-retry-known-empty-draft-kept',
            'narrow-dark-same-owner-read-error', 'narrow-dark-retry-known-populated-draft-kept']
(OUT / 'probe.py').write_bytes(Path(__file__).read_bytes())
expect.set_options(timeout=20000)
async def skip_thumbnails(self, pw): pass
nv.NativeViewer.thumbnails = skip_thumbnails

async def verify(page, ctx, browser, errors, violations, denied, native, session):
    global PASSED, EVENTS
    matches = [f for f in page.frames if f.url.split('#', 1)[0] == nv.VIEWER]
    assert len(matches) == 1, [f.url for f in page.frames]
    frame = matches[0]
    refusal = 'LOCAL supplied refused settings read'
    # Capture-phase listener supplies only explicit failures. Successful reads
    # and local preview commands pass through to the original immutable viewer.
    fixture = """({origin,refusal}) => {
      window.__studioMasterReadFailures = 1;
      window.__studioMasterReadEvents = [];
      addEventListener('message', e => {
        if (e.source !== parent || e.origin !== origin) return;
        const action = e.data?.action;
        if (!['getDerivativeElements','previewFooter','updateDerivativeElements','clearDerivativeElements'].includes(action)) return;
        const record = {action, params:e.data.params ?? null};
        window.__studioMasterReadEvents.push(record);
        if (action === 'getDerivativeElements' && window.__studioMasterReadFailures > 0) {
          window.__studioMasterReadFailures--;
          record.suppliedFailure = true;
          e.stopImmediatePropagation();
          parent.postMessage({action,success:false,error:refusal}, origin);
        }
        if (['updateDerivativeElements','clearDerivativeElements'].includes(action)) {
          record.refusedWrite = true;
          e.stopImmediatePropagation();
          parent.postMessage({action,success:false,error:'Local fixture refuses all writes'}, origin);
        }
      }, true);
    }"""
    (OUT / 'supplied-refusal-fixture.js').write_text(fixture + '\n')
    # Register before the native window-target message listener. Registering a
    # capture listener after it is not a reliable window-event ordering fixture.
    # This reload is confined to this new headless iframe, never PK's browser.
    await ctx.add_init_script('if(location.href.split("#")[0]===' + json.dumps(nv.VIEWER) + '){(' + fixture + ')(' + json.dumps({'origin':nv.BASE, 'refusal':refusal}) + ')}')
    await frame.evaluate('location.reload()')
    await page.get_by_title('Presentation Viewer', exact=True).content_frame.locator('.reveal .slides > section.present .slide-title').wait_for()
    matches = [f for f in page.frames if f.url.split('#', 1)[0] == nv.VIEWER]
    assert len(matches) == 1
    frame = matches[0]
    await frame.wait_for_function('window.__studioMasterReadEvents && window.Reveal?.isReady()')
    panel = page.get_by_role('dialog', name='Footer and logo', exact=True)
    # Stage selection hides the mounted Chat pane on narrow screens; inspect its
    # retained field value without claiming that hidden field is visible there.
    composer = page.get_by_role('textbox', name='Message Director', exact=True, include_hidden=True)
    composer_draft = 'Unsent Master read review draft'
    author_draft = 'Unsent Master read review author'
    def write():
        (OUT / 'results.json').write_text(json.dumps({
            'passed':PASSED, 'expected_states':EXPECTED, 'states':STATES,
            'source_commit':COMMIT, 'source_start':START, 'source_end':hashes(),
            'page_errors':errors, 'violations':violations, 'refused_http_writes':denied,
            'native_commands':EVENTS, 'browser':browser.version, 'layout_ref':nv.LAYOUT_REF,
            'isolated_iframe_setup_reload':True,
            'fixture_scope':'One explicit local refused settings read per open. Original native handler supplies successful null/populated ACKs from a supplied local read record. Actual local preview is allowed; no Save/Clear invocation or service writes. No connected failure, persistence or runtime restart claim.',
            'native_manifest':native.manifest,
        }, indent=2) + '\n')
    async def open_master():
        await page.get_by_role('button', name='Show', exact=True).click()
        await page.get_by_role('menuitem', name='Master…', exact=True).click()
        await expect(panel).to_be_visible()
        await expect(page.get_by_role('menu')).to_have_count(0)
        await page.wait_for_timeout(300)
    async def focus_retry():
        retry = panel.get_by_role('button', name='Retry settings', exact=True)
        # Real pointer entry into the native field, then reverse Tab reaches the
        # preceding recovery control without traversing the separate iframe.
        await panel.locator('#footer-author').click()
        trace=[]
        for _ in range(40):
            await page.keyboard.press('Shift+Tab')
            trace.append(await page.evaluate('({focus:document.activeElement?.outerHTML})'))
            if await retry.evaluate('e=>e===document.activeElement'): break
        (OUT / ('retry-focus-trace-' + str(len(STATES)) + '.json')).write_text(json.dumps(trace, indent=2)+'\n')
        await expect(retry).to_be_focused()
        return retry
    async def shot(name, known, dark):
        global EVENTS
        await expect(panel).to_be_visible()
        await expect(composer).to_have_value(composer_draft)
        await expect(panel.locator('#footer-author')).to_have_value(author_draft)
        await expect(panel.get_by_role('button', name='Cancel', exact=True)).to_be_enabled()
        await expect(panel.get_by_role('button', name='Close footer and logo panel', exact=True)).to_be_enabled()
        save = panel.get_by_role('button', name='Save', exact=True)
        clear = panel.get_by_role('button', name='Clear All Settings', exact=True)
        if known:
            await expect(panel.get_by_role('alert')).to_have_count(0)
            await expect(save).to_be_enabled(); await expect(clear).to_be_enabled()
        else:
            await expect(panel.get_by_role('alert')).to_contain_text(refusal)
            await expect(save).to_be_disabled(); await expect(clear).to_be_disabled()
        settled = await panel.evaluate("""e=>new Promise((resolve,reject)=>{let last='',stable=0,frames=0;const step=()=>{const r=e.getBoundingClientRect();const key=[r.x,r.y,r.width,r.height].map(n=>Math.round(n*100)/100).join(',');stable=key===last?stable+1:0;last=key;if(stable>=8)return resolve({frames,rect:key});if(++frames>180)return reject(Error('Master geometry did not settle'));requestAnimationFrame(step)};requestAnimationFrame(step)})""")
        info = await panel.evaluate("""e=>({text:e.innerText,rect:e.getBoundingClientRect().toJSON(),width:e.clientWidth,scrollWidth:e.scrollWidth,theme:document.documentElement.className,pageWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,viewportHeight:innerHeight,focus:document.activeElement?.outerHTML,fields:[...e.querySelectorAll('input')].map(x=>({id:x.id,value:x.value,disabled:x.disabled})),actions:[...e.querySelectorAll('button[data-studio-master-action]')].map(x=>({action:x.dataset.studioMasterAction,disabled:x.disabled,rect:x.getBoundingClientRect().toJSON()}))})""")
        assert ('dark' in info['theme'].split()) == dark, info
        assert info['pageWidth'] <= info['viewportWidth'] and info['scrollWidth'] <= info['width'] + 1, info
        assert info['rect']['top'] >= 0 and info['rect']['bottom'] <= info['viewportHeight'] + 1, info
        assert info['rect']['left'] >= 0 and info['rect']['right'] <= info['viewportWidth'] + 1, info
        info['stageContainer'] = await panel.evaluate('e=>e.closest("[data-studio-v4-viewer]").getBoundingClientRect().toJSON()')
        assert info['rect']['left'] >= info['stageContainer']['left'] and info['rect']['right'] <= info['stageContainer']['right'], info
        for action in info['actions']:
            if action['action'] != 'retry-read':
                assert action['rect']['top'] >= 0 and action['rect']['bottom'] <= info['viewportHeight'] + 1, action
        EVENTS = await frame.evaluate('window.__studioMasterReadEvents')
        assert not any(e['action'] in ['updateDerivativeElements','clearDerivativeElements'] for e in EVENTS), EVENTS
        assert not errors and not violations and not denied, (errors, violations, denied)
        await page.screenshot(path=str(OUT / (name + '.png')))
        STATES.append({'name':name,'settingsKnown':known,'draftRetained':True,'geometrySettled':settled,**info}); write()
    try:
        await page.set_viewport_size({'width':1440, 'height':900})
        await composer.fill(composer_draft)
        await open_master()
        await expect(panel.get_by_role('alert')).to_contain_text(refusal)
        await panel.locator('#footer-author').fill(author_draft)
        await expect(panel).to_contain_text('Logo settings have not loaded')
        await focus_retry()
        await shot(EXPECTED[0], False, False)
        assert not any(e['action']=='previewFooter' for e in EVENTS), EVENTS
        await page.keyboard.press('Enter')
        await expect(panel.get_by_role('alert')).to_have_count(0)
        await expect(panel).to_contain_text('No logo configured')
        await shot(EXPECTED[1], True, False)
        await panel.get_by_role('button', name='Close footer and logo panel', exact=True).click()
        await expect(panel).to_have_count(0)
        await page.get_by_role('button', name='Mode', exact=True).click()
        await page.get_by_role('menuitemradio', name='Dark', exact=True).click()
        await expect(page.locator('html')).to_have_class('dark')
        await frame.evaluate('window.__studioMasterReadFailures=1')
        await open_master(); await expect(panel.get_by_role('alert')).to_contain_text(refusal)
        # The existing compact toolbar hides Show at390px. Open through its real
        # wide entry, then resize the mounted panel; narrow entry is not proved.
        await page.set_viewport_size({'width':390, 'height':844})
        await page.get_by_role('button', name='Stage', exact=True).click()
        await expect(panel).to_be_visible()
        await focus_retry(); await shot(EXPECTED[2], False, True)
        # This is a supplied local model, consumed by the original native getter;
        # neither a generated asset nor connected persistence is represented.
        populated = {'footer':{'template':'{title} | Page {page}', 'values':{'title':'Confirmed local title', 'author':'Returned author', 'date':'Local supplied date'}},
                     'logo':{'image_url':nv.BASE+'/logo-icon.png', 'alt_text':'Supplied local logo'}}
        (OUT/'supplied-populated-record.json').write_text(json.dumps(populated, indent=2)+'\n')
        await frame.evaluate('(record)=>{window.currentPresentationData.derivative_elements=record}', populated)
        await page.keyboard.press('Enter')
        await expect(panel.get_by_role('alert')).to_have_count(0)
        await expect(panel.locator('#footer-title')).to_have_value('Confirmed local title')
        await expect(panel.locator('#logo-alt')).to_have_value('Supplied local logo')
        await expect(panel.locator('[data-studio-master-part="logo-image"] img')).to_be_visible()
        await expect(panel.locator('[data-studio-master-part="logo-image"] img')).to_have_js_property('complete', True)
        assert await panel.locator('[data-studio-master-part="logo-image"] img').evaluate('e=>e.naturalWidth>0')
        await expect(panel.locator('[data-studio-master-part="preview"]')).to_contain_text('Confirmed local title')
        await shot(EXPECTED[3], True, True)
        assert [s['name'] for s in STATES] == EXPECTED and len(STATES)==4
        assert [e.get('suppliedFailure',False) for e in EVENTS if e['action']=='getDerivativeElements'] == [True,False,True,False], EVENTS
        assert START == hashes() and not errors and not violations and not denied
        PASSED = True
    finally:
        EVENTS = await frame.evaluate('window.__studioMasterReadEvents'); write()
        await page.screenshot(path=str(OUT/'final-state.png'))

mod=types.ModuleType('verify_walkthrough'); mod.verify=verify; sys.modules['verify_walkthrough']=mod
import walkthrough
sys.argv=['walkthrough.py','--verify','--headless','--status-path',str(OUT/'status.json')]
asyncio.run(walkthrough.main())
