"""Bounded rail/account comparison in isolated actual frontend with read fixtures."""
import asyncio,hashlib,json,subprocess,sys,types
from pathlib import Path
from playwright.async_api import expect
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).resolve().parent))
import native_viewer as nv
OUT=Path(sys.argv[1]);PHASE=sys.argv[2];assert PHASE in ['before','after'];OUT.mkdir(parents=True,exist_ok=True)
FILES=['components/layout/studio-shell.css','components/layout/studio-rail.tsx','components/layout/studio-navigation-hint.tsx','components/user-profile-menu.tsx','components/user-profile-studio-v4.css','components/ui/avatar.tsx','components/ui/dropdown-menu.tsx','components/ui/button.tsx','components/studio-about-dialog.tsx','components/builder/builder-header.tsx','components/chat-history-sidebar.tsx','components/studio-session-history.css','components/presentation-viewer.tsx','app/builder/page.tsx','hooks/use-auth.ts','hooks/use-chat-sessions.ts','components/builder/studio-workspace.css','components/builder/studio-panels.css','components/studio-libraries/templates-workspace.tsx','components/studio-libraries/templates-fidelity.css','scripts/studio-v4/capture.py','scripts/studio-v4/capture-next.py','scripts/studio-v4/native_viewer.py','scripts/studio-v4/walkthrough.py','scripts/studio-v4/workspace-fixtures.json',str(Path(__file__).relative_to(ROOT))]
def hashes():return {p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in FILES}
START=hashes();COMMIT=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip();STATES=[];OBS={};PASSED=False
(OUT/'probe.py').write_bytes(Path(__file__).read_bytes())
async def skip(self,pw):pass
nv.NativeViewer.thumbnails=skip
async def verify(page,ctx,browser,errors,violations,denied,native,session):
 global PASSED
 def result():
  (OUT/'results.json').write_text(json.dumps({'passed':PASSED,'phase':PHASE,'source_commit':COMMIT,'source_start':START,'source_end':hashes(),'states':STATES,'observations':OBS,'page_errors':errors,'violations':violations,'refused_writes':denied,'browser':browser.version,'layout_ref':nv.LAYOUT_REF,'scope':'Isolated actual combined UI, supplied read-only account/quota/session/optional-avatar records. Native input only; no service writes, shared browser, runtime restart or hidden development badge. Short-menu geometry observations are not blanket keyboard/OS/UAT acceptance.'},indent=2)+'\n')
 async def tab_to(loc,reverse=False):
  for _ in range(180):
   if await loc.evaluate('e=>e===document.activeElement'):return
   await page.keyboard.press('Shift+Tab' if reverse else 'Tab')
  raise AssertionError('Keyboard target not reached')
 async def details(loc):
  return await loc.evaluate('e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {tag:e.tagName,text:e.innerText,rect:r.toJSON(),font:s.fontFamily,fontSize:s.fontSize,color:s.color,background:s.backgroundColor,backgroundImage:s.backgroundImage,border:s.border,outline:s.outline,offset:s.outlineOffset,focus:e===document.activeElement,focusVisible:e.matches(":focus-visible"),inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,hit:!!hit&&(e===hit||e.contains(hit)),hitTag:hit?.tagName,hitClass:hit?.className,scrollTop:e.scrollTop,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight}}')
 async def account():
  trigger=page.locator('button[aria-label="Open account menu"]');await expect(trigger).to_be_visible();return trigger
 async def open_menu(expand=True):
  trigger=await account();await tab_to(trigger,True);await expect(trigger).to_be_focused();await page.keyboard.press('Enter');menu=page.locator('[data-studio-v4-profile="true"]');await expect(menu).to_be_visible()
  await expect(menu.get_by_role('button',name='Usage remaining',exact=True)).to_be_visible()
  for name in ['Dashboard','Knowledge','Settings','Help','About Studio','Sign Out']:await expect(menu.get_by_role('menuitem',name=name,exact=True)).to_have_count(1)
  await expect(menu).to_contain_text(walkthrough.USER['name']);await expect(menu).to_contain_text(walkthrough.USER['email'])
  if expand:
   upgrade=menu.get_by_role('link',name='Upgrade for more usage',exact=True)
   if not await upgrade.count():await menu.get_by_role('button',name='Usage remaining',exact=True).click()
   await expect(menu).to_contain_text('100%');await expect(upgrade).to_have_attribute('href','/billing')
  return trigger,menu
 async def close_menu(trigger):
  await page.keyboard.press('Escape');await expect(page.locator('[data-studio-v4-profile="true"]')).to_have_count(0);await expect(trigger).to_be_focused()
 async def shot(name,facts=None):
  await page.wait_for_timeout(350);assert not errors and not violations and not denied,(errors,violations,denied)
  rail=page.locator('[data-studio-v4-rail="true"]');trigger=await account();info={'rail':await details(rail),'trigger':await details(trigger),'avatar':await details(trigger.locator('span').first),'viewport':await page.evaluate('({width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth})'),'theme':await page.locator('html').evaluate('e=>e.classList.contains("dark")?"dark":"light"')}
  assert info['viewport']['pageWidth']<=info['viewport']['width']
  assert info['trigger']['rect']['width']>=40 and info['trigger']['rect']['height']>=40
  if PHASE=='after':assert info['rail']['rect']['width']==(48 if info['viewport']['width']<=780 else 56) and info['avatar']['rect']['width']==30
  menu=page.locator('[data-studio-v4-profile="true"]')
  if await menu.count():
   info['menu']=await details(menu);info['menuItems']=await menu.get_by_role('menuitem').all_text_contents()
   if PHASE=='after':assert info['menu']['inside'],info['menu']
  await page.screenshot(path=str(OUT/(name+'.png')));STATES.append({'name':name,**info,'facts':facts or {}});result()
 try:
  await page.set_viewport_size({'width':1440,'height':900});composer=page.get_by_role('textbox',name='Message Director',exact=True);await composer.fill('Unsent shared navigation review draft')
  trigger=await account();await tab_to(trigger,True);await shot('wide-light-account-keyboard-focus')
  trigger,menu=await open_menu();await shot('wide-light-account-expanded-usage');await close_menu(trigger);await expect(composer).to_have_value('Unsent shared navigation review draft')
  sessions=page.get_by_role('button',name='Open deck list',exact=True);await expect(sessions).to_have_count(1);await sessions.click();panel=page.locator('[data-studio-v4-session-list][data-studio-v4-session-open="true"]');await expect(panel).to_be_visible();await page.wait_for_timeout(450)
  bounds=await panel.bounding_box();assert bounds['x']==56,bounds  # This sessions state uses the1440px desktop viewport.
  await shot('wide-light-sessions-aligned',{'sessions':await details(panel)});await page.get_by_role('button',name='Close sessions',exact=True).click()
  panel=page.locator('[data-studio-v4-session-list][data-studio-v4-session-open="false"]');await expect(panel).to_have_count(1);await page.wait_for_timeout(450);OBS['closedSessions']=await details(panel);assert OBS['closedSessions']['rect']['right']<=0
  resp=await page.goto(nv.BASE+'/studio/templates',wait_until='domcontentloaded');assert resp.status==200;await expect(page.locator('[data-studio-library="templates"] .sl-heading h1')).to_be_visible()
  await page.set_viewport_size({'width':390,'height':844});trigger=await account();await tab_to(trigger,True);await shot('narrow-light-rail-account-focus')
  trigger,menu=await open_menu();await shot('narrow-light-account-expanded-usage');await close_menu(trigger)
  await page.set_viewport_size({'width':390,'height':450});last=page.locator('[data-studio-v4-rail] a[aria-label="Your details"]');await tab_to(last,True);await expect(last).to_be_focused()
  await shot('short-light-last-destination-focus',{'lastDestination':await details(last)})
  trigger,menu=await open_menu();dark=menu.get_by_role('menuitem',name='Dark Mode',exact=True);await dark.click();await expect(page.locator('html')).to_have_class(__import__('re').compile(r'.*dark.*'))
  trigger,menu=await open_menu();await shot('short-dark-account-expanded-usage')
  await page.keyboard.press('End');signout=menu.get_by_role('menuitem',name='Sign Out',exact=True);await expect(signout).to_be_focused();await shot('short-dark-last-menu-item-focus',{'danger':await details(signout)})
  await close_menu(trigger)
  # An explicitly supplied image record, no avatar upload or real account mutation.
  avatar_url=nv.BASE+'/studio-local-account-avatar.svg'
  async def image_route(route):await route.fulfill(content_type='image/svg+xml',body='<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#eaf0f3"/><circle cx="40" cy="28" r="14" fill="#657c8a"/><path d="M15 75 Q15 45 40 45 Q65 45 65 75" fill="#657c8a"/></svg>')
  await ctx.route(avatar_url,image_route);walkthrough.USER['image']=avatar_url
  await page.set_viewport_size({'width':1440,'height':900});resp=await page.goto(nv.BASE+'/studio/templates',wait_until='domcontentloaded');assert resp.status==200
  trigger=await account();img=trigger.locator('img');await expect(img).to_have_count(1);await expect(img).to_have_attribute('src',avatar_url);assert await img.evaluate('e=>e.complete&&e.naturalWidth>0')
  await shot('wide-light-supplied-avatar-image',{'avatarImage':await details(img),'imageRecordOnly':True})
  expected=['wide-light-account-keyboard-focus','wide-light-account-expanded-usage','wide-light-sessions-aligned','narrow-light-rail-account-focus','narrow-light-account-expanded-usage','short-light-last-destination-focus','short-dark-account-expanded-usage','short-dark-last-menu-item-focus','wide-light-supplied-avatar-image']
  assert [s['name'] for s in STATES]==expected and START==hashes() and not errors and not violations and not denied;PASSED=True
 finally:result();await page.screenshot(path=str(OUT/'final-state.png'))
mod=types.ModuleType('verify_walkthrough');mod.verify=verify;sys.modules['verify_walkthrough']=mod
import walkthrough
sys.argv=['walkthrough.py','--verify','--headless','--status-path',str(OUT/'status.json')]
asyncio.run(walkthrough.main())
