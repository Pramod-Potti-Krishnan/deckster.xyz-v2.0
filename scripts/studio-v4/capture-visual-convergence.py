"""Headless actual Studio + immutable native viewer; intercepted local records only."""
import argparse,asyncio,hashlib,json,subprocess,sys,types
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import native_viewer as nv
from playwright.async_api import expect
expect.set_options(timeout=20000)
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--phase',choices=['before','after'],required=True);p.add_argument('--case',choices=['all','light','dark','short','narrow'],default='all');opts=p.parse_args()
ROOT=Path('/Users/pk1980/Software/Deckster/.worktrees/studio-v4-uat-20261001');OUT=opts.output;OUT.mkdir(parents=True,exist_ok=True)
source_names=['components/builder/studio-canvas.css','components/builder/studio-workspace.css','components/builder/studio-panels.css','components/layout/studio-shell.css','components/studio-presentation.css','components/studio-thumbnails.css','components/publish-dialog.tsx','components/publish-wizard.tsx','components/publish-session-controls.tsx','components/narration-voice-picker.tsx','components/publish-qa-settings.tsx','components/studio-publish.css','components/studio-delivery.css','app/builder/page.tsx','components/presentation-viewer.tsx','scripts/studio-v4/walkthrough.py','scripts/studio-v4/native_viewer.py','scripts/studio-v4/capture-visual-convergence.py','scripts/studio-v4/narration-voice-fixture.json']
def hashes():return {n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in source_names}
start=hashes();commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
(OUT/'probe.py').write_bytes(Path(__file__).read_bytes());(OUT/'working-tree.patch').write_bytes(subprocess.check_output(['git','diff','HEAD','--','components','app'],cwd=ROOT))
async def skip_thumbnails(self,pw):pass
nv.NativeViewer.thumbnails=skip_thumbnails
# Existing renderer restoreTextBoxes wire format, synthetic content.
s=nv.SAMPLE['slides'][0];s['content']['rich_content']='';s['text_boxes']=[{'id':'local-visual-text','parent_slide_id':s['slide_id'],'position':{'grid_row':'7/15','grid_column':'3/29'},'component_type':'TEXT_BOX','content':'<p>LOCAL VISUAL REVIEW</p><p>Connect the priorities.<br>Keep the next decision clear.</p>','text_style':{'font_size':44},'z_index':1000,'generation_config':{'component_type':'TEXT_BOX','prompt':'Unchanged local visual source'}}]
(OUT/'sample.json').write_text(json.dumps(nv.SAMPLE,indent=2)+'\n')
async def verify(page,ctx,browser,errors,violations,denied,native,session):
 import walkthrough
 states=[];passed=False;mode='normal'
 async def published_route(route):
  nonlocal mode
  if route.request.method!='GET':violations.append('Unexpected publication method');await route.abort();return
  u=route.request.url
  data={'deck':None,'staleness':'unknown','currentSlideCount':2}
  if mode in ['drift','manage']:data['deck']={**walkthrough.PUBLISHED,'slideCount':1 if mode=='drift' else 2}
  await route.fulfill(json=data)
 await ctx.route('**/api/publish/by-session/'+walkthrough.SESSION+'*',published_route)
 async def voice_route(route):
  await route.fulfill(json=json.loads((ROOT/'scripts/studio-v4/narration-voice-fixture.json').read_text()))
 await ctx.route('**/api/narration/voice?*',voice_route)
 async def qa_source(route):await route.fulfill(json={'sources':[{'sourceRef':'local-source','sourceKind':'deck','sourceLabel':'Presentation content','chunkCount':2,'allowedForQa':True}]})
 await ctx.route('**/api/publish/fixture-shared-deck/qa-sources',qa_source)
 await ctx.route('**/api/publish/fixture-shared-deck/qa-corpus',lambda r:r.fulfill(json={'status':'ready'}))
 async def record(name,control=None):
  await page.wait_for_timeout(150)
  info=await page.evaluate("""()=>({viewport:{width:innerWidth,height:innerHeight},pageWidth:document.documentElement.scrollWidth,dialogs:[...document.querySelectorAll('[role=dialog]')].map(e=>({text:e.innerText,rect:e.getBoundingClientRect().toJSON(),scrollHeight:e.scrollHeight})),delivery:[...document.querySelectorAll('[data-studio-v4-delivery] button')].map(e=>{const s=getComputedStyle(e);return {text:e.innerText,title:e.title,disabled:e.disabled,focusVisible:e.matches(':focus-visible'),rect:e.getBoundingClientRect().toJSON(),color:s.color,background:s.backgroundColor,outline:s.outline,shadow:s.boxShadow}})})""")
  if control is not None:info['control']=await control.evaluate("e=>{const s=getComputedStyle(e);return {text:e.innerText,title:e.title,disabled:e.disabled,focusVisible:e.matches(':focus-visible'),color:s.color,background:s.backgroundColor,outline:s.outline,rect:e.getBoundingClientRect().toJSON()}}")
  info['actualTheme']=await page.locator('html').get_attribute('class')
  info['iframe']=await page.get_by_title('Presentation Viewer',exact=True).bounding_box() if await page.get_by_title('Presentation Viewer',exact=True).count() else None
  await page.screenshot(path=str(OUT/(name+'.png')));states.append({'name':name,**info})
  save()
 def save():
  (OUT/'results.json').write_text(json.dumps({'phase':opts.phase,'passed':passed,'commit':commit,'source_start':start,'source_end':hashes(),'layout_ref':nv.LAYOUT_REF,'states':states,'page_errors':errors,'violations':violations,'refused_writes':denied,'scope':'Actual frontend/native renderer with synthetic intercepted records. No connected persistence, publication or narration.'},indent=2)+'\n')
 async def tab_to(control):
  for _ in range(110):
   if await control.evaluate('e=>e===document.activeElement'):return
   await page.keyboard.press('Tab')
  raise AssertionError('Keyboard target not reachable')
 async def load():
  if w<500:await page.set_viewport_size({'width':1030,'height':h})
  r=await page.goto(nv.BASE+'/builder?session_id='+walkthrough.SESSION,wait_until='domcontentloaded');assert r.status==200
  await expect(page.locator('[data-studio-v4-shell-workspace=true]')).to_be_visible()
  if mode!='disabled':
   iframe=page.get_by_title('Presentation Viewer',exact=True);await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next decision clear.');await expect(iframe.content_frame.locator('section.present .slide-title')).to_be_visible()
   await page.wait_for_function("()=>{const f=document.querySelector('iframe[title=\"Presentation Viewer\"]');return f&&f.clientWidth>160&&f.clientHeight>90}")
   await page.get_by_role('button',name='Mode',exact=True).click();await page.get_by_role('menuitemradio',name='Dark' if dark else 'Light',exact=True).click()
   await page.wait_for_function('(dark)=>document.documentElement.classList.contains(dark?\"dark\":\"light\")',arg=dark)
   if w<500:await page.set_viewport_size({'width':w,'height':h})
 try:
  cases=[('light-1440x900',1440,900,False),('dark-1030x600',1030,600,True),('dark-1030x450',1030,450,True),('dark-390x844',390,844,True)]
  if opts.case!='all':cases=[cases[['light','dark','short','narrow'].index(opts.case)]]
  for label,w,h,dark in cases:
   await page.set_viewport_size({'width':w,'height':h});await page.emulate_media(color_scheme='dark' if dark else 'light');await page.evaluate("localStorage.setItem('theme',"+json.dumps('dark' if dark else 'light')+")")
   mode='normal';await load();await record(label+'-workspace')
   publish=page.get_by_role('button',name='Publish',exact=True);await expect(publish).to_be_enabled();await expect(publish).to_have_attribute('title','Publish this deck to a shareable link');await record(label+'-publish-normal',publish)
   await publish.hover();await record(label+'-publish-hover',publish)
   await page.get_by_label('Message Director',exact=True).click();await tab_to(publish);await record(label+'-publish-focus',publish);await page.keyboard.press('Enter');dialog=page.locator('[data-studio-publish=true]');await expect(dialog).to_be_visible();await expect(dialog.get_by_text('Who is this for?',exact=True)).to_be_visible();await record(label+'-audience')
   await dialog.get_by_role('button',name='Next · Questions',exact=True).click();await record(label+'-questions');await dialog.get_by_role('button',name='Next · Narration',exact=True).click();await record(label+'-narration');await dialog.locator('#wiz-narration').click();await expect(dialog.locator('[data-studio-voice-card=true]')).to_have_count(9);await record(label+'-narration-on');lastVoice=dialog.locator('[data-studio-voice-choice=true]').last;await tab_to(lastVoice);await expect(lastVoice).to_be_focused();await record(label+'-narration-last-voice-focus',lastVoice);await dialog.locator('#wiz-narration').click();await dialog.get_by_role('button',name='Next · Review',exact=True).click();await record(label+'-review');await page.keyboard.press('Escape');await expect(publish).to_be_focused()
   mode='drift';await load();publish=page.get_by_role('button',name='Publish',exact=True);await expect(publish).to_have_attribute('title','Published 1 slide · deck now has 2');await record(label+'-publish-drift',publish);await publish.hover();await record(label+'-publish-drift-hover',publish);await page.get_by_label('Message Director',exact=True).click();await tab_to(publish);await record(label+'-publish-drift-focus',publish)
   mode='manage';await load();await page.get_by_role('button',name='Publish',exact=True).click();dialog=page.locator('[data-studio-publish=true]');await expect(dialog.get_by_role('tab',name='Sharing',exact=True)).to_be_visible();await record(label+'-manage-sharing');await dialog.get_by_role('tab',name='Questions',exact=False).click();await record(label+'-manage-questions');await dialog.get_by_role('tab',name='Voice',exact=False).click();await expect(dialog.get_by_text('Alloy',exact=True)).to_be_visible();await record(label+'-manage-voice');lastVoice=dialog.locator('[data-studio-voice-choice=true]').last;await tab_to(lastVoice);await expect(lastVoice).to_be_focused();await record(label+'-manage-last-voice-focus',lastVoice);script=dialog.get_by_role('button',name='Write the script',exact=True);await tab_to(script);await expect(script).to_be_focused();await expect(dialog.get_by_role('button',name='Record the narration',exact=True)).to_be_disabled();await record(label+'-manage-script-record-gates',script);await page.keyboard.press('Escape')
   mode='normal';await load();
   if w<500:await page.get_by_role('button',name='Stage',exact=True).click()
   f=page.get_by_title('Presentation Viewer',exact=True).content_frame;await f.locator('section.present .slide-title').click();await page.keyboard.press('e');await expect(f.locator('body')).to_have_attribute('data-mode','edit');target=f.locator('#local-visual-text');await target.hover();await target.get_by_role('button',name='Refine element',exact=True).click();prompt=page.get_by_role('textbox',name='Generation prompt',exact=True);await expect(prompt).to_have_value('Unchanged local visual source');await record(label+'-inspector');await page.keyboard.press('Escape')
  expected=['workspace','publish-normal','publish-hover','publish-focus','audience','questions','narration','narration-on','narration-last-voice-focus','review','publish-drift','publish-drift-hover','publish-drift-focus','manage-sharing','manage-questions','manage-voice','manage-last-voice-focus','manage-script-record-gates','inspector']
  assert [s['name'] for s in states]==[label+'-'+name for label,_,_,_ in cases for name in expected]
  assert not errors and not violations and not denied,(errors,violations,denied)
  assert start==hashes(),'Source changed during visual capture'
  passed=True
 finally:
  await page.screenshot(path=str(OUT/'final-state.png'))
  (OUT/'final-state.txt').write_text(page.url+'\n'+await page.locator('body').inner_text())
  save()
mod=types.ModuleType('verify_walkthrough');mod.verify=verify;sys.modules['verify_walkthrough']=mod
import walkthrough
sys.argv=['walkthrough.py','--verify','--headless','--status-path',str(OUT/'status.json')]
asyncio.run(walkthrough.main())
