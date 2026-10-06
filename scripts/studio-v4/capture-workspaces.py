"""Candidate screens: exact read-only fixtures; never acknowledge saves or send service traffic."""
import asyncio, json, hashlib, subprocess, argparse, urllib.request, urllib.error
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright, expect
from capture import ROOT, BASE, USER, NOW, required, socket_kind
SESSION='11111111-1111-4111-8111-111111111111'
ROUTES={'Templates':'/studio/templates','Themes & brand':'/studio/themes','Intelligence':'/studio/intelligence','Your details':'/studio/details'}
import importlib.util
_fixture_spec=importlib.util.spec_from_file_location('populated_fixture',ROOT/'scripts/studio-v4/capture-populated.py')
_fixture_module=importlib.util.module_from_spec(_fixture_spec);_fixture_spec.loader.exec_module(_fixture_module)
VIEWER=_fixture_module.VIEWER;HTML=_fixture_module.HTML
FIXTURES=json.loads((ROOT/'scripts/studio-v4/workspace-fixtures.json').read_text())
async def main():
    parser=argparse.ArgumentParser();parser.add_argument('--auth-only',action='store_true');parser.add_argument('--library-states',action='store_true');args=parser.parse_args()
    config=json.loads((ROOT/'.env.studio-v4-runtime/preview-config.json').read_text());assert config['shell']=='true' and config['type']=='false'
    features=json.loads((ROOT/'.env.studio-v4-runtime/preview-features.json').read_text());assert features['templateBuilder']=='true'
    out=ROOT.parent/'studio-v4-workspaces-captures-20261001';out.mkdir(exist_ok=True)
    # Middleware proof does not follow redirects, invoke UI, or contact services.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
      def redirect_request(self,*a):return None
    opener=urllib.request.build_opener(NoRedirect);auth=[]
    for path in ROUTES.values():
      for kind in ['anonymous','pending','approved']:
        headers={}
        if kind!='anonymous':
          c=json.loads((ROOT/'.env.studio-v4-runtime'/('pending-cookie.json' if kind=='pending' else 's0-cookie.json')).read_text());headers={'Cookie':c['name']+'='+c['value']}
        try:r=opener.open(urllib.request.Request(BASE+path,headers=headers),timeout=60)
        except urllib.error.HTTPError as e:r=e
        row={'path':path,'kind':kind,'status':r.status,'location':r.headers.get('Location')};auth.append(row)
        if kind=='approved':assert r.status==200,row;r.read()
        else:assert r.status in [302,307] and ('/auth/signin' if kind=='anonymous' else '/auth/pending') in row['location'],row
    (out/'auth.json').write_text(json.dumps(auth,indent=2)+'\n')
    if args.auth_only:return
    results=[]
    cases=[('light-1280x720',1280,720,False),('dark-1030x600',1030,600,True),('narrow-390x844',390,844,False)]
    if args.library_states:cases=[cases[1]]
    identity={'commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'files':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for folder in ['components/studio-personal','components/studio-libraries','app/(app)/studio'] for p in (ROOT/folder).rglob('*') if p.is_file()}}
    async with async_playwright() as pw:
      browser=await pw.chromium.launch()
      try:
       for label,w,h,dark in cases:
        context=await browser.new_context(viewport={'width':w,'height':h},color_scheme='dark' if dark else 'light',service_workers='block')
        await context.add_cookies([json.loads((ROOT/'.env.studio-v4-runtime/s0-cookie.json').read_text())])
        await context.add_init_script("if(location.origin==='http://127.0.0.1:8792'){localStorage.setItem('theme',"+json.dumps('dark' if dark else 'light')+");localStorage.setItem("+json.dumps('deckster:last_session_id:'+USER['id'])+","+json.dumps(SESSION)+");}")
        errors=[];violations=[];requests=[];sockets=[];snapshots={};checks={};theme_case='ready';template_case='ready'
        async def route_handler(route):
          req=route.request;u=urlparse(req.url);path=u.path
          if req.url==VIEWER and req.method=='GET':
            requests.append({'method':'GET','url':req.url,'disposition':'exact-local-thumbnail-html-fixture'});await route.fulfill(content_type='text/html',body=HTML);return
          if u.netloc!='127.0.0.1:8792':
            if u.hostname not in ['va.vercel-scripts.com','vitals.vercel-insights.com']:violations.append(req.method+' '+req.url)
            await route.abort();return
          if not path.startswith('/api/'):await route.continue_();return
          requests.append({'method':req.method,'path':path})
          if req.method!='GET':violations.append('Refused mutation '+req.method+' '+path);await route.fulfill(status=405,json={'error':'Read-only fixture'});return
          if path=='/api/auth/session':data={'user':USER,'expires':'2099-01-01T00:00:00Z'}
          elif path=='/api/subscription':data={'subscription':None}
          elif path=='/api/themes':
            if theme_case=='error':await route.fulfill(status=503,json={'error':'Fixture theme library unavailable'});return
            data=FIXTURES['themes'] if theme_case=='ready' else {'themes':[],'count':0}
          elif path=='/api/themes/standard':data={'theme':FIXTURES['themes']['themes'][0]}
          elif path=='/api/templates':
            if template_case=='error':await route.fulfill(status=503,json={'error':'Fixture template library unavailable'});return
            data=FIXTURES['templates'] if template_case=='ready' else {'templates':[],'count':0}
          elif path=='/api/templates/fixture-template-review':data=FIXTURES['template']
          elif path=='/api/templates/fixture-template-cleanup':data={**FIXTURES['templates']['templates'][1],'template_blueprint':None}
          elif path=='/api/sessions':data={'sessions':[{'id':SESSION,'title':'Local review deck','status':'active','currentStage':6,'createdAt':NOW,'updatedAt':NOW,'slideCount':2,'finalPresentationUrl':'https://layout-builder-v75-uat.up.railway.app/p/studio-v4-local-renderer','messages':[]}],'pagination':{'total':1,'limit':100,'offset':0,'hasMore':False}}
          else:violations.append('Unexpected GET '+path);await route.fulfill(status=404,json={});return
          await route.fulfill(json=data)
        await context.route('**/*',route_handler)
        async def ws_handler(ws):
          sockets.append(ws.url)
          if socket_kind(ws.url)=='development':ws.connect_to_server();return
          violations.append(ws.url);await ws.close()
        await context.route_web_socket('**/*',ws_handler)
        page=await context.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
        async def shot(name):
          await page.wait_for_timeout(350);assert not errors and not violations,(errors,violations)
          m=await page.evaluate('''()=>({url:location.href,viewport:{w:innerWidth,h:innerHeight},pageWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight,heading:document.querySelector('h1')?.textContent,header:document.querySelector('[data-studio-v4-shell-header]')?.textContent,rail:[...document.querySelectorAll('[data-studio-v4-rail] nav a')].map(e=>({label:e.getAttribute('aria-label'),href:e.getAttribute('href'),current:e.getAttribute('aria-current')})),fields:[...document.querySelectorAll('main input,main select,main textarea')].map(e=>({name:e.getAttribute('aria-label')||e.closest('label')?.textContent.trim(),value:e.value,disabled:e.disabled})),disabled:[...document.querySelectorAll('main button:disabled')].map(e=>e.textContent.trim()),previews:[...document.querySelectorAll('.sl-stage,.sp-title-slide,.sp-content-slide')].map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,x:r.x,y:r.y}})})''')
          assert m['pageWidth']<=w,(name,m['pageWidth'],w)
          snapshots[name]=m;await page.add_style_tag(content='nextjs-portal{display:none!important}');await page.screenshot(path=str(out/(label+'-'+name+'.png')),full_page=True,animations='disabled')
        async def go(path):
          response=await page.goto(BASE+path,wait_until='domcontentloaded',timeout=120000);assert response.status==200
          await page.wait_for_load_state('networkidle',timeout=30000)
          await required(page.locator('[data-studio-v4-rail]'));await page.add_style_tag(content='nextjs-portal{display:none!important}')
        try:
          if args.library_states:
            theme_case='error';await go('/studio/themes');root=await required(page.locator('[data-studio-library=themes]'))
            await root.get_by_role('button',name='Library',exact=True).click();await expect(root.get_by_role('heading',name='Library unavailable',exact=True)).to_be_visible();await shot('themes-error')
            theme_case='empty';await root.get_by_role('button',name='Refresh themes',exact=True).click();await expect(root.get_by_role('heading',name='Your identity starts here.',exact=True)).to_be_visible();await shot('themes-empty')
            theme_case='ready';await root.get_by_role('button',name='Refresh themes',exact=True).click();await expect(root.get_by_role('button',name='Evergreen studio',exact=False)).to_be_visible();await shot('themes-recovered')
            template_case='error';await go('/studio/templates');root=await required(page.locator('[data-studio-library=templates]'))
            await root.get_by_role('button',name='Library',exact=True).click();await expect(root.get_by_role('heading',name='Library unavailable',exact=True)).to_be_visible();await shot('templates-error')
            template_case='empty';await root.get_by_role('button',name='Refresh templates',exact=True).click();await expect(root.get_by_role('heading',name='Your best stories belong here.',exact=True)).to_be_visible();await shot('templates-empty')
            template_case='ready';await root.get_by_role('button',name='Refresh templates',exact=True).click();await expect(root.get_by_role('button',name='Quarterly business review',exact=False)).to_be_visible();await shot('templates-recovered')
            checks['exact503EmptyAndRefreshRecovery']=True
            results.append({'state':label,'page_errors':errors,'violations':violations,'requests':requests,'sockets':sockets,'snapshots':snapshots,'checks':checks})
            (out/'library-states.json').write_text(json.dumps({'source_identity':identity,'states':results},indent=2)+'\n');print('library failure / empty / recovery passed',flush=True);continue
          await go('/studio/templates');root=await required(page.locator('[data-studio-library=templates]'))
          # Confirm the actual mode handler has hydrated before typing into SSR fields.
          await root.get_by_role('button',name='Library',exact=True).click();await expect(root.get_by_label('Search saved templates',exact=True)).to_be_visible();await root.get_by_role('button',name='Create',exact=True).click();await expect(root.get_by_label('Template name',exact=True)).to_be_visible()
          await root.get_by_label('Template name',exact=True).fill('Quarterly story draft');await root.get_by_label('Deck purpose',exact=True).fill('Review progress and decisions.');await root.get_by_label('Slide title',exact=True).fill('A clear direction');await shot('templates-create')
          await root.get_by_role('button',name='Add a slide',exact=True).click();await root.get_by_label('Slide title',exact=True).fill('Evidence behind progress')
          await root.get_by_role('button',name='Library',exact=True).click();await root.get_by_role('button',name='Quarterly business review',exact=False).click();await required(root.get_by_role('button',name='Next template slide',exact=True));await shot('templates-library')
          await root.get_by_role('button',name='Next template slide',exact=True).click();await root.locator('summary').filter(has_text='Explore blueprint details').click();await shot('template-blueprint-details')
          await root.get_by_role('button',name='Customer growth story',exact=False).click();await expect(root.get_by_text('Cleanup: Fixture: a source-specific metric still needs review.',exact=True)).to_be_visible();await shot('template-cleanup')
          await root.get_by_role('button',name='Create',exact=True).click();await expect(root.get_by_label('Template name',exact=True)).to_have_value('Quarterly story draft');await expect(root.get_by_label('Slide title',exact=True)).to_have_value('Evidence behind progress');checks['templateDraftAndReadiness']=True
          await page.locator('[data-studio-v4-rail]').get_by_role('link',name='Themes & brand',exact=True).click();root=await required(page.locator('[data-studio-library=themes]'))
          await root.get_by_label('Theme name',exact=True).fill('Local sage draft');await root.get_by_role('button',name='Custom palette',exact=True).click();await root.get_by_label('Primary / brand hex value',exact=True).fill('#287B78');await shot('themes-create')
          await root.get_by_role('button',name='Library',exact=True).click();await root.get_by_role('button',name='Evergreen studio',exact=False).click();await shot('themes-library')
          await root.get_by_role('button',name='Customize a copy',exact=True).click();await root.get_by_role('button',name='Discard & continue',exact=True).click();await expect(root.get_by_label('Theme name',exact=True)).to_have_value('Evergreen studio copy');await root.get_by_label('Primary / brand hex value',exact=True).fill('invalid');await expect(root.get_by_role('button',name='Save reusable theme',exact=True)).to_be_disabled();await shot('theme-invalid-guard');checks['themeCopyAndInvalidSaveGuard']=True
          await page.locator('[data-studio-v4-rail]').get_by_role('link',name='Intelligence',exact=True).click();root=await required(page.locator('[data-studio-personal=intelligence]'))
          model=root.get_by_label('Planning & Strategy model',exact=True);await model.select_option('google/gemini-3.1-pro-preview');await expect(root.get_by_role('button',name='Apply to Deckster',exact=True)).to_be_disabled();await shot('intelligence-draft')
          await root.get_by_role('button',name='Compare Imagery models',exact=True).click();await shot('intelligence-imagery');await root.get_by_role('button',name='Reset draft',exact=True).click();await expect(model).to_have_value('default');checks['modelDraftResetNoApply']=True
          await page.locator('[data-studio-v4-rail]').get_by_role('link',name='Your details',exact=True).click();root=await required(page.locator('[data-studio-personal=details]'))
          await root.get_by_label('Author name',exact=False).fill('Alex Morgan');await root.get_by_label('Job title',exact=True).fill('Product Director');await root.get_by_label('Organization',exact=True).fill('Northstar');await expect(root.get_by_role('button',name='Save as defaults',exact=True)).to_be_disabled();await shot('details-identity')
          await root.get_by_role('button',name='Footer & logo',exact=True).click();await root.get_by_label('Footer style',exact=False).select_option('pages');await root.get_by_label('Confidentiality note',exact=False).fill('Internal review');await root.get_by_role('button',name='Content',exact=True).click();await expect(root.get_by_text('Page 2 of 8',exact=True)).to_be_visible();await shot('details-footer');checks['presenterDraftNoSave']=True
          await page.locator('[data-studio-v4-rail]').get_by_role('link',name='Decks',exact=True).click();await expect(page.locator('[data-studio-deck-card-header] .line-clamp-1').get_by_text('Local review deck',exact=True)).to_be_visible();await shot('decks')
          await page.locator('[data-studio-v4-rail]').get_by_role('link',name='Knowledge',exact=True).click();await required(page.locator('[data-studio-v4-access]'));await shot('knowledge-existing-gate');checks['existingDecksKnowledgeNavigation']=True
          assert all(r['method']=='GET' for r in requests)
          results.append({'state':label,'page_errors':errors,'violations':violations,'requests':requests,'sockets':sockets,'snapshots':snapshots,'checks':checks});(out/'results.json').write_text(json.dumps({'source_identity':identity,'config':config,'features':features,'states':results},indent=2)+'\n');print(label,'passed',flush=True)
        except Exception as e:
          await page.screenshot(path=str(out/(label+'-rejected.png')),full_page=True);(out/(label+'-rejected.json')).write_text(json.dumps({'error':str(e),'page_errors':errors,'violations':violations,'requests':requests,'snapshots':snapshots},indent=2)+'\n');raise
        finally:await context.close()
      finally:await browser.close()
if __name__=='__main__':asyncio.run(main())
