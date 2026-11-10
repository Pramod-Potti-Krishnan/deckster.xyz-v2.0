"""CP2.1 follow-up: real frontend, one exact read-only local Layout fixture.
No service fallback, state injection, synthetic mutation success, or replaced toolbar.
"""
import asyncio, argparse, json, hashlib, subprocess
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright, expect
from capture import ROOT, BASE, USER, NOW, SLIDES, SAVED, PRESETS_URL, socket_kind, required
SESSION='11111111-1111-4111-8111-111111111111'
VIEWER='https://layout-builder-v75-uat.up.railway.app/p/studio-v4-local-renderer'
HTML='''<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{background:#fff;color:#243438;font-family:Arial,sans-serif;padding:6%;display:flex;flex-direction:column;justify-content:center}small{color:#1f6f72;font-weight:bold;letter-spacing:2px;font-size:clamp(8px,2vw,16px)}h1{font-size:clamp(18px,6vw,48px);margin:6% 0}p{font-size:clamp(10px,2.5vw,20px);margin:0}footer{margin-top:8%;border-top:2px solid #d6e1dc;padding-top:3%;font-size:clamp(8px,1.8vw,14px)}</style></head><body><small>LOCAL READ-ONLY FIXTURE</small><h1>Studio workspace</h1><p>Real viewer and toolbar · synthetic slide content</p><footer>16:9 sample · no connected rendering, edits or exports</footer><script>
window.fixtureRequests=[];
addEventListener('message',e=>{if(e.source!==parent||e.origin!=='http://127.0.0.1:8792')return;
 const d=e.data;if(!d||typeof d.action!=='string'||typeof d.requestId!=='string')return;
 const allowed=d.action==='getCurrentSlideInfo';window.fixtureRequests.push({action:d.action,requestId:d.requestId,allowed});
 parent.postMessage({action:d.action,requestId:d.requestId,success:allowed,...(allowed?{data:{index:0,total:2,current_visual_index:0,real_slide_count:2,visual_section_count:2}}:{error:'Read-only local fixture refuses this action'})},e.origin);
});</script></body></html>'''
RECT='''e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}}'''
HIT='''e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return x>=0&&y>=0&&x<innerWidth&&y<innerHeight&&e.contains(document.elementFromPoint(x,y))}'''
async def focus_proof(page, out, label, snapshot, checks, requests, external, sockets):
    target=page.locator('[data-studio-v4-toolbar-target]')
    expected=['Add Slide','Add Element','Theme','Mode','Show','Final','Play','Download','Publish']
    await expect(target.get_by_role('button',name='Template',exact=True)).to_be_disabled()
    counts=[len(requests),len(external),sum(socket_kind(s)=='product' for s in sockets)]
    origin=await page.evaluate('({x:scrollX,y:scrollY})')
    observations=[]
    async def edge(which):
        b=await target.bounding_box()
        await page.mouse.move(b['x']+b['width']/2,b['y']+b['height']/2)
        await page.mouse.wheel(-5000 if which=='start' else 5000,0)
        await page.wait_for_timeout(200)
        m=await target.evaluate('e=>({left:e.scrollLeft,max:e.scrollWidth-e.clientWidth,top:e.scrollTop})')
        assert abs(m['left']-(0 if which=='start' else m['max']))<=1,m
        return m
    async def measure():
        return await page.evaluate("""()=>{
          const e=document.activeElement,t=document.querySelector('[data-studio-v4-toolbar-target]');
          if(!t.contains(e))return null;
          const r=e.getBoundingClientRect(),b=t.getBoundingClientRect(),s=getComputedStyle(e);
          const extent=s.outlineStyle==='none'?0:Math.max(0,parseFloat(s.outlineWidth)+parseFloat(s.outlineOffset));
          const left=b.left+t.clientLeft,right=left+t.clientWidth,top=b.top+t.clientTop,bottom=top+t.clientHeight;
          return {text:e.textContent.trim(),title:e.title,focusVisible:e.matches(':focus-visible'),outline:s.outlineColor,outlineWidth:s.outlineWidth,outlineOffset:s.outlineOffset,
            bounds:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},strip:{left,right,top,bottom},scrollLeft:t.scrollLeft,scrollTop:t.scrollTop,
            fullyExposed:r.left-extent>=left-.5&&r.right+extent<=right+.5&&r.top-extent>=top-.5&&r.bottom+extent<=bottom+.5,
            hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};
        }""")
    for which in ['start','end']:
      for direction in ['Tab','Shift+Tab']:
        sessions=page.get_by_role('button',name='Open deck list',exact=True)
        # Native focus traversal only: opening Sessions would fetch its list.
        for _ in range(90):
          await page.keyboard.press('Tab')
          if await sessions.evaluate('e=>e===document.activeElement'):break
        await expect(sessions).to_be_focused()
        if direction=='Shift+Tab':
          # Reach the actual control following the toolbar without invoking it.
          for _ in range(20):
            await page.keyboard.press('Tab')
            if await page.get_by_role('button',name='Presentation',exact=True).evaluate('e=>e===document.activeElement'):break
          await expect(page.get_by_role('button',name='Presentation',exact=True)).to_be_focused()
        start=await edge(which);actions=[]
        for _ in range(20):
          await page.keyboard.press(direction);await page.wait_for_timeout(50)
          m=await measure()
          if m:
            assert m['fullyExposed'] and m['hit'] and m['focusVisible'],m
            assert m['scrollTop']==0 and await page.evaluate('({x:scrollX,y:scrollY})')==origin,m
            actions.append(m)
          if len(actions)==len(expected):break
        assert [m['text'] for m in actions]==(expected if direction=='Tab' else list(reversed(expected))),actions
        observations.append({'extreme':which,'direction':direction,'initialScroll':start,'actions':actions})
        await snapshot('focus-'+which+'-'+('forward' if direction=='Tab' else 'backward'))
    checks['focusFromBothExtremesBothDirections']=observations
    portals=[]
    for title in ['Add an element','Download as PDF or PPTX']:
      trigger=page.get_by_title(title,exact=True)
      for _ in range(50):
        await page.keyboard.press('Tab')
        if await trigger.evaluate('e=>e===document.activeElement'):break
      await expect(trigger).to_be_focused();m=await measure();assert m['fullyExposed'],m
      before=await target.evaluate('e=>({left:e.scrollLeft,top:e.scrollTop})')
      await page.keyboard.press('Enter');menu=await required(page.get_by_role('menu'))
      await expect(menu.locator('[role=menuitem]').first).to_be_focused()
      assert not await target.evaluate('e=>e.contains(document.activeElement)')
      assert await target.evaluate('e=>({left:e.scrollLeft,top:e.scrollTop})')==before
      await snapshot('focus-portal-'+('element' if title.startswith('Add') else 'download'))
      await page.keyboard.press('Escape');await expect(trigger).to_be_focused()
      assert await target.evaluate('e=>({left:e.scrollLeft,top:e.scrollTop})')==before
      assert await page.evaluate('({x:scrollX,y:scrollY})')==origin
      m=await measure();assert m['fullyExposed'],m
      portals.append({'trigger':title,'scrollBeforePortalFocusAndAfterEscape':before,'focusRestored':m})
    checks['portalDOMGuardAndEscapeNoMisScroll']=portals
    final=await snapshot('focus-complete')
    assert final['iframe']['same'] and final['target']['same']
    assert counts==[len(requests),len(external),sum(socket_kind(s)=='product' for s in sockets)]
    checks['noPageVerticalScrollNoNewTrafficStableIframeTarget']=True

async def workspace_proof(page,out,label,snapshot,checks,requests,external,sockets,width):
    author=page.locator('[data-studio-v4-authoring-controls]')
    assert await author.locator('button').all_text_contents()==['Add Slide','Add Element','Template','Theme','Mode','Show']
    await expect(author.get_by_role('button',name='Template',exact=True)).to_be_disabled()
    textarea=page.locator('[data-studio-v4-composer] textarea')
    await textarea.fill('Keep this unsent deck draft while reviewing the inspector.')
    url=page.url
    await page.get_by_title('Add an element',exact=True).click()
    await required(page.get_by_role('menuitem',name='Chart',exact=True));await snapshot('add-element-menu')
    await page.keyboard.press('Escape')
    if await page.get_by_title('Show thumbnails',exact=True).count():await page.get_by_title('Show thumbnails',exact=True).click()
    await page.get_by_title('Presentation Viewer',exact=True).content_frame.get_by_role('button',name='Inspect fixture Chart placeholder',exact=True).click()
    panel=await required(page.locator('[data-studio-v4-panel="element-generation"]'))
    prompt=panel.get_by_placeholder('e.g., Show quarterly revenue growth for 2024')
    await expect(prompt).to_be_visible();await prompt.fill('Compare quarterly revenue for 2024. Keep this unsent chart draft.')
    await snapshot('chart-inspector')
    if width>=1166:await expect(page.get_by_text('The local sample is ready for visual review.',exact=False)).to_be_visible()
    controls=await panel.locator('input,select,textarea,button').evaluate_all("es=>es.map(e=>({tag:e.tagName,label:e.getAttribute('aria-label')||e.textContent.trim(),value:e.value,disabled:e.disabled}))")
    checks['realChartFields']=controls
    counts=[len(requests),len(external),len(sockets)]
    switch=page.get_by_role('group',name='Workspace pane',exact=True)
    if width<1166:
      await expect(switch).to_be_visible()
      await switch.get_by_role('button',name='Chat',exact=True).click()
      await expect(textarea).to_be_visible();await expect(textarea).to_have_value('Keep this unsent deck draft while reviewing the inspector.')
      await snapshot('compact-chat')
      await switch.get_by_role('button',name='Chat',exact=True).press('Control+Enter');await switch.get_by_role('button',name='Chat',exact=True).press('Meta+Enter');await page.keyboard.press('Escape')
      if await page.get_by_title('Show thumbnails',exact=True).count():await page.get_by_title('Show thumbnails',exact=True).click()
      await expect(textarea).to_have_value('Keep this unsent deck draft while reviewing the inspector.')
      await switch.get_by_role('button',name='Inspector',exact=True).click()
      await expect(prompt).to_be_visible();await expect(prompt).to_have_value('Compare quarterly revenue for 2024. Keep this unsent chart draft.')
      await snapshot('compact-inspector-return')
    else:
      await expect(textarea).to_be_visible()
      chat=page.get_by_role('separator',name='Resize chat panel',exact=True)
      await chat.press('Home');await chat.press('ArrowRight');await snapshot('wide-chat-resized')
    assert await textarea.input_value()=='Keep this unsent deck draft while reviewing the inspector.'
    assert counts==[len(requests),len(external),len(sockets)]
    checks['paneChangesRetainBothDraftsWithoutTraffic']=True
    thumbnail=await required(page.get_by_role('separator',name='Resize slide thumbnails',exact=True))
    await thumbnail.press('End');await expect(thumbnail).to_have_attribute('aria-valuenow','180');await snapshot('thumbnails-keyboard-wide')
    await thumbnail.press('Home');await expect(thumbnail).to_have_attribute('aria-valuenow','96');await thumbnail.press('ArrowLeft');await expect(thumbnail).to_have_attribute('aria-valuenow','104')
    b=await thumbnail.bounding_box();await page.mouse.move(b['x']+b['width']/2,b['y']+50);await page.mouse.down();await page.mouse.move(b['x']-24,b['y']+50,steps=4);await page.mouse.up()
    assert 104<int(await thumbnail.get_attribute('aria-valuenow'))<=180
    remembered=await thumbnail.get_attribute('aria-valuenow');await snapshot('thumbnails-pointer')
    checks['thumbnailKeyboardAndPointerResize']=remembered
    # Native Tab traversal reaches every enabled tool in both strips. No command invoked.
    focus=[];seen=set();origin=await page.evaluate('({x:scrollX,y:scrollY})')
    for _ in range(150):
      await page.keyboard.press('Tab')
      m=await page.evaluate("""()=>{const e=document.activeElement,t=e.closest('[data-studio-v4-authoring-controls],[data-studio-v4-toolbar-target]');if(!t||e.tagName!=='BUTTON')return null;const r=e.getBoundingClientRect(),b=t.getBoundingClientRect(),s=getComputedStyle(e);const extent=s.outlineStyle==='none'?0:Math.max(0,parseFloat(s.outlineWidth)+parseFloat(s.outlineOffset));return {text:e.textContent.trim(),focus:e.matches(':focus-visible'),hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),exposed:r.left-extent>=b.left-.5&&r.right+extent<=b.right+.5&&r.top-extent>=b.top-.5&&r.bottom+extent<=b.bottom+.5}}""")
      if m:
        assert m['focus'] and m['hit'] and m['exposed'],m
        seen.add(m['text']);focus.append(m)
      if len(seen)==9:break
    assert seen=={'Add Slide','Add Element','Theme','Mode','Show','Final','Play','Download','Publish'},seen
    assert await page.evaluate('({x:scrollX,y:scrollY})')==origin
    checks['nativeKeyboardToolsExposed']=focus;await snapshot('tools-keyboard')
    await page.get_by_title('Open slide panel',exact=True).click()
    await required(page.locator('[data-studio-v4-panel="slide-generation"]'));await snapshot('slide-inspector')
    await page.get_by_role('group',name='Inspector panels',exact=True).get_by_role('button',name='Element',exact=True).click()
    await expect(prompt).to_have_value('Compare quarterly revenue for 2024. Keep this unsent chart draft.')
    final=await snapshot('inspector-return');assert final['iframe']['same'] and final['target']['same'] and page.url==url
    checks['realInspectorSwitchKeepsChartDraftAndIframe']=True
    await page.reload(wait_until='domcontentloaded');await required(page.get_by_title('Presentation Viewer',exact=True));await expect(page.get_by_title('Present fullscreen',exact=True)).to_be_enabled();await page.add_style_tag(content='nextjs-portal{display:none!important}')
    await expect(page.get_by_role('separator',name='Resize slide thumbnails',exact=True)).to_have_attribute('aria-valuenow',remembered)
    await snapshot('reload');checks['resumedSessionAndThumbnailPreference']=True

async def walkthrough_proof(page,snapshot,checks):
    initial_url=page.url
    await page.get_by_title('Display options',exact=True).click()
    await required(page.get_by_role('menuitem',name='Master…',exact=True))
    await snapshot('master-entry-preserved')
    await page.keyboard.press('Escape')
    if await page.get_by_title('Show thumbnails',exact=True).count():await page.get_by_title('Show thumbnails',exact=True).click()
    destinations=[('Templates','[data-studio-library=templates]'),('Themes & brand','[data-studio-library=themes]'),('Intelligence','[data-studio-personal=intelligence]'),('Your details','[data-studio-personal=details]')]
    returns=[]
    for label,selector in destinations:
      await page.locator('[data-studio-v4-rail]').get_by_role('link',name=label,exact=True).click()
      await required(page.locator(selector)) # Client route was entered through the hydrated rail; readiness uses its actual root.
      await snapshot('workspace-'+label.split()[0].lower())
      await page.locator('[data-studio-v4-rail]').get_by_role('button',name='Studio',exact=True).click()
      await required(page.locator('[data-studio-v4-composer] textarea'))
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(page.get_by_title('Present fullscreen',exact=True)).to_be_enabled()
      await expect(iframe.content_frame.get_by_text('LOCAL READ-ONLY FIXTURE',exact=True)).to_be_visible()
      assert page.url==initial_url and await iframe.get_attribute('src')==VIEWER
      await snapshot('studio-return-'+label.split()[0].lower());returns.append({'from':label,'sessionUrl':page.url,'iframeUrl':await iframe.get_attribute('src')})
    checks['fourRailRoutesReturnToSameOwnedDeck']=returns
    checks['masterEntryPreservedWithoutCommands']=True
    checks['routeUnmountCreatesNewIframeButRestoresSameDeck']=True

async def main():
    parser=argparse.ArgumentParser();parser.add_argument('--shell',choices=['on','off'],required=True);parser.add_argument('--focus-only',action='store_true');parser.add_argument('--batch-a',action='store_true');parser.add_argument('--walkthrough',action='store_true');a=parser.parse_args()
    config=json.loads((ROOT/'.env.studio-v4-runtime/preview-config.json').read_text());assert not a.batch_a or json.loads((ROOT/'.env.studio-v4-runtime/preview-features.json').read_text())['slideComposer']=='true'
    assert config=={'port':'8792','shell':'true' if a.shell=='on' else 'false','tokens':'true','type':'false','labels':'true','mentions':'true'},config
    out=ROOT.parent/('studio-v4-walkthrough-captures-20261001' if a.walkthrough else 'studio-v4-batch-a-captures-20261001' if a.batch_a else 'studio-v4-cp21-focus-captures-20261001' if a.focus_only else 'studio-v4-cp21-followup-captures-20261001')/a.shell;out.mkdir(parents=True,exist_ok=True)
    identity={'commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'files':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['components/layout/studio-rail.tsx','components/layout/studio-shell.css','components/presentation-viewer.tsx','components/builder/presentation-area.tsx','scripts/studio-v4/capture-populated.py','components/builder/builder-header.tsx']+(['app/builder/page.tsx','components/builder/studio-canvas.css','components/builder/studio-workspace.css','components/builder/studio-panels.css','lib/studio-workspace-layout.ts','components/generation-panel/index.tsx','components/slide-generation-panel/index.tsx'] if a.batch_a or a.walkthrough else [])}}
    if a.walkthrough:
      identity['files'].update({str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for folder in ['components/studio-personal','components/studio-libraries','app/(app)/studio'] for p in (ROOT/folder).rglob('*') if p.is_file()})
    results=[]
    async with async_playwright() as pw:
      browser=await pw.chromium.launch()
      try:
       cases=[('light-1280x720',1280,720,False),('dark-1280x720',1280,720,True),('light-1030x600',1030,600,False),('dark-1030x600',1030,600,True)] if a.shell=='on' else [('light-1280x720',1280,720,False)]
       if (a.focus_only or a.batch_a) and a.shell=='on':cases=[cases[0],cases[3]]
       if a.walkthrough:cases=[cases[0]]
       for label,w,h,dark in cases:
        context=await browser.new_context(viewport={'width':w,'height':h},color_scheme='dark' if dark else 'light',service_workers='block')
        await context.add_cookies([json.loads((ROOT/'.env.studio-v4-runtime/s0-cookie.json').read_text())]);await context.add_init_script("localStorage.setItem('theme',"+json.dumps('dark' if dark else 'light')+");")
        errors=[];violations=[];requests=[];sockets=[];snapshots={};checks={};external=[]
        fixture_html=HTML.replace('</footer>', '''</footer><button style="align-self:flex-start;margin-top:3%;padding:6px 10px;border:1px solid #9bacad;border-radius:6px;background:#f2f6f5;color:#243438;font-size:clamp(8px,1.8vw,14px)" onclick="parent.postMessage({type:'refineElementRequested',elementId:'fixture-chart-blank',elementType:'CHART',componentType:'CHART',slideIndex:0,isBlank:true,content:'&lt;div data-blank-element=&quot;fixture-chart-blank&quot;&gt;&lt;/div&gt;'},'http://127.0.0.1:8792')">Inspect fixture Chart placeholder</button>''') if a.batch_a else HTML
        fixture_messages=[{'id':'fixture-director','messageType':'chat_message','timestamp':'2026-10-01T10:00:01Z','payload':{'text':'The local sample is ready for visual review. Select its existing Chart placeholder to inspect the form. Generation and saves are outside this read-only walkthrough.','ephemeral':False}}] if a.batch_a else []
        session={'id':SESSION,'userId':USER['id'],'title':'Local renderer fixture','createdAt':NOW,'updatedAt':NOW,'currentStage':6,'slideCount':2,'status':'active','messages':fixture_messages,'finalPresentationUrl':VIEWER,'finalPresentationId':'studio-v4-local-renderer','stateCache':{'activeVersion':'final','slideStructure':{'metadata':{'main_title':'Local renderer fixture','overall_theme':'Minimal','target_audience':'Review','presentation_duration':5},'slides':SLIDES}}}
        async def route_handler(route):
          req=route.request;u=urlparse(req.url);path=u.path
          if req.url==VIEWER and req.method=='GET':external.append({'url':req.url,'disposition':'exact-local-html-fixture'});await route.fulfill(content_type='text/html',body=fixture_html);return
          if req.method=='GET' and req.url in [VIEWER.replace('/p/','/api/presentations/'),VIEWER.replace('/p/','/api/presentations/')+'/theme/css-variables']:
            external.append({'url':req.url,'disposition':'exact-local-read-only-api-fixture'})
            data={'css_variables':{'--theme-text':'#243438','--theme-background':'#ffffff'}} if req.url.endswith('/theme/css-variables') else {'id':'studio-v4-local-renderer','title':'Local renderer fixture','updated_at':NOW,'slides':[{'id':s['slide_id'],'slide_id':s['slide_id'],'layout':'L29','title':s['title'],'script':'','speaker_notes':'','references':[]} for s in SLIDES]}
            await route.fulfill(json=data,headers={'Access-Control-Allow-Origin':BASE});return
          if u.netloc!='127.0.0.1:8792':
            external.append({'url':req.url,'method':req.method,'disposition':'local-presets-fixture' if req.url==PRESETS_URL else 'blocked'})
            if req.url==PRESETS_URL and req.method=='GET':await route.fulfill(json=[],headers={'Access-Control-Allow-Origin':'*'});return
            if u.hostname not in ['va.vercel-scripts.com','vitals.vercel-insights.com']:violations.append(req.method+' '+req.url)
            await route.abort();return
          if not path.startswith('/api/'):await route.continue_();return
          requests.append({'method':req.method,'path':path,**({'body':req.post_data} if req.method!='GET' else {})})
          if req.method!='GET':
            expected_flush=a.batch_a and req.method=='POST' and path==f'/api/sessions/{SESSION}/messages' and req.post_data_json=={'messages':fixture_messages}
            requests[-1]['disposition']='refused-existing-fixture-message-flush' if expected_flush else 'refused-unexpected-mutation'
            requests[-1]['responseStatus']=405
            if not expected_flush:violations.append('Refused mutation: '+req.method+' '+path)
            await route.fulfill(status=405,json={'error':'Read-only local fixture'});return
          if path=='/api/auth/session':data={'user':USER,'expires':'2099-01-01T00:00:00Z'}
          elif path=='/api/director/ws-token':data={'auth_enabled':False,'auth_token':None}
          elif path==f'/api/publish/by-session/{SESSION}':data={'deck':None}
          elif path=='/api/subscription':data={'subscription':None}
          elif path=='/api/usage/quota':data={'tier':'free','tierLabel':'Free','caps':{'dailyCents':20,'weeklyCents':50,'monthlyCents':100},'spent':{'dailyCents':0,'weeklyCents':0,'monthlyCents':0},'remainingPct':{'daily':1,'weekly':1,'monthly':1},'flags':{'dailyNear':False,'dailyAt':False,'weeklyNear':False,'weeklyAt':False},'resetAt':{'daily':NOW,'weekly':NOW},'walletBalanceCents':0,'totals':{'monthTokens':0,'monthSpendCents':0}}
          elif path=='/api/sessions':data={'sessions':[session],'pagination':{'total':1,'limit':20,'offset':0,'hasMore':False}}
          elif path==f'/api/sessions/{SESSION}':data={'session':session}
          elif path==f'/api/sessions/{SESSION}/files':data={'files':[]}
          elif path==f'/api/sessions/{SESSION}/messages':data={'messages':fixture_messages}
          elif path=='/api/themes/standard':data={'theme':None}
          elif path=='/api/themes':data={'themes':[SAVED],'count':1}
          elif path=='/api/templates':data={'templates':[]}
          else:violations.append('Unexpected GET '+path);await route.fulfill(status=404,json={});return
          await route.fulfill(json=data)
        await context.route('**/*',route_handler)
        async def ws_handler(ws):
          sockets.append(ws.url)
          if socket_kind(ws.url)=='development':ws.connect_to_server();return
          if socket_kind(ws.url)=='product':
            # Resumed session should not need a connection for structural proof.
            ws.on_message(lambda m: ws.send('pong') if m=='ping' else None);return
          violations.append(ws.url);await ws.close()
        await context.route_web_socket('**/*',ws_handler)
        page=await context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        async def snapshot(name):
          await page.wait_for_timeout(450)
          assert not errors and not violations,(errors,violations)
          m=await page.evaluate('''()=>{const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};const target=document.querySelector('[data-studio-v4-toolbar-target]'),f=document.querySelector('iframe'),work=document.querySelector('[data-studio-v4-shell-workspace]');return {url:location.href,viewport:{width:innerWidth,height:innerHeight},pageWidth:document.documentElement.scrollWidth,header:rect(document.querySelector('header')),rail:rect(document.querySelector('[data-studio-v4-rail]')),workspace:rect(work),workspaceOverflow:work?getComputedStyle(work).overflow:null,iframe:f?{rect:rect(f),container:rect(f.parentElement.parentElement.parentElement),src:f.src,same:window.proofIframe?f===window.proofIframe:null}:null,target:target?{rect:rect(target),scrollWidth:target.scrollWidth,clientWidth:target.clientWidth,scrollLeft:target.scrollLeft,same:window.proofTarget?target===window.proofTarget:null}:null,controls:target?[...target.querySelectorAll('button')].map(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {text:e.textContent.trim(),title:e.title,label:e.getAttribute('aria-label'),disabled:e.disabled,rect:rect(e),hit:e.contains(document.elementFromPoint(x,y)),focused:e===document.activeElement}}):[],sessions:rect(document.querySelector('[data-studio-v4-session-list]')),menus:[...document.querySelectorAll('[role=menu]')].map(e=>({rect:rect(e),text:e.textContent.trim()})),draft:document.querySelector('[data-studio-v4-composer] textarea')?.value};}''')
          m['workspaceAllocation']=await page.evaluate('''()=>({panes:[...document.querySelectorAll('[data-studio-workspace-drawer]')].map(e=>({kind:e.dataset.studioWorkspaceDrawer,visible:e.dataset.studioWorkspaceVisible,inert:e.querySelector('[data-studio-workspace-content]')?.inert,width:e.getBoundingClientRect().width,x:e.getBoundingClientRect().x})),thumbnails:document.querySelector('[data-studio-v4-thumbnails]')?.getBoundingClientRect().width,authoring:[...document.querySelectorAll('[data-studio-v4-authoring-controls] button')].map(e=>({text:e.textContent.trim(),disabled:e.disabled}))})''')
          snapshots[name]=m;await page.screenshot(path=str(out/(label+'-'+name+'.png')),animations='disabled')
          if m['iframe']:
            r=m['iframe']['rect'];c=m['iframe']['container'];assert abs(r['width']/r['height']-16/9)<.01,(name,r);assert r['x']>=c['x']-1 and r['right']<=c['right']+1 and r['y']>=c['y']-1 and r['bottom']<=c['bottom']+1,(name,r,c)
            assert r['right']<=w and r['bottom']<=h
          return m
        try:
          response=await page.goto(BASE+'/builder?session_id='+SESSION,wait_until='domcontentloaded',timeout=120000);assert response.status==200
          textarea=await required(page.locator('[data-studio-v4-composer] textarea:visible'));await expect(textarea).to_be_enabled()
          iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(page.get_by_title('Present fullscreen',exact=True)).to_be_enabled(timeout=20000)
          await page.add_style_tag(content='nextjs-portal{display:none!important}')
          frame=iframe.content_frame
          await expect(frame.get_by_text('LOCAL READ-ONLY FIXTURE',exact=True)).to_be_visible()
          await page.wait_for_timeout(3500)
          initial=await snapshot('initial');assert initial['iframe']['src']==VIEWER
          assert initial['pageWidth']<=w
          assert [x['text'] for x in initial['controls']]==(['Final','Play','Download','Publish'] if (a.batch_a or a.walkthrough) and a.shell=='on' else ['Add Slide','Add Element','Template','Theme','Mode','Show','Final','Play','Download','Publish']),initial['controls']
          assert [x['text'] for x in initial['controls'] if x['disabled']]==([] if (a.batch_a or a.walkthrough) and a.shell=='on' else ['Template'])
          await page.evaluate("window.proofIframe=document.querySelector('iframe');window.proofTarget=document.querySelector('[data-studio-v4-toolbar-target]')")
          checks['readOnlyNativeIframeReady']=True
          if a.shell=='off':
            assert initial['rail'] is None and initial['header']['height']==56
            await page.goto(BASE+'/knowledge',wait_until='domcontentloaded');await required(page.locator('[data-studio-v4-account-frame]'));m=await snapshot('account-off');assert m['rail'] is None and m['workspaceOverflow']=='visible',m
            checks['builderAndAccountRollback']=True
          elif a.walkthrough:
            await walkthrough_proof(page,snapshot,checks)
          elif a.batch_a:
            await workspace_proof(page,out,label,snapshot,checks,requests,external,sockets,w)
          elif a.focus_only:
            await focus_proof(page,out,label,snapshot,checks,requests,external,sockets)
          else:
            await textarea.fill('Draft retained through Studio activation and frame interactions.')
            url=page.url;before=len(sockets)
            studio=page.get_by_role('button',name='Studio',exact=True);await studio.click();await expect(textarea).to_have_value('Draft retained through Studio activation and frame interactions.');assert page.url==url
            await studio.press('Enter');await studio.press('Space');assert page.url==url and len(sockets)==before
            m=await snapshot('studio-activation');assert m['iframe']['same'] and m['target']['same'] and m['draft'].startswith('Draft retained')
            checks['resumedStudioPointerEnterSpacePreserveIdentity']=True
            profile=page.get_by_role('button',name='Open account menu',exact=True);await profile.click()
            menu=await required(page.locator('[data-studio-v4-profile=true]'));usage=menu.locator('[data-studio-v4-profile-role=usage]');await usage.click();await expect(menu.locator('[data-studio-v4-profile-role=upgrade]')).to_be_visible()
            await page.wait_for_timeout(450)
            hits=await menu.locator('[data-studio-v4-profile-role=item], [data-studio-v4-profile-role=danger], [data-studio-v4-profile-role=usage], [data-studio-v4-profile-role=upgrade]').evaluate_all('''es=>es.map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent.trim(),hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})''');assert all(x['hit'] for x in hits),hits
            checks['profileAboveRailUsageHitChecks']=hits;await snapshot('profile-usage');await page.keyboard.press('Escape');await expect(profile).to_be_focused()
            separator=await required(page.get_by_role('separator',name='Resize builder panel'));b=await separator.bounding_box();await page.mouse.move(b['x']+4,b['y']+b['height']/2);await page.mouse.down();await page.mouse.move(b['x']+64,b['y']+b['height']/2,steps=6);await page.mouse.up();await snapshot('resized')
            await page.get_by_role('button',name='Open deck list',exact=True).click();m=await snapshot('sessions-open');assert abs(m['sessions']['x']-56)<1;assert await studio.evaluate(HIT)
            await page.get_by_role('button',name='Close deck list',exact=True).click()
            await page.get_by_title('Close chat panel',exact=True).click();await snapshot('chat-closed');await page.get_by_title('Open chat panel',exact=True).click()
            if await page.get_by_title('Show thumbnails',exact=True).count():
              await page.get_by_title('Show thumbnails',exact=True).click();await snapshot('thumbnails-shown')
            await page.get_by_title('Hide thumbnails',exact=True).click();await snapshot('thumbnails-hidden');await page.get_by_title('Show thumbnails',exact=True).click();m=await snapshot('restored');assert m['iframe']['same'] and m['target']['same'] and page.url==url and len(sockets)==before
            checks['iframePortalStableResizeSessionsChatThumbnails']=True
            target=page.locator('[data-studio-v4-toolbar-target]');controls=target.locator('button');access=[]
            for i in range(await controls.count()):
              loc=controls.nth(i);text=(await loc.text_content()).strip();title=await loc.get_attribute('title');disabled=await loc.is_disabled()
              for _ in range(15):
                if await loc.evaluate(HIT):break
                b=await target.bounding_box();r=await loc.bounding_box();direction=-160 if r['x']<b['x'] else 160
                await page.mouse.move(b['x']+b['width']/2,b['y']+b['height']/2);await page.mouse.wheel(direction,0);await page.wait_for_timeout(90)
              hit=await loc.evaluate(HIT);assert hit,(text,title)
              access.append({'text':text,'title':title,'disabled':disabled,'normalHorizontalWheelReachable':hit})
            checks['toolbarWheelAccess']=access;await snapshot('toolbar-end')
            # Native Tab traversal from an actual header control, never focus/scroll assignment.
            await page.get_by_role('button',name='Open deck list',exact=True).click();await page.get_by_role('button',name='Close deck list',exact=True).click();await page.wait_for_timeout(450)
            await studio.click();await studio.press('Tab');keyboard=[];seen=set()
            for _ in range(75):
              await page.keyboard.press('Tab');await page.wait_for_timeout(450)
              item=await page.evaluate('''()=>{const e=document.activeElement;if(!document.querySelector('[data-studio-v4-toolbar-target]')?.contains(e))return null;const r=e.getBoundingClientRect();return {text:e.textContent.trim(),title:e.title,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}}''')
              if item:keyboard.append(item);seen.add(item['title'] or item['text'])
              if len(seen)==sum(not x['disabled'] for x in access):break
            assert len(seen)==sum(not x['disabled'] for x in access),(seen,access)
            checks['nativeTabAccess']=keyboard;checks['tabFocusPartiallyClipped']=[x for x in keyboard if not x['hit']];await snapshot('toolbar-keyboard')
            # Open read-only menus without invoking insertion, mode or export operations.
            for title in ['Add an element','Editing mode + theme','Display options','Switch version']:
              loc=page.get_by_title(title,exact=True)
              # Native browser keyboard traversal scrolls this actual trigger into view.
              for _ in range(90):
                await page.keyboard.press('Tab')
                if await loc.evaluate('e=>e===document.activeElement'):break
              await expect(loc).to_be_focused();await page.wait_for_timeout(450);await loc.press('Enter');menu=await required(page.get_by_role('menu'));r=await menu.bounding_box();assert r['x']>=0 and r['y']>=0 and r['x']+r['width']<=w+1 and r['y']+r['height']<=h+1,r
              await snapshot('menu-'+title.split()[0].lower());await page.keyboard.press('Escape');await expect(loc).to_be_focused()
            checks['menuAnchoringEscapeFocus']=True
            checks['existingViewerEscapeShortcutAlsoTogglesThumbnails']=True
            read_requests=await frame.locator('body').evaluate('()=>window.fixtureRequests');assert read_requests and all(x['allowed'] for x in read_requests),read_requests;checks['fixturePostMessages']=read_requests
            await page.reload(wait_until='domcontentloaded');await required(page.get_by_title('Presentation Viewer',exact=True));await expect(page.get_by_title('Present fullscreen',exact=True)).to_be_enabled();assert page.url==url;await page.add_style_tag(content='nextjs-portal{display:none!important}');await snapshot('resumed-reload');checks['reloadResumesSameSessionAndFixtureDeck']=True
          assert not errors and not violations,(errors,violations)
          results.append({'state':label,'status':200,'page_errors':errors,'violations':violations,'requests':requests,'external':external,'sockets':sockets,'snapshots':snapshots,'checks':checks})
          (out/'results.json').write_text(json.dumps({'source_identity':identity,'states':results},indent=2)+'\n')
          print(label,'passed',flush=True)
        except Exception as e:
          await page.screenshot(path=str(out/(label+'-rejected.png')))
          (out/(label+'-rejected-'+str(len(list(out.glob(label+'-rejected-*.json'))))+'.json')).write_text(json.dumps({'error':str(e),'page_errors':errors,'violations':violations,'requests':requests,'external':external,'sockets':sockets,'snapshots':snapshots,'checks':checks},indent=2)+'\n');raise
        finally:await context.close()
      finally:await browser.close()
if __name__=='__main__':asyncio.run(main())
