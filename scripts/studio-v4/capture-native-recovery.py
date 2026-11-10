"""Native Save observation and composer theme recovery: isolated supplied records."""
import asyncio, copy, hashlib, json, re, sys, types
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import expect
expect.set_options(timeout=20000)
sys.path.insert(0, str(Path(__file__).resolve().parent))
import native_viewer as nv
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(sys.argv[1]);OUT.mkdir(parents=True,exist_ok=True)
FILES=['components/template-save-dialog.tsx','components/builder/chat-input.tsx',
       'hooks/use-templates.ts','hooks/use-theme-profiles.ts','app/builder/page.tsx',
       'scripts/studio-v4/walkthrough.py','scripts/studio-v4/capture-native-recovery.py']
def hashes():return {f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in FILES}
START=hashes();STATES=[];PASSED=False
(OUT/'probe.py').write_bytes(Path(__file__).read_bytes())
async def skip_thumbnails(self,pw):pass
nv.NativeViewer.thumbnails=skip_thumbnails

async def verify(page,ctx,browser,errors,violations,denied,native,session):
    global PASSED
    tid='local-observation-template'
    failed={'id':tid,'name':'Quarterly story · LOCAL OBSERVATION','slide_count':2,
            'blueprint_generation_method':'llm','blueprint_enrichment_status':'failed',
            'blueprint_enrichment_error':'Prior structure error · supplied local record',
            'template_purity_status':'failed','template_purity_error':'Prior cleanup error · supplied local record'}
    queued={**failed,'blueprint_enrichment_status':'queued'}
    ready={**queued,'blueprint_enrichment_status':'complete','template_purity_status':'clean'}
    status_reply={**ready,'id':'wrong-template'};status_http=200
    calls=[];reads=[];themes_mode='loaded';status_gate=None;theme_gate=None
    themes=[{'id':'local-palette','name':'Quarterly palette · LOCAL','theme_payload':{'mode':'custom','primary_hex':'#246b62'},'is_standard':False}]
    async def template_route(route):
        r=route.request;u=urlparse(r.url)
        assert u.scheme=='http' and u.netloc=='127.0.0.1:8792' and not u.query,r.url
        if r.method=='POST' and u.path=='/api/templates':
            assert r.post_data_json['source_session_id']==walkthrough.SESSION
            assert r.post_data_json['source_presentation_id']==nv.PRESENTATION_ID
            calls.append({'path':u.path,'method':r.method,'supplied':failed});await route.fulfill(json=failed)
        elif r.method=='POST' and u.path==f'/api/templates/{tid}/enrich':
            calls.append({'path':u.path,'method':r.method,'supplied':{'id':tid,'blueprint_enrichment_status':'queued'}})
            await route.fulfill(json={'id':tid,'blueprint_enrichment_status':'queued'})
        elif r.method=='GET' and u.path==f'/api/templates/{tid}':
            reply=copy.deepcopy(status_reply);http=status_http
            reads.append({'path':u.path,'method':r.method,'http':http,'supplied':reply})
            if status_gate is not None:await status_gate.wait()
            await route.fulfill(status=http,json=reply)
        else:raise AssertionError((r.method,r.url))
    async def theme_route(route):
        r=route.request;u=urlparse(r.url)
        assert r.method=='GET' and u.scheme=='http' and u.netloc=='127.0.0.1:8792' and u.path=='/api/themes' and not u.query
        value={'themes':themes,'count':1} if themes_mode=='loaded' else {'themes':[],'count':0,**({'error':'Local supplied storage refusal'} if themes_mode=='refused' else {})}
        reads.append({'path':u.path,'method':'GET','http':200,'supplied':value})
        if theme_gate is not None:await theme_gate.wait()
        await route.fulfill(json=value)
    await ctx.route('**/api/templates',template_route)
    await ctx.route('**/api/templates/**',template_route)
    await ctx.route('**/api/themes',theme_route)
    dialog=page.locator('[data-studio-template-flow="save"]')
    def write():
        (OUT/'results.json').write_text(json.dumps({'passed':PASSED,'states':STATES,'source_start':START,'source_end':hashes(),
            'page_errors':errors,'violations':violations,'refused_writes':denied,'intercepted_setup_posts':calls,'intercepted_reads':reads,
            'layout_ref':nv.LAYOUT_REF,'scope':'Actual native Builder leaves. Supplied local intercepted responses only; no service writes, generation or persistence. Full timeout/owner races are separate actual-source tests.'},indent=2)+'\n')
    async def shot(name,area):
        assert not errors and not violations and not denied,(errors,violations,denied)
        await expect(area).to_be_visible()
        settled=await area.evaluate("""e=>new Promise((resolve,reject)=>{let last='',stable=0,frames=0;const step=()=>{const r=e.getBoundingClientRect();const key=[r.x,r.y,r.width,r.height].map(n=>Math.round(n*100)/100).join(',');stable=key===last?stable+1:0;last=key;if(stable>=8)return resolve({frames,rect:key});if(++frames>180)return reject(Error('Panel geometry did not settle'));requestAnimationFrame(step)};requestAnimationFrame(step)})""")
        info=await area.evaluate("e=>({text:e.innerText,rect:e.getBoundingClientRect().toJSON(),width:e.clientWidth,scrollWidth:e.scrollWidth,theme:document.documentElement.className,pageWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,viewportHeight:innerHeight,focus:document.activeElement?.outerHTML,fields:[...e.querySelectorAll('input,select,textarea')].map(x=>({label:x.getAttribute('aria-label'),value:x.value,disabled:x.disabled}))})")
        assert info['pageWidth']<=info['viewportWidth'] and info['scrollWidth']<=info['width']+1,info
        assert info['rect']['top']>=0 and info['rect']['bottom']<=info['viewportHeight']+1,info
        assert ('dark' in info['theme'].split()) == name.startswith('dark-'),info
        await page.screenshot(path=str(OUT/(name+'.png')))
        STATES.append({'name':name,'geometry_settled':settled,**info});write()
    async def open_save():
        await page.get_by_role('button',name='Template',exact=True).click()
        await page.get_by_role('menuitem',name='Save Template',exact=True).click()
        await expect(dialog).to_be_visible()
    async def close_save():await dialog.locator('.studio-template-flow-footer').get_by_role('button',name='Close',exact=True).click()
    try:
        await page.set_viewport_size({'width':1440,'height':900})
        await open_save();await dialog.get_by_label('Template name',exact=True).fill(failed['name'])
        await dialog.get_by_role('button',name='Save Template',exact=True).click()
        await expect(dialog).to_have_count(0);await open_save()
        await dialog.get_by_role('button',name='Retry optimization',exact=True).click()
        await expect(dialog.locator('[data-template-observation]')).to_have_attribute('data-template-observation','paused',timeout=12000)
        await dialog.locator('summary').click()
        await expect(dialog).to_contain_text(failed['template_purity_error'])
        await shot('light-save-mismatched-terminal-paused',dialog)
        status_http=503;status_reply={'error':'Local supplied read refusal'}
        await dialog.get_by_role('button',name='Refresh status',exact=True).click()
        await expect(dialog.locator('[data-template-observation]')).to_have_attribute('data-template-observation','paused')
        await expect(dialog).to_contain_text(failed['name']);await expect(dialog).to_contain_text(failed['template_purity_error'])
        await shot('light-save-refused-read-retains-card-history',dialog)
        await close_save()
        await page.get_by_role('button',name='Mode',exact=True).click()
        await page.get_by_role('menuitemradio',name='Dark',exact=True).click()
        await expect(page.locator('html')).to_have_class('dark');await open_save()
        await page.set_viewport_size({'width':390,'height':844})
        refresh=dialog.locator('[data-template-observation] button')
        await page.keyboard.press('Tab')
        for _ in range(40):
            if await refresh.evaluate('e=>e===document.activeElement'):break
            await page.keyboard.press('Tab')
        await expect(refresh).to_be_focused()
        await shot('dark-narrow-save-paused-refresh-keyboard-focus',dialog)
        await page.set_viewport_size({'width':1440,'height':600})
        await expect(refresh).to_be_focused()
        await shot('dark-short-save-paused-controls',dialog)
        await page.set_viewport_size({'width':390,'height':844})
        status_http=200;status_reply=queued;status_gate=asyncio.Event()
        await page.keyboard.press('Enter')
        await expect(refresh).to_have_attribute('aria-disabled','true')
        assert await refresh.evaluate('e=>e.disabled') is False
        await expect(dialog.locator('.studio-template-flow-footer').get_by_role('button',name='Close',exact=True)).to_be_enabled()
        await expect(dialog.locator('.studio-template-flow-footer').get_by_role('button',name='Save Template',exact=True)).to_be_disabled()
        await expect(refresh).to_be_focused()
        await shot('dark-narrow-save-pending-read-retains-keyboard-focus',dialog)
        status_gate.set();status_gate=None
        await expect(dialog.locator('[data-template-observation]')).to_have_count(0)
        await expect(dialog.locator('[data-template-status]')).to_have_attribute('data-template-status','optimizing')
        await expect(dialog.locator('[data-template-status]')).to_be_focused()
        await shot('dark-narrow-save-matching-read-resumes-checks',dialog)
        status_reply={**ready,'id':'wrong-template'}
        await expect(dialog.locator('[data-template-observation]')).to_have_attribute('data-template-observation','paused',timeout=12000)
        status_reply=ready
        await dialog.get_by_role('button',name='Refresh status',exact=True).click()
        await expect(dialog.locator('[data-template-status]')).to_have_attribute('data-template-status','ready')
        await expect(dialog.locator('[data-template-observation]')).to_have_count(0)
        await shot('dark-narrow-save-exact-ready-read',dialog)
        assert len(calls)==2 and all(x['method']=='POST' for x in calls),calls
        # Fresh owned test page avoids the populated sessionStorage specimen.
        session.update(currentStage=1,finalPresentationId=None,finalPresentationUrl=None);session['stateCache']={}
        await page.close();page=await ctx.new_page();page.set_default_timeout(20000)
        await page.set_viewport_size({'width':1440,'height':900})
        response=await page.goto(nv.BASE+'/builder?session_id='+walkthrough.SESSION,wait_until='domcontentloaded');assert response.status==200
        trigger=page.get_by_role('button',name='Build theme',exact=True)
        await expect(trigger).to_be_enabled();await trigger.click()
        menu=page.locator('[data-studio-composer-menu="theme"]')
        selection=menu.get_by_label('Saved theme',exact=True)
        await expect(selection.locator('option[value="local-palette"]')).to_have_count(1)
        await selection.select_option('local-palette')
        await menu.get_by_label('Theme name',exact=True).fill('Keep this unsaved theme name')
        await shot('light-theme-loaded-selected-draft',menu)
        await page.keyboard.press('Escape');themes_mode='refused';await trigger.click()
        await expect(menu.locator('[data-studio-theme-read-error="true"]')).to_be_visible()
        await expect(selection).to_have_value('local-palette')
        await expect(menu.get_by_label('Theme name',exact=True)).to_have_value('Keep this unsaved theme name')
        await expect(menu.get_by_label('Brand hex color',exact=True)).to_have_value('#246b62')
        await shot('light-theme-refusal-retains-library-selection-draft',menu)
        retry=menu.locator('[data-studio-theme-read-refresh="true"]')
        await expect(retry).to_have_accessible_name('Retry loading saved themes')
        themes_mode='loaded';await retry.click()
        await expect(menu.locator('[data-studio-theme-read-error="true"]')).to_have_count(0)
        await expect(selection).to_have_value('local-palette')
        await shot('light-theme-read-recovered',menu)
        await page.keyboard.press('Escape');themes_mode='refused';await trigger.click()
        await expect(menu.locator('[data-studio-theme-read-error="true"]')).to_be_visible()
        await page.set_viewport_size({'width':1440,'height':600})
        await shot('light-short-theme-refusal-controls',menu)
        await page.set_viewport_size({'width':390,'height':844})
        await page.keyboard.press('Tab')
        for _ in range(40):
            if await retry.evaluate('e=>e===document.activeElement'):break
            await page.keyboard.press('Tab')
        await expect(retry).to_be_focused()
        await shot('light-narrow-theme-retry-keyboard-focus',menu)
        themes_mode='empty';theme_gate=asyncio.Event();await page.keyboard.press('Enter')
        await expect(retry).to_have_attribute('aria-disabled','true')
        assert await retry.evaluate('e=>e.disabled') is False
        await expect(retry).to_be_focused()
        await shot('light-narrow-theme-pending-read-retains-keyboard-focus',menu)
        theme_gate.set();theme_gate=None
        await expect(selection.locator('option')).to_have_count(1)
        await expect(retry).to_have_accessible_name('Refresh saved themes')
        await expect(retry).to_be_focused()
        await expect(menu.locator('[data-studio-theme-read-error="true"]')).to_have_count(0)
        await expect(menu.get_by_label('Theme name',exact=True)).to_have_value('Keep this unsaved theme name')
        await shot('light-narrow-theme-confirmed-empty-success',menu)
        # Supply the existing theme-provider preference in a fresh owned page;
        # inspect the actual class rather than infer theme from a filename.
        await page.close();page=await ctx.new_page();page.set_default_timeout(20000)
        themes_mode='loaded';await page.set_viewport_size({'width':1440,'height':900})
        response=await page.goto(nv.BASE+'/builder?session_id='+walkthrough.SESSION,wait_until='domcontentloaded');assert response.status==200
        trigger=page.get_by_role('button',name='Build theme',exact=True);await expect(trigger).to_be_enabled()
        await page.evaluate("()=>{localStorage.setItem('theme','dark');dispatchEvent(new StorageEvent('storage',{key:'theme',newValue:'dark',oldValue:'light',storageArea:localStorage,url:location.href}))}")
        await expect(page.locator('html')).to_have_class('dark')
        await trigger.click()
        menu=page.locator('[data-studio-composer-menu="theme"]');selection=menu.get_by_label('Saved theme',exact=True)
        await expect(selection.locator('option[value="local-palette"]')).to_have_count(1);await selection.select_option('local-palette')
        await page.keyboard.press('Escape');themes_mode='refused';await trigger.click()
        await expect(menu.locator('[data-studio-theme-read-error="true"]')).to_be_visible();await expect(selection).to_have_value('local-palette')
        await shot('dark-theme-refusal-retains-cached-selection',menu)
        await page.set_viewport_size({'width':390,'height':844});retry=menu.locator('[data-studio-theme-read-refresh="true"]')
        await page.keyboard.press('Tab')
        for _ in range(40):
            if await retry.evaluate('e=>e===document.activeElement'):break
            await page.keyboard.press('Tab')
        await expect(retry).to_be_focused();await shot('dark-narrow-theme-retry-keyboard-focus',menu)
        assert START==hashes(),'Source changed during capture'
        assert [s['name'] for s in STATES]==['light-save-mismatched-terminal-paused','light-save-refused-read-retains-card-history',
            'dark-narrow-save-paused-refresh-keyboard-focus','dark-short-save-paused-controls','dark-narrow-save-pending-read-retains-keyboard-focus','dark-narrow-save-matching-read-resumes-checks','dark-narrow-save-exact-ready-read',
            'light-theme-loaded-selected-draft','light-theme-refusal-retains-library-selection-draft','light-theme-read-recovered',
            'light-short-theme-refusal-controls','light-narrow-theme-retry-keyboard-focus','light-narrow-theme-pending-read-retains-keyboard-focus','light-narrow-theme-confirmed-empty-success',
            'dark-theme-refusal-retains-cached-selection','dark-narrow-theme-retry-keyboard-focus']
        PASSED=True
    finally:
        await page.screenshot(path=str(OUT/'final-state.png'))
        (OUT/'final-state.txt').write_text(page.url+'\n'+await page.locator('body').inner_text());write()

mod=types.ModuleType('verify_walkthrough');mod.verify=verify;sys.modules['verify_walkthrough']=mod
import walkthrough
sys.argv=['walkthrough.py','--verify','--headless','--status-path',str(OUT/'status.json')]
asyncio.run(walkthrough.main())
