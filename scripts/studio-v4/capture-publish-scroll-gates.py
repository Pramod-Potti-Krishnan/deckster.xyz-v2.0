"""Actual management Voice scroll reachability; synthetic records, no writes."""
import asyncio, hashlib, json, sys, types
from pathlib import Path
from playwright.async_api import expect, TimeoutError
sys.path.insert(0, str(Path(__file__).resolve().parent))
import native_viewer as nv

ROOT = Path('/Users/pk1980/Software/Deckster/.worktrees/studio-v4-uat-20261001')
OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
names = ['components/publish-dialog.tsx', 'components/narration-voice-picker.tsx', 'components/studio-publish.css']
def hashes(): return {n: hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in names}
start = hashes(); states = []; passed = False
(OUT/'probe.py').write_bytes(Path(__file__).read_bytes())
async def skip(self, pw): pass
nv.NativeViewer.thumbnails = skip

async def verify(page, ctx, browser, errors, violations, denied, native, session):
    global passed
    async def published(route):
        assert route.request.method=='GET'
        await route.fulfill(json={'deck':walkthrough.PUBLISHED,'staleness':'unknown','currentSlideCount':2})
    async def voices(route):
        assert route.request.method=='GET'
        await route.fulfill(json=json.loads((ROOT/'scripts/studio-v4/narration-voice-fixture.json').read_text()))
    await ctx.route('**/api/publish/by-session/'+walkthrough.SESSION+'*',published)
    await ctx.route('**/api/narration/voice?*',voices)
    try:
        await page.get_by_role('button', name='Mode', exact=True).click()
        await page.get_by_role('menuitemradio', name='Dark', exact=True).click()
        await expect(page.locator('html')).to_have_class('dark')
        await page.get_by_role('button', name='Publish', exact=True).click()
        dialog = page.locator('[data-studio-publish=true]')
        await dialog.get_by_role('tab', name='Voice', exact=False).click()
        await expect(dialog.locator('[data-studio-voice-card=true]')).to_have_count(9)
        for label, w, h in [('dark-1440x900',1440,900), ('dark-1030x450',1030,450), ('dark-390x844',390,844)]:
            await page.set_viewport_size({'width':w,'height':h})
            body = dialog.locator('.studio-publish-body')
            rect = await body.bounding_box()
            await page.mouse.move(rect['x']+rect['width']/2,rect['y']+rect['height']/2)
            for attempt in range(2):
                await page.mouse.wheel(0,4000)
                try:
                    await page.wait_for_function('()=>{const b=document.querySelector(".studio-publish-body");return b.scrollTop+b.clientHeight>=b.scrollHeight-2}',timeout=2000)
                    break
                except TimeoutError:
                    if attempt==1:raise
            rect=await body.bounding_box()
            script = dialog.get_by_role('button',name='Write the script',exact=True)
            record = dialog.get_by_role('button',name='Record the narration',exact=True)
            await expect(script).to_be_enabled(); await expect(record).to_be_disabled()
            box = await record.bounding_box(); footer = await dialog.locator('.studio-publish-management-actions').bounding_box()
            metrics=await record.evaluate('e=>{const b=document.querySelector(".studio-publish-body");return {body:{scrollTop:b.scrollTop,scrollHeight:b.scrollHeight,clientHeight:b.clientHeight},ancestors:[e.parentElement,e.parentElement.parentElement].map(p=>({class:p.className,rect:p.getBoundingClientRect().toJSON(),overflow:getComputedStyle(p).overflow,display:getComputedStyle(p).display}))}}')
            (OUT/(label+'-scroll-metrics.json')).write_text(json.dumps({'record':box,'footer':footer,**metrics},indent=2)+'\n')
            await page.screenshot(path=str(OUT/(label+'-observed.png')))
            assert box['y'] >= rect['y'] and box['y']+box['height'] <= footer['y'], (label,box,footer)
            assert await record.evaluate('e=>{const r=e.getBoundingClientRect();const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return getComputedStyle(e).pointerEvents==="none"?e.parentElement.contains(top):e.contains(top)}')
            await page.screenshot(path=str(OUT/(label+'-record-gates-visible.png')))
            states.append({'name':label,'actualTheme':await page.locator('html').get_attribute('class'),'record':box,'footer':footer,'scriptEnabled':True,'recordDisabled':True})
        assert len(states)==3 and not errors and not violations and not denied and start==hashes()
        passed = True
    finally:
        (OUT/'results.json').write_text(json.dumps({'passed':passed,'states':states,'source_start':start,'source_end':hashes(),'page_errors':errors,'violations':violations,'refused_writes':denied,'scope':'Actual management Voice controls visible after wheel scrolling; storage-unavailable fixture. No script, recording, publication or persistence.'},indent=2)+'\n')
mod=types.ModuleType('verify_walkthrough'); mod.verify=verify; sys.modules['verify_walkthrough']=mod
import walkthrough
sys.argv=['walkthrough.py','--verify','--headless','--status-path',str(OUT/'status.json')]
asyncio.run(walkthrough.main())
