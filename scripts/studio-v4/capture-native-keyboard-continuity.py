"""Bounded keyboard/selected-native replay; isolated intercepted reads only."""
import asyncio, hashlib, json, re, subprocess, sys, types
from pathlib import Path
from playwright.async_api import expect

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import native_viewer as nv

OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
MODE = sys.argv[2] if len(sys.argv) > 2 else 'probe'
assert MODE in ['probe', 'dialog-probe', 'template-probe', 'after']
FILES = subprocess.check_output(['git', 'ls-files', 'app', 'components', 'hooks', 'lib', 'types', 'prisma', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'next.config.ts', 'scripts/studio-v4/walkthrough.py', 'scripts/studio-v4/native_viewer.py', 'scripts/studio-v4/capture.py', 'scripts/studio-v4/capture-next.py'], cwd=ROOT, text=True).splitlines()
FILES.append(str(Path(__file__).relative_to(ROOT)))
def hashes(): return {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in FILES}
START = hashes(); COMMIT = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
STATES = []; OBSERVATIONS = {}; PASSED = False
s = nv.SAMPLE['slides'][0]
s['content']['rich_content'] = ''
s['text_boxes'] = [{'id': 'local-keyboard-text', 'parent_slide_id': s['slide_id'], 'position': {'grid_row': '7/15', 'grid_column': '3/17'}, 'component_type': 'TEXT_BOX', 'content': '<p>LOCAL SAMPLE · Keyboard and selection</p><p>Existing native tools remain available.</p>', 'text_style': {'font_size': 44}, 'z_index': 1000, 'generation_config': {'component_type': 'TEXT_BOX', 'prompt': 'Native keyboard untouched prompt', 'structure': 'classic', 'count': 2}}]
async def skip_thumbnails(self, pw): pass
nv.NativeViewer.thumbnails = skip_thumbnails
(OUT / 'probe.py').write_bytes(Path(__file__).read_bytes())
(OUT / 'sample.json').write_text(json.dumps(nv.SAMPLE, indent=2) + '\n')

async def verify(page, ctx, browser, errors, violations, denied, native, session):
    global PASSED
    iframe = page.get_by_title('Presentation Viewer', exact=True)
    f = iframe.content_frame
    frame = await (await iframe.element_handle()).content_frame()
    text = f.locator('#local-keyboard-text')
    prompt = page.locator('textarea[aria-label="Generation prompt"]:visible')
    await page.set_viewport_size({'width': 1440, 'height': 900})
    await frame.wait_for_function('window.Reveal && Reveal.isReady() && window.ElementManager')
    await expect(text).to_be_visible()
    await page.evaluate('window.__nativeKeyboardFrame=document.querySelector(\'iframe[title="Presentation Viewer"]\')')
    await frame.evaluate('window.__nativeKeyboardBody=document.body')
    def result():
        (OUT / 'results.json').write_text(json.dumps({'passed': PASSED, 'mode': MODE, 'states': STATES, 'observations': OBSERVATIONS, 'page_errors': errors, 'violations': violations, 'refused_writes': denied, 'source_start': START, 'source_end': hashes(), 'source_commit': COMMIT, 'layout_ref': nv.LAYOUT_REF, 'browser': browser.version, 'scope': 'Isolated headless actual native renderer with supplied records. No genuine account, service write, save/reopen or OS keyboard/fullscreen acceptance.'}, indent=2) + '\n')
    async def focus():
        return await page.evaluate('''()=>{const e=document.activeElement,r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,text:e.innerText?.slice(0,80),label:e.getAttribute('aria-label'),title:e.title,rect:r.toJSON(),focusVisible:e.matches(':focus-visible'),outline:s.outline,shadow:s.boxShadow,inFullscreen:!!document.fullscreenElement?.contains(e)}}''')
    async def tab_to(locator, reverse=False, count=100):
        for _ in range(count):
            if await locator.evaluate('e=>e===document.activeElement'): return
            await page.keyboard.press('Shift+Tab' if reverse else 'Tab')
        raise AssertionError(('Unreachable keyboard target', await focus()))
    async def record(name, require_selected=False):
        await page.wait_for_timeout(450)
        info = await frame.evaluate('''()=>{const e=document.querySelector('#local-keyboard-text'),r=e.getBoundingClientRect(),selected=window.ElementManager.getSelectedElement();return {mode:document.body.dataset.mode,index:Reveal.getIndices().h,sameDocument:window.__nativeKeyboardBody===document.body,selected:selected?{id:selected.id,type:selected.type}:null,element:{className:e.className,rect:r.toJSON()},viewport:{width:innerWidth,height:innerHeight},nativeButtons:[...e.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect(),s=getComputedStyle(b),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {label:b.getAttribute('aria-label')||b.title,rect:r.toJSON(),visible:s.visibility!=='hidden'&&s.display!=='none',inside:r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:!!h&&(h===b||b.contains(h))}})}}''')
        parent = await iframe.evaluate('e=>({sameIframe:e===window.__nativeKeyboardFrame,rect:e.getBoundingClientRect().toJSON(),visible:getComputedStyle(e).visibility,fullscreen:!!document.fullscreenElement})')
        assert parent['sameIframe'] and info['sameDocument'] and info['index'] == 0
        if require_selected: assert info['selected'] and info['selected']['id'] == 'local-keyboard-text', info
        assert not errors and not violations and not denied, (errors, violations, denied)
        await page.screenshot(path=str(OUT / (name + '.png')))
        STATES.append({'name': name, 'parent': parent, 'native': info, 'focus': await focus()}); result()
    try:
        await f.locator('section.present .slide-title').click(); await page.keyboard.press('e')
        await expect(f.locator('body')).to_have_attribute('data-mode', 'edit')
        await text.locator('.textbox-content').click()
        await record('selected-wide-native-chrome', True)
        if MODE in ['probe', 'dialog-probe', 'template-probe']:
            await page.get_by_title('Present fullscreen', exact=True).click()
            await page.wait_for_function('!!document.fullscreenElement')
            await page.mouse.move(50, 10)
            if MODE == 'template-probe':
                failures = []
                for label in ['Save Template', 'Upload presentation…']:
                    trigger = page.get_by_role('button', name='Template', exact=True)
                    await tab_to(trigger); await page.keyboard.press('Enter')
                    item = page.get_by_role('menuitem', name=label, exact=True)
                    if not await item.count() or await item.get_attribute('aria-disabled') == 'true':
                        OBSERVATIONS[label] = {'unavailable': True, 'reason': 'Native current gate retained'}
                        raise AssertionError(('Expected native template entry unavailable', label))
                    await page.keyboard.press('Home')
                    for _ in range(20):
                        if await item.evaluate('e=>e===document.activeElement'): break
                        await page.keyboard.press('ArrowDown'); await page.wait_for_timeout(50)
                    await expect(item).to_be_focused(); await page.keyboard.press('Enter')
                    dialog = page.get_by_role('dialog'); await expect(dialog).to_have_count(1)
                    await page.wait_for_timeout(350)
                    info = await dialog.evaluate('e=>({inFullscreen:!!document.fullscreenElement?.contains(e),focusInside:e.contains(document.activeElement),rect:e.getBoundingClientRect().toJSON()})')
                    OBSERVATIONS[label] = info
                    await record('fullscreen-'+('template-save' if label == 'Save Template' else 'template-upload')+'-dialog')
                    await page.keyboard.press('Escape'); await expect(dialog).to_have_count(0)
                    if not info['inFullscreen'] or not info['focusInside']: failures.append(label)
                assert not failures, failures
                assert [x['name'] for x in STATES] == ['selected-wide-native-chrome', 'fullscreen-template-save-dialog', 'fullscreen-template-upload-dialog']
                assert START == hashes() and not errors and not violations and not denied
                PASSED = True
                return
            if MODE == 'dialog-probe':
                publish = page.get_by_role('button', name='Publish', exact=True)
                await tab_to(publish); await page.keyboard.press('Enter')
                dialog = page.get_by_role('dialog')
                await expect(dialog).to_have_count(1)
                await page.wait_for_timeout(350)
                OBSERVATIONS['fullscreenPublish'] = await dialog.evaluate('e=>({inFullscreen:!!document.fullscreenElement?.contains(e),focusInside:e.contains(document.activeElement),rect:e.getBoundingClientRect().toJSON()})')
                await record('fullscreen-Publish-dialog-probe')
                await page.keyboard.press('Escape')
                assert OBSERVATIONS['fullscreenPublish']['inFullscreen'] and OBSERVATIONS['fullscreenPublish']['focusInside'], OBSERVATIONS['fullscreenPublish']
                assert [x['name'] for x in STATES] == ['selected-wide-native-chrome', 'fullscreen-Publish-dialog-probe']
                assert START == hashes() and not errors and not violations and not denied
                PASSED = True
                return
            add = page.get_by_role('button', name='Add Slide', exact=True)
            await tab_to(add); await page.keyboard.press('Enter')
            popup = page.get_by_label('Choose a slide layout', exact=True)
            await expect(popup).to_have_count(1)
            OBSERVATIONS['fullscreenAddSlide'] = await popup.evaluate('e=>({inFullscreen:!!document.fullscreenElement?.contains(e),rect:e.getBoundingClientRect().toJSON(),focusInside:e.contains(document.activeElement),focus:document.activeElement.outerHTML,hit:!!document.elementFromPoint(e.getBoundingClientRect().x+20,e.getBoundingClientRect().y+20)&&e.contains(document.elementFromPoint(e.getBoundingClientRect().x+20,e.getBoundingClientRect().y+20))})')
            await record('fullscreen-add-slide-probe')
            assert all(OBSERVATIONS['fullscreenAddSlide'][k] for k in ['inFullscreen', 'focusInside', 'hit']), OBSERVATIONS['fullscreenAddSlide']
            assert [x['name'] for x in STATES] == ['selected-wide-native-chrome', 'fullscreen-add-slide-probe']
            assert START == hashes() and not errors and not violations and not denied
        if MODE == 'after':
            chat = page.get_by_role('textbox', name='Message Director', exact=True)
            await chat.fill('Unsent keyboard workspace continuity draft')
            await page.get_by_title('Close chat panel', exact=True).click()
            await record('selected-Director-collapsed-native-chrome', True)
            await page.get_by_role('button', name='Hide thumbnails', exact=True).click()
            await record('selected-thumbnails-collapsed-native-chrome', True)
            await page.get_by_role('button', name='Show thumbnails', exact=True).click()
            await page.get_by_title('Open chat panel', exact=True).click()
            await expect(chat).to_have_value('Unsent keyboard workspace continuity draft')
            await text.hover(); await text.get_by_role('button', name='Refine element', exact=True).click()
            await expect(prompt).to_have_value('Native keyboard untouched prompt')
            await prompt.click(); await page.keyboard.press('End'); await page.keyboard.type(' unsent keyboard draft')
            role = page.get_by_role('button', name='Role', exact=True)
            await tab_to(role); await page.keyboard.press('Enter')
            await expect(page.get_by_label('Role options', exact=True)).to_be_visible()
            await page.keyboard.press('Escape'); await expect(role).to_be_focused()
            await tab_to(page.get_by_role('button', name='Show advanced options', exact=True)); await page.keyboard.press('Enter')
            select = page.locator('#textbox-role:visible')
            await tab_to(select)
            before = await select.input_value()
            await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
            after = await select.input_value()
            OBSERVATIONS['nativeSelectArrow'] = {'before': before, 'after': after, 'changed': before != after, 'scope': 'Browser-dispatched native select keys only; no OS popup input'}
            # A real bounded typeahead fallback; never programmatic select_option.
            await tab_to(select); await page.keyboard.type('Logo', delay=50)
            OBSERVATIONS['nativeSelectTypeahead'] = await select.input_value()
            assert OBSERVATIONS['nativeSelectTypeahead'] == 'slot:logo'
            await page.wait_for_timeout(1100); await page.keyboard.type((await select.locator('option[value="__body_text_auto__"]').inner_text()).strip().split(' ')[0], delay=50)
            await expect(select).to_have_value('__body_text_auto__')
            await record('Inspector-native-select-browser-arrow-and-typeahead')
            await tab_to(page.get_by_role('button', name='Content', exact=True)); await page.keyboard.press('Space')
            font = page.get_by_label('Content Font family', exact=True)
            await tab_to(font)
            r = await focus(); assert r['rect']['top'] >= 0 and r['rect']['bottom'] <= 900 and r['focusVisible'], r
            await record('Inspector-long-form-forward-focus')
            await tab_to(page.get_by_role('button', name='Content', exact=True), reverse=True)
            await page.keyboard.press('Escape'); await expect(prompt).not_to_be_visible()
            await record('selected-Inspector-Escape-return', True)
            # Foreground overlay hides the same iframe; selection and native document stay owned.
            await page.set_viewport_size({'width': 760, 'height': 600})
            switch = page.get_by_role('group', name='Workspace pane', exact=True)
            await switch.get_by_role('button', name='Chat', exact=True).click()
            await expect(chat).to_have_value('Unsent keyboard workspace continuity draft')
            await record('selected-tablet-Chat-overlay', True)
            await switch.get_by_role('button', name='Stage', exact=True).click()
            await record('selected-tablet-Stage-native-chrome', True)
            await page.set_viewport_size({'width': 1440, 'height': 900})
            mode = page.get_by_role('button', name='Mode', exact=True)
            await tab_to(mode); await page.keyboard.press('Enter')
            dark = page.get_by_role('menuitemradio', name='Dark', exact=True)
            await page.keyboard.press('End'); await expect(dark).to_be_focused()
            await page.keyboard.press('Enter'); await expect(page.locator('html')).to_have_class(re.compile('dark'))
            await record('selected-dark-mode-Arrow-End-native-chrome', True)
            # Actual fullscreen entry. Keyboard-only focus reveals the previously hidden toolbar.
            present = page.get_by_title('Present fullscreen', exact=True)
            await tab_to(present); await page.keyboard.press('Enter')
            await page.wait_for_function('!!document.fullscreenElement')
            await expect(f.locator('body')).to_have_attribute('data-mode', 'view')
            await page.wait_for_timeout(3500)
            exit_button = page.get_by_title('Exit fullscreen (ESC)', exact=True)
            await tab_to(exit_button)
            toolbar = page.locator('[data-studio-presentation-toolbar="true"]')
            await page.wait_for_timeout(500)  # Retained native CSS transition must settle.
            OBSERVATIONS['keyboardToolbar'] = await toolbar.evaluate('e=>({opacity:getComputedStyle(e).opacity,transform:getComputedStyle(e).transform,pointerEvents:getComputedStyle(e).pointerEvents,focusInside:e.contains(document.activeElement),rect:e.getBoundingClientRect().toJSON()})')
            assert OBSERVATIONS['keyboardToolbar']['opacity'] == '1' and OBSERVATIONS['keyboardToolbar']['focusInside'], OBSERVATIONS['keyboardToolbar']
            await record('fullscreen-keyboard-reveals-Exit')
            for label in ['Mode', 'Show']:
                trigger = page.get_by_role('button', name=label, exact=True)
                await tab_to(trigger); await page.keyboard.press('Enter')
                menu = page.locator('[role="menu"]:visible'); await expect(menu).to_have_count(1)
                await page.keyboard.press('ArrowDown'); await page.wait_for_timeout(80); a = await focus()
                await page.keyboard.press('ArrowDown'); await page.wait_for_timeout(80); b = await focus()
                await page.keyboard.press('ArrowUp'); await page.wait_for_timeout(80); c = await focus()
                assert a['text'] != b['text'] and a['text'] == c['text'] and a['inFullscreen'] and b['inFullscreen'], (a,b,c)
                OBSERVATIONS['fullscreen'+label+'Arrows'] = [a,b,c]
                await record('fullscreen-'+label+'-Arrow-Up-Down')
                await page.keyboard.press('Escape'); await expect(trigger).to_be_focused()
            add = page.get_by_role('button', name='Add Slide', exact=True)
            await tab_to(add); await page.keyboard.press('Enter')
            popup = page.get_by_label('Choose a slide layout', exact=True)
            await expect(popup).to_be_visible()
            assert await popup.evaluate('e=>document.fullscreenElement.contains(e)')
            await tab_to(page.get_by_label('Find a slide layout', exact=True), count=5)
            await page.keyboard.type('comparison')
            await expect(popup.locator('.slp-card')).to_have_count(1)
            await record('fullscreen-Add-Slide-search-visible-focus')
            await tab_to(page.get_by_role('button', name='Close slide layouts', exact=True), reverse=True, count=4)
            await page.keyboard.press('Enter'); await expect(popup).to_have_count(0); await expect(add).to_be_focused()
            download = page.get_by_role('button', name='Download presentation', exact=True)
            await tab_to(download); await page.keyboard.press('Enter')
            menu = page.locator('[data-studio-download-menu="true"]')
            await expect(menu).to_be_visible(); assert await menu.evaluate('e=>document.fullscreenElement.contains(e)')
            await page.keyboard.press('ArrowDown'); await page.keyboard.press('End')
            await expect(menu.get_by_role('menuitem').last).to_be_focused()
            await record('fullscreen-Download-arrow-last-choice')
            await page.keyboard.press('Escape'); await expect(download).to_be_focused()
            OBSERVATIONS['fullscreenControls'] = await toolbar.get_by_role('button').all_text_contents()
            # Renderer-dispatched Escape is measured; no synthetic fullscreen exit is accepted.
            await page.keyboard.press('Escape'); await page.wait_for_timeout(250)
            OBSERVATIONS['browserFullscreenEscape'] = {'attempted': True, 'exited': not await page.evaluate('!!document.fullscreenElement'), 'tool': 'Playwright browser keyboard dispatch; no shared desktop input'}
            if await page.evaluate('!!document.fullscreenElement'):
                await tab_to(exit_button); await page.keyboard.press('Enter')
                await page.wait_for_function('!document.fullscreenElement')
            await record('keyboard-Exit-return-same-native-slide')
            mode = page.get_by_role('button', name='Mode', exact=True)
            await tab_to(mode); await page.keyboard.press('Enter')
            edit = page.get_by_role('menuitemradio', name='Edit', exact=True)
            await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown')
            await expect(edit).to_be_focused(); await page.keyboard.press('Enter')
            await expect(f.locator('body')).to_have_attribute('data-mode', 'edit')
            await text.hover(); await text.get_by_role('button', name='Refine element', exact=True).click()
            await expect(prompt).to_have_value('Native keyboard untouched prompt unsent keyboard draft')
            await record('Inspector-draft-after-keyboard-fullscreen-return')
            await page.set_viewport_size({'width': 1030, 'height': 450})
            await expect(prompt).to_have_value('Native keyboard untouched prompt unsent keyboard draft')
            await record('short-dark-Inspector-retained-keyboard-draft')
            await page.keyboard.press('Escape'); await expect(prompt).not_to_be_visible()
            switch = page.get_by_role('group', name='Workspace pane', exact=True)
            if await switch.get_by_role('button', name='Stage', exact=True).count():
                await switch.get_by_role('button', name='Stage', exact=True).click()
            elif await page.get_by_title('Close chat panel', exact=True).count():
                await page.get_by_title('Close chat panel', exact=True).click()
            await text.locator('.textbox-content').click()
            await record('short-dark-selected-native-chrome', True)
            await text.locator('.textbox-content').click()
            assert await frame.evaluate('document.activeElement.isContentEditable')
            await page.keyboard.press('Meta+a')
            OBSERVATIONS['shortNativeFormattingChrome'] = await frame.evaluate("""()=>[...document.querySelectorAll('[id*=toolbar]')].filter(e=>getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&e.getBoundingClientRect().width>0).map(e=>({id:e.id,rect:e.getBoundingClientRect().toJSON(),viewport:{width:innerWidth,height:innerHeight},buttons:[...e.querySelectorAll('button')].map(b=>({label:b.title||b.getAttribute('aria-label')||b.innerText,rect:b.getBoundingClientRect().toJSON()}))}))""")
            await record('short-dark-native-selected-text-formatting')
            present = page.get_by_title('Present fullscreen', exact=True)
            await tab_to(present); await page.keyboard.press('Enter')
            await page.wait_for_function('!!document.fullscreenElement')
            add = page.get_by_role('button', name='Add Slide', exact=True)
            await tab_to(add); await page.keyboard.press('Enter')
            popup = page.get_by_label('Choose a slide layout', exact=True)
            await expect(popup).to_be_visible()
            assert await popup.evaluate('e=>document.fullscreenElement.contains(e)')
            await tab_to(page.get_by_label('Find a slide layout', exact=True), count=5)
            await page.keyboard.type('blank')
            await expect(popup.locator('.slp-card')).to_have_count(1)
            await record('short-dark-fullscreen-layout-search-focus')
            await page.keyboard.press('Escape'); await expect(add).to_be_focused()
            exit_button = page.get_by_title('Exit fullscreen (ESC)', exact=True)
            await tab_to(exit_button); await page.keyboard.press('Enter')
            await page.wait_for_function('!document.fullscreenElement')
            await record('short-dark-keyboard-fullscreen-return')
            plain = await ctx.new_page()
            await plain.set_content('<button>Start</button><select aria-label="Plain native select"><option value="a">Alpha</option><option value="b">Beta</option><option value="c">Gamma</option></select>')
            await plain.keyboard.press('Tab'); await plain.keyboard.press('Tab')
            plain_select = plain.get_by_label('Plain native select', exact=True)
            await expect(plain_select).to_be_focused()
            await plain.keyboard.press('ArrowDown'); await plain.keyboard.press('Enter')
            OBSERVATIONS['plainNativeSelectArrow'] = {'value': await plain_select.input_value(), 'scope': 'Independent plain native control, actual Tab and browser-dispatched keys'}
            await plain.keyboard.type('Beta', delay=50); await expect(plain_select).to_have_value('b')
            OBSERVATIONS['plainNativeSelectTypeahead'] = await plain_select.input_value()
            await plain.close()
            expected = ['selected-wide-native-chrome','selected-Director-collapsed-native-chrome','selected-thumbnails-collapsed-native-chrome','Inspector-native-select-browser-arrow-and-typeahead','Inspector-long-form-forward-focus','selected-Inspector-Escape-return','selected-tablet-Chat-overlay','selected-tablet-Stage-native-chrome','selected-dark-mode-Arrow-End-native-chrome','fullscreen-keyboard-reveals-Exit','fullscreen-Mode-Arrow-Up-Down','fullscreen-Show-Arrow-Up-Down','fullscreen-Add-Slide-search-visible-focus','fullscreen-Download-arrow-last-choice','keyboard-Exit-return-same-native-slide','Inspector-draft-after-keyboard-fullscreen-return','short-dark-Inspector-retained-keyboard-draft','short-dark-selected-native-chrome','short-dark-native-selected-text-formatting','short-dark-fullscreen-layout-search-focus','short-dark-keyboard-fullscreen-return']
            assert [x['name'] for x in STATES] == expected
            assert START == hashes() and not errors and not violations and not denied
        PASSED = True
    finally:
        result()
        await page.screenshot(path=str(OUT / 'final-state.png'))
        if await page.evaluate('!!document.fullscreenElement'):
            await page.keyboard.press('Escape')
            await page.wait_for_timeout(150)
            if await page.evaluate('!!document.fullscreenElement'):
                await page.mouse.move(50, 10)
                await page.get_by_title('Exit fullscreen (ESC)', exact=True).click()
                await page.wait_for_function('!document.fullscreenElement')

mod = types.ModuleType('verify_walkthrough'); mod.verify = verify; sys.modules['verify_walkthrough'] = mod
import walkthrough
sys.argv = ['walkthrough.py', '--verify', '--headless', '--status-path', str(OUT / 'status.json')]
asyncio.run(walkthrough.main())
