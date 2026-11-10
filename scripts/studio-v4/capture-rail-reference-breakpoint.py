"""Narrow reference clarification: actual rail/session edges, including780/781 boundary."""
import asyncio,ast,hashlib,json,subprocess,sys,types
from pathlib import Path
from playwright.async_api import expect
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).resolve().parent))
import native_viewer as nv
OUT=Path(sys.argv[1]);OUT.mkdir(parents=True,exist_ok=True)
# Retain all prior shared-input roots, without executing the broad capture module.
producer=ROOT/'scripts/studio-v4/capture-shared-navigation-account.py'
assignment=next(n for n in ast.parse(producer.read_text()).body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='FILES' for t in n.targets))
FILES=[n.value for n in assignment.value.elts if isinstance(n,ast.Constant)]+[str(producer.relative_to(ROOT)),'scripts/test-studio-navigation-fidelity.mjs',str(Path(__file__).relative_to(ROOT))]
def hashes():return {p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in FILES}
START=hashes();COMMIT=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip();STATES=[];PASSED=False
(OUT/'probe.py').write_bytes(Path(__file__).read_bytes())
async def skip(self,pw):pass
nv.NativeViewer.thumbnails=skip
async def verify(page,ctx,browser,errors,violations,denied,native,session):
 global PASSED
 def result():
  (OUT/'results.json').write_text(json.dumps({'passed':PASSED,'source_commit':COMMIT,'source_start':START,'source_end':hashes(),'states':STATES,'page_errors':errors,'violations':violations,'refused_writes':denied,'browser':browser.version,'layout_ref':nv.LAYOUT_REF,'scope':'Actual isolated local frontend with supplied read-only records; four focused viewport/rail/session states. Prior account menu/usage/default-off proof reused only for unchanged source. No service writes, shared browser operation, server restart or native renderer correction.'},indent=2)+'\n')
 async def rect(loc):return await loc.evaluate('e=>e.getBoundingClientRect().toJSON()')
 try:
  composer=page.get_by_role('textbox',name='Message Director',exact=True);await composer.fill('Unsent reference breakpoint review draft')
  cases=[('desktop-1440',1440,900,56),('desktop-boundary-781',781,700,56),('narrow-boundary-780',780,700,48),('narrow-390',390,844,48)]
  for name,width,height,wanted in cases:
   await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(400)
   rail=page.locator('[data-studio-v4-rail="true"]');r=await rect(rail);assert r['width']==wanted and r['right']==wanted,r
   await expect(composer).to_have_value('Unsent reference breakpoint review draft')
   trigger=page.locator('[data-studio-profile-trigger="true"]');await expect(trigger).to_be_visible();tr=await rect(trigger);av=await rect(trigger.locator('[data-studio-profile-avatar="true"]'));assert tr['width']==40 and tr['height']==40 and av['width']==30 and av['height']==30
   button=page.get_by_role('button',name='Open deck list',exact=True);await expect(button).to_be_visible();await button.click()
   panel=page.locator('[data-studio-v4-session-list][data-studio-v4-session-open="true"]');await expect(panel).to_be_visible();await page.wait_for_timeout(450);opened=await rect(panel);assert opened['x']==wanted,opened
   viewport=await page.evaluate('({width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth})');assert viewport['pageWidth']<=width,viewport
   assert not errors and not violations and not denied,(errors,violations,denied)
   await page.screenshot(path=str(OUT/(name+'-sessions-open.png')))
   await page.get_by_role('button',name='Close sessions',exact=True).click();panel=page.locator('[data-studio-v4-session-list][data-studio-v4-session-open="false"]');await expect(panel).to_have_count(1);await page.wait_for_timeout(450);closed=await rect(panel);assert closed['right']<=0,closed
   await expect(composer).to_have_value('Unsent reference breakpoint review draft')
   STATES.append({'name':name+'-sessions-open','viewport':viewport,'rail':r,'expectedWidth':wanted,'sharedWidthVariable':await rail.evaluate('e=>getComputedStyle(e).getPropertyValue("--ss-rail-width").trim()'),'trigger':tr,'avatar':av,'sessionsOpen':opened,'sessionsClosed':closed,'draftRetained':True});result()
  assert [s['name'] for s in STATES]==[c[0]+'-sessions-open' for c in cases] and START==hashes() and not errors and not violations and not denied
  PASSED=True
 finally:result();await page.screenshot(path=str(OUT/'final-state.png'))
mod=types.ModuleType('verify_walkthrough');mod.verify=verify;sys.modules['verify_walkthrough']=mod
import walkthrough
sys.argv=['walkthrough.py','--verify','--headless','--status-path',str(OUT/'status.json')]
asyncio.run(walkthrough.main())
