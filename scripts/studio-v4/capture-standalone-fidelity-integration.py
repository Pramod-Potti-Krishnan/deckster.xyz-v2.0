"""Compact before/after standalone styling comparison; isolated local reads only."""
import asyncio,hashlib,json,subprocess,sys,types
from pathlib import Path
from playwright.async_api import expect
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).resolve().parent))
import native_viewer as nv
OUT=Path(sys.argv[1]);PHASE=sys.argv[2];assert PHASE in ['before','after'];OUT.mkdir(parents=True,exist_ok=True)
RELEASE=ROOT/'docs/studio-v4/overnight-fidelity-20261002/evidence/standalone-fidelity-integration/atlas-release-decks.json'
assert hashlib.sha256(RELEASE.read_bytes()).hexdigest()=='ff475bea14fbb95274da6024f44d4a73343e4b9dde4c849bd00c323610045963'
manifest=json.loads(RELEASE.read_text())
FILES=sorted(set([x['path'] for x in manifest['release']]+['app/(app)/dashboard/page.tsx','app/(app)/knowledge/page.tsx','app/(app)/settings/security/page.tsx','app/help/page.tsx','components/help/studio-help.tsx','components/knowledge/studio-knowledge-inspector.tsx','components/knowledge/kg-graph-view.tsx','components/studio-personal/intelligence-workspace.tsx','components/studio-personal/details-workspace.tsx','components/studio-personal/account-profile-editor.tsx','components/studio-libraries/library-controls.tsx','components/studio-libraries/libraries.css','components/studio-libraries/library-account-boundary.tsx','components/studio-libraries/studio-workflow-action.tsx','hooks/use-knowledge-graph.ts','hooks/use-templates.ts','hooks/use-theme-profiles.ts','components/layout/studio-shell.css','components/layout/studio-rail.tsx','components/presentation-viewer.tsx','components/publish-dialog.tsx','components/template-save-dialog.tsx','components/template-ingest-dialog.tsx','components/ui/dialog.tsx','components/ui/popover.tsx','components/slide-layout-picker.tsx','app/builder/page.tsx','scripts/studio-v4/walkthrough.py','scripts/studio-v4/native_viewer.py','scripts/studio-v4/capture.py','scripts/studio-v4/capture-next.py','scripts/studio-v4/workspace-fixtures.json','scripts/studio-v4/ten-hour-knowledge-fixture.json',str(Path(__file__).relative_to(ROOT))]))
def hashes():return {p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() if (ROOT/p).exists() else None for p in FILES}
START=hashes();COMMIT=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip();STATES=[];PASSED=False
(OUT/'probe.py').write_bytes(Path(__file__).read_bytes())
async def skip_thumbnails(self,pw):pass
nv.NativeViewer.thumbnails=skip_thumbnails
async def verify(page,ctx,browser,errors,violations,denied,native,session):
 global PASSED
 def result():
  (OUT/'results.json').write_text(json.dumps({'passed':PASSED,'phase':PHASE,'source_commit':COMMIT,'release_sha256':hashlib.sha256(RELEASE.read_bytes()).hexdigest(),'source_start':START,'source_end':hashes(),'states':STATES,'page_errors':errors,'violations':violations,'refused_writes':denied,'browser':browser.version,'layout_ref':nv.LAYOUT_REF,'scope':'Actual combined standalone frontend; supplied local read fixtures. Theme class is chosen as a styling fixture after hydration, not a theme-toggle behavioral proof. Native controls use real pointer/keyboard; no services/writes, cache regeneration, shared browser or replacement native UI.'},indent=2)+'\n')
 async def go(path,size=(1440,900),dark=False):
  await page.set_viewport_size({'width':size[0],'height':size[1]});resp=await page.goto(nv.BASE+path,wait_until='domcontentloaded');assert resp.status==200
  await page.wait_for_load_state('load');await expect(page.locator('main h1').first).to_be_visible()
  await page.evaluate('d=>{localStorage.setItem("theme",d?"dark":"light");document.documentElement.classList.toggle("dark",d)}',dark)
  await page.wait_for_timeout(450);assert await page.locator('html').evaluate('e=>e.classList.contains("dark")')==dark
 async def tab_to(loc,reverse=False):
  for _ in range(120):
   if await loc.evaluate('e=>e===document.activeElement'):return
   await page.keyboard.press('Shift+Tab' if reverse else 'Tab')
  raise AssertionError('Keyboard target not reached')
 async def metrics(loc):
  return await loc.evaluate('e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {text:e.innerText,font:s.fontFamily,size:s.fontSize,color:s.color,background:s.backgroundColor,rect:r.toJSON(),focusVisible:e.matches(":focus-visible"),outline:s.outline,offset:s.outlineOffset}}')
 async def shot(name,area,facts=None):
  await expect(area).to_be_visible();await page.wait_for_timeout(300)
  assert not errors and not violations and not denied,(errors,violations,denied)
  assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Horizontal page overflow'
  await page.screenshot(path=str(OUT/(name+'.png')))
  STATES.append({'name':name,'url':page.url,'theme':await page.locator('html').evaluate('e=>e.classList.contains("dark")?"dark":"light"'),'area':await metrics(area),'facts':facts or {}});result()
 try:
  await go('/studio/templates',(390,844));area=page.locator('[data-studio-library="templates"]')
  await expect(area.get_by_role('button',name='Import presentation',exact=True)).to_be_enabled()
  title=await metrics(area.locator('.sl-heading h1'))
  if PHASE=='after':assert title['size']=='24px' and 'Georgia' not in title['font']
  await shot('templates-create-narrow',area,{'title':title})
  await area.get_by_role('button',name='Library',exact=True).click();await area.locator('.sl-record').filter(has_text='Quarterly business review').click()
  await expect(area.locator('.sl-preview-heading')).to_contain_text('Quarterly business review')
  await shot('templates-library-narrow',area)
  await go('/studio/themes',(1030,600),True);area=page.locator('[data-studio-library="themes"]')
  await area.get_by_role('button',name='Library',exact=True).click();await area.locator('.sl-record').filter(has_text='Evergreen studio').click()
  await expect(area.get_by_role('button',name='Choose theme in Studio',exact=True)).to_be_enabled()
  title=await metrics(area.locator('.sl-heading h1'))
  if PHASE=='after':assert title['size']=='25px' and 'Georgia' not in title['font']
  await shot('themes-library-short-dark',area,{'title':title})
  replay=area.locator('[data-studio-intro-replay="true"]');await tab_to(replay,True);await expect(replay).to_be_focused();assert await replay.evaluate('e=>e.matches(":focus-visible")')
  await shot('themes-replay-keyboard-focus',area,{'replay':await metrics(replay)})
  await go('/knowledge');area=page.locator('main')
  node=page.locator('[data-kg-node]').first;await expect(node).to_be_visible();await node.click();head=page.locator('.ski-identity h3');await expect(head).to_be_visible()
  m=await metrics(head)
  if PHASE=='after':assert 'Inter' in m['font']
  await shot('knowledge-entity',area,{'entityHeading':m})
  await go('/studio/intelligence');area=page.locator('[data-studio-personal="intelligence"]');await expect(area.get_by_role('button',name='Current workflows',exact=True)).to_have_attribute('aria-pressed','true')
  await shot('intelligence-workflows',area)
  await go('/studio/details');area=page.locator('.sp-workspace');head=page.locator('.sp-confirmed-profile h2');await expect(head).to_be_visible()
  await shot('details-profile',area,{'profileHeading':await metrics(head)})
  await go('/settings/security');area=page.locator('main');heads=page.locator('[data-studio-security-header] > .text-2xl');await expect(heads).to_have_count(2)
  ms=[await metrics(heads.nth(i)) for i in range(2)]
  if PHASE=='after':assert all(m['size']=='17px' for m in ms)
  await shot('security-cards',area,{'cardHeadings':ms})
  await go('/help');area=page.locator('[data-studio-help]');await expect(page.get_by_text('Loading account…',exact=True)).to_have_count(0)
  await page.get_by_role('tab',name='FAQ',exact=True).click();await shot('help-faq',area)
  await go('/dashboard');area=page.locator('[data-studio-decks="true"]');link=page.locator('[data-studio-deck-preview="true"]');await expect(link).to_have_count(1);await expect(link).to_have_attribute('href','/builder?session_id='+walkthrough.SESSION)
  primary=page.locator('[data-studio-deck-primary="true"]');await expect(primary).to_be_enabled();m=await metrics(primary)
  if PHASE=='after':assert m['background']=='rgb(36, 52, 56)' and m['color']=='rgb(255, 255, 255)',m
  await shot('decks-light-primary',area,{'primary':m,'sessionHref':await link.get_attribute('href'),'thumbnailFidelity':'Not accepted; no reference/connected equality asserted'})
  await page.evaluate('()=>{localStorage.setItem("theme","dark");document.documentElement.classList.add("dark")}');await tab_to(primary);await expect(primary).to_be_focused();await page.wait_for_timeout(350);m=await metrics(primary)
  assert m['focusVisible']
  if PHASE=='after':assert m['background']=='rgb(226, 235, 232)' and m['color']=='rgb(27, 36, 38)',m
  await shot('decks-dark-primary-focus',area,{'primary':m})
  expected=['templates-create-narrow','templates-library-narrow','themes-library-short-dark','themes-replay-keyboard-focus','knowledge-entity','intelligence-workflows','details-profile','security-cards','help-faq','decks-light-primary','decks-dark-primary-focus']
  assert [s['name'] for s in STATES]==expected and START==hashes() and not errors and not violations and not denied
  PASSED=True
 finally:
  result();await page.screenshot(path=str(OUT/'final-state.png'))
mod=types.ModuleType('verify_walkthrough');mod.verify=verify;sys.modules['verify_walkthrough']=mod
import walkthrough
sys.argv=['walkthrough.py','--verify','--headless','--status-path',str(OUT/'status.json')]
asyncio.run(walkthrough.main())
