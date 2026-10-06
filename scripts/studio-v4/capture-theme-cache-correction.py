"""Four changed native theme-cache states only; exact local intercepted GETs."""
import asyncio,copy,hashlib,json,sys,types
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import expect
expect.set_options(timeout=20000)
sys.path.insert(0,str(Path(__file__).resolve().parent))
import native_viewer as nv
ROOT=Path(__file__).resolve().parents[2];OUT=Path(sys.argv[1]);OUT.mkdir(parents=True,exist_ok=True)
FILES=['components/builder/chat-input.tsx','hooks/use-theme-profiles.ts','hooks/use-templates.ts','lib/theme-builder.ts','scripts/studio-v4/walkthrough.py','scripts/studio-v4/capture-theme-cache-correction.py']
def hashes():return {p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in FILES}
START=hashes();STATES=[];PASSED=False
(OUT/'probe.py').write_bytes(Path(__file__).read_bytes())
async def skip_thumbnails(self,pw):pass
nv.NativeViewer.thumbnails=skip_thumbnails
async def verify(page,ctx,browser,errors,violations,denied,native,session):
    global PASSED
    profiles=[{'id':'local-A','name':'Palette A · LOCAL','theme_payload':{'mode':'custom','primary_hex':'#123456'}},{'id':'local-B','name':'Palette B · LOCAL','theme_payload':{'mode':'custom','primary_hex':'#456789'}}]
    payload={'themes':profiles,'count':2};gate=None;reads=[]
    async def themes(route):
        req=route.request;u=urlparse(req.url)
        assert req.method=='GET' and u.scheme=='http' and u.netloc=='127.0.0.1:8792' and u.path=='/api/themes' and not u.query
        supplied=copy.deepcopy(payload);reads.append({'path':u.path,'method':'GET','supplied':supplied})
        if gate is not None:await gate.wait()
        await route.fulfill(json=supplied)
    async def presets(route):
        assert route.request.method=='GET' and route.request.url==walkthrough.PRESETS_URL
        await route.fulfill(json=[{'preset_id':'corporate_light','name':'Corporate Light','description':'Clean business theme with a blue brand base'},{'preset_id':'minimal','name':'Minimal','description':'Quiet, restrained theme for simple narratives'}])
    await ctx.route('**/api/themes',themes);await ctx.route(walkthrough.PRESETS_URL,presets)
    def write():
        (OUT/'results.json').write_text(json.dumps({'passed':PASSED,'states':STATES,'source_start':START,'source_end':hashes(),'page_errors':errors,'violations':violations,'refused_writes':denied,'intercepted_reads':reads,'scope':'Actual native leaf with local supplied GETs only; no writes/services/persistence. Four changed cache cases; previous unchanged16-state matrix not repeated.'},indent=2)+'\n')
    async def fresh():
        nonlocal page
        await page.close();session.update(currentStage=1,finalPresentationId=None,finalPresentationUrl=None);session['stateCache']={}
        page=await ctx.new_page();page.set_default_timeout(20000);await page.set_viewport_size({'width':1440,'height':900})
        response=await page.goto(nv.BASE+'/builder?session_id='+walkthrough.SESSION,wait_until='domcontentloaded');assert response.status==200
        trigger=page.get_by_role('button',name='Build theme',exact=True);await expect(trigger).to_be_enabled();await trigger.click()
        return trigger,page.locator('[data-studio-composer-menu="theme"]')
    async def shot(name,menu):
        assert not errors and not violations and not denied,(errors,violations,denied)
        await expect(menu).to_be_visible();await expect(menu.locator('[data-studio-theme-read-refresh]')).not_to_have_attribute('aria-busy','true')
        info=await menu.evaluate("e=>({text:e.innerText,theme:document.documentElement.className,rect:e.getBoundingClientRect().toJSON(),pageWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,fields:[...e.querySelectorAll('input,select')].map(x=>({label:x.getAttribute('aria-label'),value:x.value})),focus:document.activeElement?.outerHTML})")
        assert info['theme']=='light' and info['pageWidth']<=info['viewportWidth'],info
        await page.screenshot(path=str(OUT/(name+'.png')));STATES.append({'name':name,**info});write()
    try:
        gate=asyncio.Event();trigger,menu=await fresh()
        await expect(menu.locator('[data-studio-theme-read-refresh]')).to_have_attribute('aria-busy','true')
        brand=menu.get_by_label('Brand hex color',exact=True);await brand.fill('#abcdef')
        gate.set();gate=None
        saved=menu.get_by_label('Saved theme',exact=True)
        await expect(saved.locator('option')).to_have_count(3);await expect(brand).to_have_value('#abcdef')
        await expect(menu.locator('[data-studio-theme-read-empty]')).to_have_count(0)
        await shot('light-initial-brand-race-real-library',menu)
        gate=asyncio.Event();trigger,menu=await fresh()
        await expect(menu.locator('[data-studio-theme-read-refresh]')).to_have_attribute('aria-busy','true')
        preset=menu.get_by_label('Build theme preset',exact=True);await expect(preset.locator('option[value="corporate_light"]')).to_have_count(1);await preset.select_option('corporate_light')
        gate.set();gate=None;saved=menu.get_by_label('Saved theme',exact=True)
        await expect(saved.locator('option')).to_have_count(3);await expect(preset).to_have_value('corporate_light')
        await expect(menu.locator('[data-studio-theme-read-empty]')).to_have_count(0)
        await shot('light-initial-preset-race-real-library',menu)
        await saved.select_option('local-A');await menu.get_by_label('Theme name',exact=True).fill('Keep this unsent name')
        await page.keyboard.press('Escape');payload={'themes':[],'count':0,'error':'Local supplied refusal'};await trigger.click()
        await expect(menu.locator('[data-studio-theme-read-error]')).to_be_visible()
        payload={'themes':[profiles[0]],'count':1};gate=asyncio.Event();retry=menu.locator('[data-studio-theme-read-refresh]');await retry.click()
        await expect(retry).to_have_attribute('aria-busy','true');await saved.select_option('local-B')
        gate.set();gate=None
        await expect(retry).not_to_have_attribute('aria-busy','true');await expect(saved.locator('option')).to_have_count(3);await expect(saved).to_have_value('local-B')
        await expect(menu.locator('[data-studio-theme-read-error]')).to_be_visible();await expect(menu.get_by_label('Brand hex color',exact=True)).to_have_value('#456789')
        await shot('light-stale-read-retains-choice-cache-refusal',menu)
        payload={'themes':[],'count':0};await retry.click()
        await expect(saved.locator('option')).to_have_count(1);await expect(menu.locator('[data-studio-theme-read-empty]')).to_be_visible();await expect(menu.locator('[data-studio-theme-read-error]')).to_have_count(0)
        await expect(menu.get_by_label('Theme name',exact=True)).to_have_value('Keep this unsent name')
        await expect(menu.get_by_label('Brand hex color',exact=True)).to_have_value('#456789')
        await shot('light-confirmed-empty-read-keeps-draft',menu)
        assert START==hashes() and [s['name'] for s in STATES]==['light-initial-brand-race-real-library','light-initial-preset-race-real-library','light-stale-read-retains-choice-cache-refusal','light-confirmed-empty-read-keeps-draft']
        PASSED=True
    finally:
        if gate is not None:gate.set()
        await page.screenshot(path=str(OUT/'final-state.png'));(OUT/'final-state.txt').write_text(page.url+'\n'+await page.locator('body').inner_text());write()
mod=types.ModuleType('verify_walkthrough');mod.verify=verify;sys.modules['verify_walkthrough']=mod
import walkthrough
sys.argv=['walkthrough.py','--verify','--headless','--status-path',str(OUT/'status.json')]
asyncio.run(walkthrough.main())
