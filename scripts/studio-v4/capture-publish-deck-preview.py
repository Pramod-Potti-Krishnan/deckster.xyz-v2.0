"""Owned Final preview in the actual app; local intercepted records, no writes."""
import asyncio, copy, hashlib, json, sys, types
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.async_api import expect
expect.set_options(timeout=20000)

sys.path.insert(0, str(Path(__file__).resolve().parent))
import native_viewer as nv
ROOT = Path(__file__).resolve().parents[2]
OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
NAMES = ['app/builder/page.tsx', 'components/builder/presentation-area.tsx',
         'components/publish-dialog.tsx', 'components/publish-wizard.tsx',
         'components/studio-publish.css', 'components/studio-publish-preview.tsx',
         'lib/studio-publish-preview.ts', 'scripts/studio-v4/walkthrough.py',
         'hooks/use-builder-session.ts', 'hooks/use-deckster-websocket-v2.ts',
         'scripts/studio-v4/native_viewer.py', 'scripts/studio-v4/capture-publish-deck-preview.py']
def hashes(): return {n: hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in NAMES}
START = hashes(); STATES = []; PASSED = False
(OUT/'probe.py').write_bytes(Path(__file__).read_bytes())
async def skip_thumbnails(self, pw): pass
nv.NativeViewer.thumbnails = skip_thumbnails

async def verify(page, ctx, browser, errors, violations, denied, native, session):
    global PASSED
    original = copy.deepcopy(session)
    sockets = {}; image_reads = []
    image_release = asyncio.Event()
    final_id = 'local-final-publish-target'
    second_id = '33333333-3333-4333-8333-333333333333'
    other = {**copy.deepcopy(original), 'id':second_id, 'title':'Second preview owner · LOCAL SAMPLE'}
    records = {walkthrough.SESSION:session, second_id:other}
    async def sessions_route(route):
        assert route.request.method == 'GET'
        p = urlparse(route.request.url).path
        if p == '/api/sessions':
            data = {'sessions':list(records.values()), 'pagination':{'total':2,'limit':20,'offset':0,'hasMore':False}}
        else:
            owner = p.split('/')[3]
            assert owner in records, p
            data = {'files':[]} if p.endswith('/files') else {'messages':[]} if p.endswith('/messages') else {'session':records[owner]}
        await route.fulfill(json=data)
    await ctx.route('**/api/sessions*', sessions_route)
    await ctx.route('**/api/sessions/**', sessions_route)
    async def second_publish(route):
        assert route.request.method == 'GET'
        await route.fulfill(json={'deck':None,'staleness':'unknown','currentSlideCount':2})
    await ctx.route('**/api/publish/by-session/'+second_id+'*', second_publish)
    async def local_socket(ws):
        u = urlparse(ws.url)
        owner = parse_qs(u.query).get('session_id',[None])[0]
        assert u.scheme=='wss' and u.netloc=='directorv40-uat.up.railway.app' and u.path=='/ws' and owner in records, ws.url
        sockets[owner] = ws
        # This is an intercepted local socket, never connected to Director.
        ws.on_message(lambda message: None)
    await ctx.route_web_socket('wss://directorv40-uat.up.railway.app/ws*', local_socket)
    async def image_route(route):
        assert route.request.method=='GET'
        u=urlparse(route.request.url); mode=parse_qs(u.query).get('preview',[None])[0]
        assert mode in ['loading','error','owned-final','second-owner'], route.request.url
        image_reads.append({'mode':mode,'url':route.request.url})
        if mode=='loading': await image_release.wait()
        if mode=='error': await route.fulfill(status=404,body='Local image unavailable'); return
        name='slide-1.png'
        await route.fulfill(content_type='image/png',body=(nv.CACHE/name).read_bytes())
    await ctx.route(nv.BASE+'/studio-local-sample/slides/1.png?preview=*', image_route)
    dialog=page.locator('[data-studio-publish=true]')
    figure=dialog.get_by_label('Current deck preview',exact=True)
    image=figure.get_by_alt_text('First slide of the current Final deck',exact=True)
    def save():
        (OUT/'results.json').write_text(json.dumps({'passed':PASSED,'states':STATES,'source_start':START,'source_end':hashes(),
            'layout_ref':nv.LAYOUT_REF,'page_errors':errors,'violations':violations,'refused_writes':denied,
            'image_reads':image_reads,'liveStageFFrameDispatched':False,
            'scope':'Actual app and immutable native viewer with intercepted supplied owner/session/version/image data. No services, publication, persistence or thumbnail generation.'},indent=2)+'\n')
    async def shot(name, owner, status):
        assert not errors and not violations and not denied, (errors,violations,denied)
        await expect(figure).to_be_visible()
        info=await figure.evaluate("e=>({text:e.innerText,rect:e.getBoundingClientRect().toJSON(),image:e.querySelector('img')?{src:e.querySelector('img').getAttribute('src'),owner:e.querySelector('img').getAttribute('data-studio-preview-owner'),complete:e.querySelector('img').complete,width:e.querySelector('img').naturalWidth}:null,status:e.querySelector('[data-preview-status]')?.getAttribute('data-preview-status')??null})")
        assert info['status']==status, info
        if status=='ready':
            assert info['image']['complete'] and info['image']['width']>0, info
            assert json.loads(info['image']['owner'])[0]==owner, info
        metrics=await dialog.evaluate("e=>({dialog:e.getBoundingClientRect().toJSON(),header:e.querySelector('.studio-publish-dialog-header').getBoundingClientRect().toJSON(),footer:e.querySelector('.studio-publish-wizard-actions').getBoundingClientRect().toJSON(),body:{scrollTop:e.querySelector('.studio-publish-body').scrollTop,clientHeight:e.querySelector('.studio-publish-body').clientHeight,scrollHeight:e.querySelector('.studio-publish-body').scrollHeight},pageWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,viewportHeight:innerHeight})")
        assert metrics['pageWidth']<=metrics['viewportWidth'], metrics
        assert metrics['header']['y']>=0 and metrics['footer']['bottom']<=metrics['viewportHeight']+1, metrics
        await page.screenshot(path=str(OUT/(name+'.png')))
        STATES.append({'name':name,'owner':owner,'actualTheme':await page.locator('html').get_attribute('class'),**info,**metrics}); save()
    async def load(dark=False):
        await page.set_viewport_size({'width':1440,'height':900})
        r=await page.goto(nv.BASE+'/builder?session_id='+walkthrough.SESSION,wait_until='domcontentloaded'); assert r.status==200
        await expect(page.get_by_title('Presentation Viewer',exact=True).content_frame.locator('section.present .slide-title')).to_be_visible()
        await page.get_by_role('button',name='Mode',exact=True).click()
        await page.get_by_role('menuitemradio',name='Dark' if dark else 'Light',exact=True).click()
        await expect(page.locator('html')).to_have_class('dark' if dark else 'light')
        await expect(page.get_by_role('button',name='Publish',exact=True)).to_be_enabled()
    async def open_preview():
        await page.get_by_role('button',name='Publish',exact=True).click()
        await expect(dialog.get_by_text('Who is this for?',exact=True)).to_be_visible()
    async def ready(): await expect(figure.locator('[data-preview-status]')).to_have_attribute('data-preview-status','ready')
    def restored_url(mode): return nv.BASE+'/studio-local-sample/slides/1.png?preview='+mode
    try:
        for dark in [False,True]:
            await load(dark); await open_preview(); await ready()
            await shot(('dark' if dark else 'light')+'-owned-restored-final',walkthrough.SESSION,'ready')
        await page.set_viewport_size({'width':390,'height':844})
        await expect(dialog.get_by_text('Who is this for?',exact=True)).to_be_visible()
        await page.screenshot(path=str(OUT/'dark-narrow-settings.png'))
        await figure.scroll_into_view_if_needed(); await shot('dark-narrow-stacked-preview',walkthrough.SESSION,'ready')
        next_button=dialog.get_by_role('button',name='Next · Questions',exact=True)
        for _ in range(90):
            if await next_button.evaluate('e=>e===document.activeElement'): break
            await page.keyboard.press('Tab')
        await expect(next_button).to_be_focused()
        await shot('dark-narrow-next-keyboard-focus',walkthrough.SESSION,'ready')
        await page.keyboard.press('Escape')
        for mode in ['missing','mismatch','loading','error']:
            session.clear(); session.update(copy.deepcopy(original))
            slide=session['stateCache']['slideStructure']['slides'][0]
            if mode=='missing': slide.pop('thumbnail_url')
            elif mode=='mismatch': slide['thumbnail_presentation_id']='different-presentation'
            else: slide['thumbnail_url']=restored_url(mode)
            await load(); await open_preview()
            if mode in ['missing','mismatch']:
                await expect(figure.get_by_text('Deck preview unavailable',exact=True)).to_be_visible(); status=None
                await expect(image).to_have_count(0)
            elif mode=='loading':
                await expect(figure.get_by_text('Loading deck preview…',exact=True)).to_be_visible(); status='loading'
            else:
                await expect(figure.get_by_text('The slide image could not be loaded.',exact=True)).to_be_visible(); status='error'
                await expect(image).to_have_count(0)
            await shot('light-'+mode+'-fallback',walkthrough.SESSION,status)
            if mode=='loading':
                image_release.set(); await ready(); await shot('light-loading-recovered',walkthrough.SESSION,'ready')
            await page.keyboard.press('Escape')
        # Active renderer retains its real supplied native ID. Publish owns a
        # distinct explicit Final ID; neither visible version is its authority.
        session.clear(); session.update(copy.deepcopy(original))
        session.update(finalPresentationId=final_id,finalPresentationUrl=nv.ORIGIN+'/p/'+final_id,
                       blankPresentationId=nv.PRESENTATION_ID,blankPresentationUrl=nv.VIEWER,
                       strawmanPresentationId=nv.PRESENTATION_ID,strawmanPreviewUrl=nv.VIEWER)
        session['stateCache']['activeVersion']='blank'
        session['stateCache']['slideStructure']['slides'][0]['thumbnail_presentation_id']=final_id
        session['stateCache']['slideStructure']['slides'][0]['thumbnail_url']=restored_url('owned-final')
        await load()
        await page.get_by_role('button',name='Show',exact=True).click()
        await expect(page.get_by_role('menuitem',name='Custom',exact=True)).to_have_attribute('aria-current','true')
        await page.keyboard.press('Escape')
        await open_preview(); await ready(); await expect(image).to_have_attribute('src',restored_url('owned-final'))
        await shot('light-owned-final-while-custom-active',walkthrough.SESSION,'ready')
        assert json.loads(await image.get_attribute('data-studio-preview-owner'))[1]==final_id
        await page.keyboard.press('Escape')
        await page.get_by_role('button',name='Show',exact=True).click()
        await page.get_by_role('menuitem',name='Strawman',exact=True).click()
        await page.get_by_role('button',name='Show',exact=True).click()
        await expect(page.get_by_role('menuitem',name='Strawman',exact=True)).to_have_attribute('aria-current','true')
        await page.keyboard.press('Escape')
        await open_preview(); await ready(); await expect(image).to_have_attribute('src',restored_url('owned-final'))
        await shot('light-owned-final-while-strawman-active',walkthrough.SESSION,'ready')
        await page.keyboard.press('Escape')
        # Real application sidebar session switch, retaining the same page.
        other['stateCache']['slideStructure']['slides'][0]['thumbnail_url']=restored_url('second-owner')
        await page.get_by_role('button',name='Open deck list',exact=True).click()
        await page.get_by_text(other['title'],exact=True).click()
        await expect(page).to_have_url(nv.BASE+'/builder?session_id='+second_id)
        await expect(page.get_by_role('button',name='Publish',exact=True)).to_be_enabled()
        await open_preview(); await ready(); await expect(image).to_have_attribute('src',restored_url('second-owner'))
        await shot('light-sidebar-owner-changed',second_id,'ready')
        assert json.loads(await image.get_attribute('data-studio-preview-owner'))[1]==nv.PRESENTATION_ID
        assert START==hashes(), 'Source changed during capture'
        assert [s['name'] for s in STATES]==['light-owned-restored-final','dark-owned-restored-final',
            'dark-narrow-stacked-preview','dark-narrow-next-keyboard-focus','light-missing-fallback',
            'light-mismatch-fallback','light-loading-fallback','light-loading-recovered','light-error-fallback',
            'light-owned-final-while-custom-active','light-owned-final-while-strawman-active','light-sidebar-owner-changed']
        PASSED=True
    finally:
        await page.screenshot(path=str(OUT/'final-state.png'))
        (OUT/'final-state.txt').write_text(page.url+'\n'+await page.locator('body').inner_text())
        save()

mod=types.ModuleType('verify_walkthrough'); mod.verify=verify; sys.modules['verify_walkthrough']=mod
import capture
original_required=capture.required
async def required_with_failure_evidence(locator, *args, **kwargs):
    try: return await original_required(locator, *args, **kwargs)
    except BaseException:
        await locator.page.screenshot(path=str(OUT/'startup-failure.png'))
        (OUT/'startup-failure.txt').write_text(await locator.page.locator('body').inner_text())
        raise
capture.required=required_with_failure_evidence
import walkthrough
sys.argv=['walkthrough.py','--verify','--headless','--status-path',str(OUT/'status.json')]
asyncio.run(walkthrough.main())
