"""Native workspace continuity after CSS convergence; no connected services/writes."""
import asyncio,sys,types,json,hashlib
from pathlib import Path
from playwright.async_api import expect
sys.path.insert(0,str(Path(__file__).resolve().parent));import native_viewer as nv
ROOT=Path('/Users/pk1980/Software/Deckster/.worktrees/studio-v4-uat-20261001');OUT=Path(sys.argv[1]);OUT.mkdir(parents=True,exist_ok=True)
nv.SAMPLE=json.loads(Path('/private/tmp/studio-v4-visual-convergence-accepted-source-light/sample.json').read_text())
async def skip(self,pw):pass
nv.NativeViewer.thumbnails=skip
names=['app/builder/page.tsx','components/presentation-viewer.tsx','components/builder/studio-canvas.css','components/builder/studio-workspace.css','components/builder/studio-panels.css','components/layout/studio-shell.css','components/studio-presentation.css','components/studio-thumbnails.css']
def hashes():return {n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in names}
start=hashes();states=[];passed=False
(OUT/'probe.py').write_bytes(Path(__file__).read_bytes());(OUT/'sample.json').write_text(json.dumps(nv.SAMPLE,indent=2)+'\n')
async def verify(page,ctx,browser,errors,violations,denied,native,session):
 global passed
 iframe=page.get_by_title('Presentation Viewer',exact=True);element=await iframe.element_handle();frame=iframe.content_frame;doc=await frame.locator('.reveal').element_handle()
 async def continuity():
  assert await element.evaluate('e=>e===document.querySelector(\'iframe[title="Presentation Viewer"]\')&&e.isConnected')
  assert await doc.evaluate('e=>e.isConnected')
 async def shot(name):
  await continuity();await page.screenshot(path=str(OUT/(name+'.png')));states.append({'name':name,'actualTheme':await page.locator('html').get_attribute('class'),'iframe':await iframe.bounding_box()})
 try:
  await page.set_viewport_size({'width':1440,'height':900});await expect(page.get_by_role('button',name='Mode',exact=True)).to_be_enabled()
  chat=page.get_by_label('Message Director',exact=True);await chat.fill('Retain this unsent visual-convergence conversation draft.')
  await frame.locator('section.present .slide-title').click();
  if await frame.locator('body').get_attribute('data-mode')!='edit':await page.keyboard.press('e')
  await expect(frame.locator('body')).to_have_attribute('data-mode','edit')
  target=frame.locator('#local-visual-text');await target.hover();await target.get_by_role('button',name='Refine element',exact=True).click();prompt=page.get_by_role('textbox',name='Generation prompt',exact=True);await prompt.fill('Retain this unsent native Text Box refinement draft.');await shot('wide-light-inspector-drafts')
  await page.set_viewport_size({'width':1030,'height':600});await page.get_by_role('button',name='Mode',exact=True).click();await page.get_by_role('menuitemradio',name='Dark',exact=True).click();await expect(page.locator('html')).to_have_class('dark');await expect(prompt).to_have_value('Retain this unsent native Text Box refinement draft.');await shot('short-dark-same-native-target-draft')
  await prompt.click();await page.keyboard.press('Escape');await expect(prompt).not_to_be_visible();await page.get_by_title('Present fullscreen',exact=True).click();await expect(page.locator('[data-studio-v4-fullscreen=true]')).to_be_visible()
  exitButton=page.get_by_title('Exit fullscreen (ESC)',exact=True)
  for _ in range(100):
   if await exitButton.evaluate('e=>e===document.activeElement'):break
   await page.keyboard.press('Tab')
  await expect(exitButton).to_be_focused();await shot('dark-native-Present')
  await page.keyboard.press('Enter');await expect(page.locator('[data-studio-v4-fullscreen=true]')).to_have_count(0);await continuity();await shot('dark-native-Exit')
  await page.set_viewport_size({'width':1440,'height':900});await expect(chat).to_have_value('Retain this unsent visual-convergence conversation draft.');await frame.locator('section.present .slide-title').click();
  if await frame.locator('body').get_attribute('data-mode')!='edit':await page.keyboard.press('e')
  await expect(frame.locator('body')).to_have_attribute('data-mode','edit');await target.hover();await target.get_by_role('button',name='Refine element',exact=True).click();await expect(prompt).to_have_value('Retain this unsent native Text Box refinement draft.');await shot('wide-return-same-native-drafts')
  assert not errors and not violations and not denied and hashes()==start
  passed=True
 finally:(OUT/'results.json').write_text(json.dumps({'passed':passed,'states':states,'source_start':start,'source_end':hashes(),'page_errors':errors,'violations':violations,'refused_writes':denied,'layout_ref':nv.LAYOUT_REF,'scope':'Same native iframe/document and local unsent drafts through resize/theme/Present/Exit; no browser-level Escape, mutation or persistence proof.'},indent=2)+'\n')
mod=types.ModuleType('verify_walkthrough');mod.verify=verify;sys.modules['verify_walkthrough']=mod
import walkthrough
sys.argv=['walkthrough.py','--verify','--headless','--status-path',str(OUT/'status.json')]
asyncio.run(walkthrough.main())
