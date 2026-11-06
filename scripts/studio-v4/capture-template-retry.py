"""Actual native retry consumers with supplied intercepted local records only."""
import asyncio, copy, hashlib, json, sys, types
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import expect
expect.set_options(timeout=20000)
sys.path.insert(0, str(Path(__file__).resolve().parent))
import native_viewer as nv
ROOT = Path(__file__).resolve().parents[2]
OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
NAMES = ['components/builder/template-picker.tsx', 'components/template-save-dialog.tsx',
         'hooks/use-templates.ts', 'lib/template-retry-acknowledgement.ts',
         'app/builder/page.tsx', 'scripts/studio-v4/walkthrough.py',
         'scripts/studio-v4/capture-template-retry.py']
def hashes(): return {n: hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in NAMES}
START = hashes(); STATES = []; PASSED = False
(OUT/'probe.py').write_bytes(Path(__file__).read_bytes())
async def skip_thumbnails(self, pw): pass
nv.NativeViewer.thumbnails = skip_thumbnails

async def verify(page, ctx, browser, errors, violations, denied, native, session):
    global PASSED
    tid = 'local-native-retry-template'
    initial = {'id':tid, 'name':'Quarterly story · LOCAL RETRY', 'slide_count':2,
               'blueprint_generation_method':'llm', 'blueprint_enrichment_status':'failed',
               'blueprint_enrichment_error':'Prior structure error · LOCAL supplied response',
               'template_purity_status':'failed', 'template_purity_error':'Prior cleanup error · LOCAL supplied response'}
    current = copy.deepcopy(initial)
    ack = {'id':tid, 'blueprint_enrichment_status':'queued'}
    calls = []; reads = []; phase = 'save'
    async def templates(route):
        nonlocal current
        r=route.request; u=urlparse(r.url)
        assert u.scheme=='http' and u.netloc=='127.0.0.1:8792' and not u.query, r.url
        if r.method=='POST' and u.path=='/api/templates':
            assert r.post_data_json['source_session_id']==walkthrough.SESSION
            assert r.post_data_json['source_presentation_id']==nv.PRESENTATION_ID
            calls.append({'phase':phase, 'path':u.path, 'method':r.method, 'supplied':initial})
            await route.fulfill(json=initial)
        elif r.method=='POST' and u.path==f'/api/templates/{tid}/enrich':
            calls.append({'phase':phase, 'path':u.path, 'method':r.method, 'supplied':copy.deepcopy(ack)})
            if ack['id']==tid: current={**current, **ack}
            await route.fulfill(json=ack)
        elif r.method=='GET' and u.path=='/api/templates':
            reads.append({'phase':phase,'path':u.path})
            await route.fulfill(json={'templates':[current]})
        elif r.method=='GET' and u.path==f'/api/templates/{tid}':
            reads.append({'phase':phase,'path':u.path,'supplied':copy.deepcopy(current)})
            await route.fulfill(json=current)
        else: raise AssertionError((r.method,u.path))
    await ctx.route('**/api/templates', templates)
    await ctx.route('**/api/templates/**', templates)
    save_dialog=page.locator('[data-studio-template-flow="save"]')
    picker=page.locator('[data-studio-template-picker="true"]')
    def write():
        (OUT/'results.json').write_text(json.dumps({'passed':PASSED,'states':STATES,
            'source_start':START,'source_end':hashes(),'page_errors':errors,'violations':violations,
            'refused_writes':denied,'intercepted_local_post_responses':calls,'template_reads':reads,
            'layout_ref':nv.LAYOUT_REF,'scope':'Actual Builder Save and generation picker. Local supplied records and intercepted responses; no service/save/generation/persistence proof. Polling budget tested separately with fake clock.'},indent=2)+'\n')
    async def shot(name, area):
        assert not errors and not violations and not denied, (errors,violations,denied)
        await expect(area).to_be_visible()
        info=await area.evaluate("e=>({text:e.innerText,rect:e.getBoundingClientRect().toJSON(),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,focus:document.activeElement?.outerHTML,theme:document.documentElement.className,pageWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,viewportHeight:innerHeight})")
        assert info['pageWidth']<=info['viewportWidth'], info
        assert info['scrollWidth']<=info['clientWidth']+1, info
        await page.screenshot(path=str(OUT/(name+'.png')))
        STATES.append({'name':name,**info}); write()
    async def open_save():
        await page.get_by_role('button',name='Template',exact=True).click()
        await page.get_by_role('menuitem',name='Save Template',exact=True).click()
        await expect(save_dialog).to_be_visible()
    async def theme(dark):
        await page.get_by_role('button',name='Mode',exact=True).click()
        await page.get_by_role('menuitemradio',name='Dark' if dark else 'Light',exact=True).click()
        await expect(page.locator('html')).to_have_class('dark' if dark else 'light')
    try:
        await page.set_viewport_size({'width':1440,'height':900})
        await open_save()
        await save_dialog.get_by_label('Template name',exact=True).fill('Quarterly story · LOCAL RETRY')
        await save_dialog.get_by_role('button',name='Save Template',exact=True).click()
        await expect(save_dialog).to_have_count(0)
        await open_save()
        await expect(save_dialog.get_by_role('button',name='Retry optimization',exact=True)).to_be_visible()
        await shot('light-save-initial-failure',save_dialog)
        await save_dialog.get_by_role('button',name='Retry optimization',exact=True).click()
        await expect(save_dialog.locator('[data-template-status]')).to_have_attribute('data-template-status','optimizing')
        await save_dialog.locator('summary').click()
        await expect(save_dialog.locator('[data-template-previous-errors]')).to_contain_text(initial['template_purity_error'])
        await shot('light-save-queued-retained-errors',save_dialog)
        await save_dialog.locator('.studio-template-flow-footer').get_by_role('button',name='Close',exact=True).click()
        await theme(True); await open_save()
        await expect(save_dialog.locator('[data-template-status]')).to_have_attribute('data-template-status','optimizing')
        if not await save_dialog.locator('details').evaluate('e=>e.open'): await save_dialog.locator('summary').click()
        await shot('dark-save-queued-history',save_dialog)
        current={**current,'blueprint_enrichment_status':'running','blueprint_enrichment_error':None,'template_purity_error':None}
        # Real five-second observation; previous history survives authoritative clears.
        for _ in range(90):
            if any(x.get('supplied',{}).get('blueprint_enrichment_status')=='running' for x in reads): break
            await asyncio.sleep(.1)
        assert any(x.get('supplied',{}).get('blueprint_enrichment_status')=='running' for x in reads)
        await expect(save_dialog.locator('[data-template-previous-errors]')).to_contain_text(initial['blueprint_enrichment_error'])
        await page.set_viewport_size({'width':390,'height':844})
        summary=save_dialog.locator('summary')
        await page.keyboard.press('Tab')
        for _ in range(40):
            if await summary.evaluate('e=>e===document.activeElement'): break
            await page.keyboard.press('Tab')
        await expect(summary).to_be_focused()
        assert await summary.evaluate("e=>e.matches(':focus-visible') && getComputedStyle(e).boxShadow!=='none'"), 'Visible keyboard focus required'
        await shot('dark-narrow-save-history-keyboard-focus',save_dialog)
        await save_dialog.locator('.studio-template-flow-footer').get_by_role('button',name='Close',exact=True).click()
        # Actual Builder workflow opens the existing generation picker, without
        # operating the separately owned /studio/templates workspace.
        phase='picker'; current=copy.deepcopy(initial)
        session.update(currentStage=1,finalPresentationId=None,finalPresentationUrl=None)
        session['stateCache']={}
        # A fresh owned test page avoids the populated specimen's legitimate
        # sessionStorage restore; the user's separate headed sample is untouched.
        await page.close()
        page=await ctx.new_page(); page.set_default_timeout(20000)
        picker=page.locator('[data-studio-template-picker="true"]')
        await page.set_viewport_size({'width':1440,'height':900})
        response=await page.goto(nv.BASE+'/builder?session_id='+walkthrough.SESSION+'&studio_action=templates',wait_until='domcontentloaded')
        assert response.status==200
        await expect(page.locator('[data-studio-v4-dialog="workflow"]')).to_be_visible()
        await expect(picker.locator('.stp-main')).to_have_attribute('aria-disabled','true')
        await shot('light-picker-initial-locked',picker)
        await picker.get_by_role('button',name='Retry optimization',exact=True).click()
        await expect(picker.locator('[data-status]')).to_have_attribute('data-status','optimizing')
        await expect(picker.locator('.stp-main')).to_have_attribute('aria-disabled','true')
        await expect(picker).to_contain_text('Previous attempt:')
        await expect(picker).to_contain_text('Current diagnostics:')
        await shot('light-picker-queued-retained-current-and-previous',picker)
        current={**current,'blueprint_enrichment_status':'complete','template_purity_status':'failed','blueprint_enrichment_error':None,'template_purity_error':'New cleanup error · LOCAL supplied response'}
        await expect(picker.locator('[data-status]')).to_have_attribute('data-status','needs_cleanup',timeout=12000)
        await expect(picker.locator('.stp-main')).to_have_attribute('aria-disabled','true')
        await shot('light-picker-observed-cleanup-failure',picker)
        ack={'id':'wrong-template','blueprint_enrichment_status':'queued'}
        await picker.get_by_role('button',name='Retry optimization',exact=True).click()
        await expect(page.get_by_text('Could not retry optimization',exact=True)).to_be_visible()
        await expect(picker.locator('[data-status]')).to_have_attribute('data-status','needs_cleanup')
        await shot('light-picker-mismatched-ack-rejected',picker)
        ack={'id':tid,'blueprint_enrichment_status':'queued','blueprint_enrichment_error':None,'template_purity_error':None}
        await picker.get_by_role('button',name='Retry optimization',exact=True).click()
        await expect(picker.locator('[data-status]')).to_have_attribute('data-status','optimizing')
        await expect(picker).not_to_contain_text('Current diagnostics:')
        await expect(picker).to_contain_text('Previous attempt:')
        await page.set_viewport_size({'width':390,'height':844})
        search=picker.get_by_role('textbox',name='Search saved templates',exact=True)
        await page.keyboard.press('Tab')
        for _ in range(40):
            if await search.evaluate('e=>e===document.activeElement'): break
            await page.keyboard.press('Tab')
        await expect(search).to_be_focused()
        await shot('light-narrow-picker-explicit-null-history-keyboard-focus',picker)
        await page.set_viewport_size({'width':1440,'height':900})
        current={**current,'blueprint_enrichment_status':'complete','template_purity_status':'clean'}
        await expect(picker.locator('[data-status]')).to_have_attribute('data-status','ready',timeout=12000)
        await expect(picker.locator('.stp-main')).to_have_attribute('aria-disabled','false')
        await expect(picker).to_contain_text('Previous attempt:')
        await shot('light-picker-observed-exact-ready',picker)
        assert START==hashes(), 'Source changed during capture'
        assert [s['name'] for s in STATES]==['light-save-initial-failure','light-save-queued-retained-errors',
            'dark-save-queued-history','dark-narrow-save-history-keyboard-focus',
            'light-picker-initial-locked','light-picker-queued-retained-current-and-previous',
            'light-picker-observed-cleanup-failure','light-picker-mismatched-ack-rejected',
            'light-narrow-picker-explicit-null-history-keyboard-focus','light-picker-observed-exact-ready']
        PASSED=True
    finally:
        await page.screenshot(path=str(OUT/'final-state.png'))
        (OUT/'final-state.txt').write_text(page.url+'\n'+await page.locator('body').inner_text())
        write()

mod=types.ModuleType('verify_walkthrough');mod.verify=verify;sys.modules['verify_walkthrough']=mod
import walkthrough
sys.argv=['walkthrough.py','--verify','--headless','--status-path',str(OUT/'status.json')]
asyncio.run(walkthrough.main())
