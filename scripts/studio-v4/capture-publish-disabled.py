"""Actual disabled Publish leaf, supplied props; local-only and temporary route."""
import asyncio,json,sys,types,hashlib,subprocess
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from playwright.async_api import expect
import native_viewer as nv
ROOT=Path('/Users/pk1980/Software/Deckster/.worktrees/studio-v4-uat-20261001');OUT=Path(sys.argv[1]);OUT.mkdir(parents=True,exist_ok=True)
fixture=ROOT/'scripts/studio-v4/visual-publish-trigger-fixture.tsx';route=ROOT/'app/studio-local-review/visual-publish-trigger/page.tsx';assert not route.exists()
route.parent.mkdir(parents=True,exist_ok=True);route.write_bytes(fixture.read_bytes())
(OUT/'fixture.tsx.txt').write_bytes(fixture.read_bytes());(OUT/'probe.py').write_bytes(Path(__file__).read_bytes())
names=['components/publish-dialog.tsx','components/builder/studio-canvas.css','components/layout/studio-shell.css','scripts/studio-v4/visual-publish-trigger-fixture.tsx']
def hashes():return {n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in names}
start=hashes();states=[]
async def skip(self,pw):pass
nv.NativeViewer.thumbnails=skip
async def verify(page,ctx,browser,errors,violations,denied,native,session):
 await ctx.route(nv.BASE+'/studio-local-review/visual-publish-trigger',lambda r:r.continue_())
 try:
  for name,dark in [('light',False),('dark',True)]:
   # Set the native theme control before navigating to the leaf specimen.
   await page.get_by_role('button',name='Mode',exact=True).click();await page.get_by_role('menuitemradio',name='Dark' if dark else 'Light',exact=True).click()
   # The walkthrough's light init script intentionally runs on each navigation;
   # a later explicit init script supplies the intended fixture theme here.
   await ctx.add_init_script("if(location.origin==='"+nv.BASE+"')localStorage.setItem('theme',"+json.dumps('dark' if dark else 'light')+")")
   r=await page.goto(nv.BASE+'/studio-local-review/visual-publish-trigger');assert r.status==200
   await expect(page.locator('html')).to_have_class('dark' if dark else 'light')
   control=page.get_by_role('button',name='Publish',exact=True);await expect(control).to_be_disabled()
   for state in ['normal','hover','keyboard-skip']:
    if state=='hover':await control.hover()
    if state=='keyboard-skip':
     await page.get_by_role('button',name='Before disabled control',exact=True).click();await page.keyboard.press('Tab');await expect(page.get_by_role('button',name='After disabled control',exact=True)).to_be_focused();assert not await control.evaluate('e=>e===document.activeElement')
    await page.screenshot(path=str(OUT/(name+'-disabled-'+state+'.png')))
    info=await control.evaluate("e=>{const s=getComputedStyle(e);return {disabled:e.disabled,focused:e===document.activeElement,title:e.title,color:s.color,background:s.backgroundColor,opacity:s.opacity,rect:e.getBoundingClientRect().toJSON()}}")
    states.append({'name':name+'-disabled-'+state,'actualTheme':await page.locator('html').get_attribute('class'),'control':info})
   if not dark:
    r=await page.goto(nv.BASE+'/builder?session_id=11111111-1111-4111-8111-111111111111');assert r.status==200;await expect(page.get_by_role('button',name='Mode',exact=True)).to_be_enabled(timeout=20000)
  assert len(states)==6 and not errors and not violations and not denied and hashes()==start
 finally:
  (OUT/'results.json').write_text(json.dumps({'passed':len(states)==6 and not errors and not violations and not denied and hashes()==start,'states':states,'source_start':start,'source_end':hashes(),'page_errors':errors,'violations':violations,'denied_writes':denied,'scope':'Actual PublishControls supplied disabled leaf props, not full Builder gate proof.'},indent=2)+'\n')
mod=types.ModuleType('verify_walkthrough');mod.verify=verify;sys.modules['verify_walkthrough']=mod
import walkthrough
sys.argv=['walkthrough.py','--verify','--headless','--status-path',str(OUT/'status.json')]
try:asyncio.run(walkthrough.main())
finally:
 assert route.read_bytes()==fixture.read_bytes();route.unlink();route.parent.rmdir()
