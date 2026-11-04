"""Package complete passing local captures; rejected/extra screenshots are never copied."""
import argparse, datetime, html, json, shutil, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT.parent / 'studio-v4-ten-hour-captures-20261002'
DEST = ROOT / 'docs/studio-v4/ten-hour-20261002'
DEFAULT = ['studio','fresh','navigation','workspaces','intelligence','asks','templates','delivery','manage','knowledge','controls','presentation','composer','authoring','template-flows','template-params','outline','publish-navigation','fullscreen-download','published','knowledge-settings','owner-inbox','appearance','generation-forms','guide','profile','notifications','privacy','security','continuation','notes','help','build-status','billing','usage','file-details','specialist-forms','stage-placeholder','session-history','manual-deck-conflict','generation-feedback','theme-panel','theme-states','director','slide-options','template-metadata','master','edit-guide','rollback','composer-library','deck-identity','director-presence','arrange','toolbar-save','theme-support','thumbnail-failure','mention-titles','director-code','waiting','waiting-native','theme-source','generation-cover','header-fit','pending-action','websocket-error','template-readiness','upload-status','version-state','narrow-workspace','narrow-stage']
EXTERNAL = {'publish-navigation':Path('/tmp/studio-publish-step-probe'),'fullscreen-download':Path('/tmp/studio-download-fullscreen-probe')}
HIGHLIGHTS = {'welcome','studio','decks-grid','themes-library','templates-library','account-edit','director-choice','director-questions','template-standalone','publish-audience','publish-narration','manage-sharing','knowledge-overview','show-menu-keyboard','presentation-chrome','thumbnail-actions-label-row','thumbnail-refine-label-keyboard-focus','slide-mention-picker','slide-layout-catalogue','save-template-name-focus','template-mode-loaded-params','current-slide-blueprint','director-outline','published-client-viewer','published-followup-answer','knowledge-settings-recorded-consent','owner-questions-queue','appearance-current','image-refine-native','text-font-native-selected-focus','slide-refine-native','about-studio','guide-spark','profile-name-refused-retained','notifications-refused-choice-retained','privacy-confirmed-off','security-invalid-confirmation','continuation-current-deck','notes-populated-focus','notes-refused-save-retained','help-search-focus','help-unsent-email-draft-focus','build-status-building','build-status-error','build-status-qa-details-keyboard','billing-native-cards','usage-hard','usage-topup-refused-retained','file-details-open-keyboard-scroll','stage-placeholder-idle-dismiss-focus','session-bulk-refused-retained-selection','drawer-director-keyboard-focus','drawer-slide-keyboard-focus','table-column-rendering-focus','table-position-preset-keyboard','metrics-advanced-focus','chart-advanced-focus','diagram-advanced-focus','shape-advanced-focus','icon-label-final-geometry-keyboard','text-box-advanced-focus','infographic-advanced-focus','account-save-hover','intelligence-brief-action-hover','manual-conflict-error-keyboard-scroll','generation-feedback-resume-keyboard-scroll','generation-feedback-fresh-keyboard-scroll','theme-native-auto-unapplied','theme-native-last-override-keyboard','theme-supplied-failed','director-empty-chat-draft-focus','director-account-session-usage','slide-chart-layout-native-options-focus','slide-hero-native-options-focus','template-complete-snapshot-keyboard-end','master-native-save-focus-without-apply','edit-guide-native-readable-focus','composer-library-native-full-names','composer-library-native-last-action-keyboard','image-native-style-quality-focus','presenter-details-native-logo-warning','presenter-details-native-cancel-keyboard','director-presence-native-thirty-events-keyboard','arrange-native-supplied-flip-and-lock-selection','toolbar-save-native-error-keyboard','theme-support-native-full-description-keyboard-end','template-collapsed-details-whole-preview','thumbnail-failure-native-refinement-full-reasons-keyboard','mention-native-complete-title-wrapped','mention-native-row-space-restores-composer','director-code-native-full-ending-keyboard-scroll','waiting-actual-session-read-held','waiting-supplied-native-reduced-motion','theme-source-native-exact-error-keyboard-focus','generation-cover-native-supplied-neutral-loader','header-native-complete-deck-title-and-controls','pending-native-cancel-keyboard-focus','websocket-native-complete-diagnostic-keyboard-end','template-native-readiness-complete-cleanup-ending','upload-native-complete-failed-filename','version-native-final-fullscreen-current-focus','narrow-stage-native-full-slide-thumbnails-hidden'}


# A small breadth-first review surface; complete proof remains under each area.
OVERVIEW = {
    ('studio','welcome'):'Starting a presentation',
    ('header-fit','header-native-complete-deck-title-and-controls'):'Studio canvas and Director',
    ('asks','director-choice'):'Director decisions and questions',
    ('generation-forms','slide-compose-native'):'Slide authoring controls',
    ('workspaces','templates-library'):'Reusable template library',
    ('workspaces','themes-library'):'Reusable theme library',
    ('workspaces','account-edit'):'Your details',
    ('intelligence','intelligence-current'):'Supported AI workflows',
    ('navigation','decks-grid'):'Your presentations',
    ('knowledge','knowledge-overview'):'Knowledge and source context',
    ('delivery','publish-audience'):'Publish and delivery choices',
    ('presentation','presentation-chrome'):'Fullscreen presentation',
}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--areas', nargs='+', default=DEFAULT)
    parser.add_argument('--sprint-ended', action='store_true')
    args = parser.parse_args()
    assert len(args.areas) == len(set(args.areas)), 'Duplicate areas'
    packets, cards, folders = {}, [], {}
    for area in args.areas:
        folder = EXTERNAL.get(area,SOURCE/area)
        path = folder / 'results.json'
        packet = json.loads(path.read_text())
        if 'capture_directory' in packet:
            run = (folder/packet['capture_directory']).resolve()
            assert run.is_relative_to(folder.resolve()),'Capture folder must stay within its area'
            folder = run
        folders[area] = folder
        expected = ['light-390x844','dark-390x844'] if area == 'narrow-stage' else ['light-390x844','dark-390x844','light-666x800-workspace600','light-900x600-wide-parity'] if area == 'narrow-workspace' else ['light-1440x600'] if area == 'fresh' else ['light-1440x900','dark-1030x600','light-900x600'] if area == 'header-fit' else ['light-1440x900','dark-1030x600'] + (['narrow-390x844'] if area in ['knowledge','published','knowledge-settings','appearance','guide','profile','notifications','privacy','security','help','build-status','billing','usage','stage-placeholder','manual-deck-conflict','theme-states','edit-guide','composer-library','deck-identity','director-presence','arrange','toolbar-save','thumbnail-failure','waiting','generation-cover','websocket-error','template-readiness','upload-status'] else [])
        expected_shots={
            'narrow-stage':{'narrow-stage-native-header-present-focus','narrow-stage-native-header-download-focus','narrow-stage-native-header-publish-focus','narrow-stage-native-presentation-accessible-focus','narrow-stage-native-thumbnails-visible','narrow-stage-native-full-slide-thumbnails-hidden','narrow-stage-native-thumbnails-and-draft-restored'},
            'narrow-workspace':{'workspace-native-chat-full-width-draft','workspace-native-stage-after-chat','workspace-native-slide-inspector-full-width-draft','workspace-native-stage-after-inspector','workspace-native-chat-draft-retained','workspace-native-inspector-draft-retained','workspace-native-header-present-reveals-stage','workspace-native-present-fullscreen','workspace-native-stage-after-fullscreen-exit','workspace-native-final-drafts-and-iframe-retained'},
            'deck-identity':{'presenter-details-native-browser-fields','presenter-details-native-logo-warning','presenter-details-native-cancel-keyboard','presenter-details-native-cancel-reopen-reset'},
            'theme-support':{'theme-support-native-full-description-keyboard-end','theme-support-native-associated-invalid-color'},
            'mention-titles':{'mention-native-complete-title-wrapped','mention-native-row-enter-restores-composer','mention-native-row-space-restores-composer','mention-native-textarea-enter-tab-still-select'},
            'director-code':{'director-code-native-complete-formatted-focus','director-code-native-full-ending-keyboard-scroll','director-code-native-horizontal-keyboard-scroll','director-prose-native-link-keyboard-focus'},
            'waiting-native':{'waiting-actual-auth-read-held','waiting-actual-session-read-held','waiting-actual-read-released-native-builder'},
            'waiting':{'waiting-supplied-native-builder','waiting-supplied-native-session','waiting-supplied-native-account','waiting-supplied-native-redirect','waiting-supplied-native-reduced-motion'},
            'theme-source':{'theme-source-native-existing-preview-read-loading','theme-source-native-existing-preview-read-unavailable','theme-source-native-exact-error-keyboard-focus'},
            'generation-cover':{'generation-cover-native-viewer-before-supplied-prop','generation-cover-native-supplied-neutral-loader','generation-cover-native-supplied-prop-cleared'},
            'template-readiness':{'template-native-readiness-full-errors-bounded','template-native-readiness-keyboard-focus','template-native-readiness-complete-cleanup-ending','template-native-readiness-retry-keyboard-without-click'},
            'upload-status':{'upload-native-complete-pending-filename','upload-native-complete-failed-filename','upload-native-retained-draft-keyboard-focus','upload-native-original-supplied-props-restored'},
            'version-state':{'version-native-final-current-keyboard-focus','version-native-final-fullscreen-current-focus','version-native-strawman-current-keyboard-focus','version-native-strawman-fullscreen-current-focus'},
            'pending-action':{'pending-native-full-label-bounded-with-cancel','pending-native-details-keyboard-focus','pending-native-complete-ending-keyboard-scroll','pending-native-cancel-keyboard-focus','pending-native-existing-cancel-clears-input'},
            'websocket-error':{'websocket-native-exact-default-message','websocket-native-supplied-multiline-keyboard-focus','websocket-native-complete-diagnostic-keyboard-end','websocket-native-reconnect-keyboard-focus-without-retry','websocket-native-reconnect-hover-without-retry'},
            'header-fit':{'header-native-complete-deck-title-and-controls','header-native-present-keyboard-focus','header-native-download-keyboard-focus','header-native-publish-keyboard-focus','header-native-long-title-retained-with-bounded-ellipsis'},
        }.get(area)
        states = packet['states']
        assert [state['state'] for state in states] == expected, (area, 'Expected complete ordered states', expected)
        assert packet['source_identity']['commit'] and packet['source_identity']['files'], (area, 'Missing source identity')
        snapshots=packet['source_identity'].get('probe_source_snapshots',{})
        for relative,sha in snapshots.items():
            probe=(folder/relative).resolve()
            assert probe.is_relative_to(folder.resolve()) and probe.is_file(),(area,'Missing probe snapshot',relative)
            assert hashlib.sha256(probe.read_bytes()).hexdigest()==sha,(area,'Probe snapshot changed',relative)
        if snapshots:
            patch=folder/'source-working-tree.patch'
            assert hashlib.sha256(patch.read_bytes()).hexdigest()==packet['source_identity']['working_tree_patch_sha256'],(area,'Working-tree provenance changed')
        for state in states:
            assert not state['page_errors'] and not state['violations'], (area, state)
            checks = state['checks']
            assert checks, (area,'Missing checks')
            if area == 'publish-navigation':
                assert checks['choiceRetention'] is True and checks['noWriteAttempt'] is True
                assert len(checks['stepTransitions']) == 6
                for step in checks['stepTransitions']:
                    g = step['geometry']
                    assert g['focused'] is True and g['scrollTop'] == 0
                    assert g['heading']['top'] >= g['nav']['bottom'] and g['firstControl']['bottom'] <= g['footer']['top']
            elif area == 'fullscreen-download':
                assert checks['inlineDownloadMenuVisible'] is True and checks['afterExitDownloadMenuVisible'] is True
                assert checks['fullscreenDownload']['inFullscreen'] is True and checks['fullscreenDownload']['focused'] is True
            else: assert all(value is True for value in checks.values()), (area,'Failing checks')
            assert state['screenshots'], (area, 'Empty evidence')
            if expected_shots is not None: assert set(state['screenshots'])==expected_shots,(area,'Missing or extra required capture state',state['screenshots'].keys())
            for name in state['screenshots']:
                filename = state['state'] + '-' + name + '.png'
                image = folder / filename
                assert image.is_file() and image.stat().st_size > 0, image
                cards.append((area,state['state'],name,filename))
        packets[area] = packet
    # Validate every packet before replacing this sprint's disposable generated gallery.
    evidence = DEST / 'evidence'
    for area, packet in packets.items():
        target = evidence / area
        if target.exists(): shutil.rmtree(target)
        target.mkdir(parents=True)
        if packet['source_identity'].get('probe_source_snapshots'):
            shutil.copytree(folders[area]/'probe-sources',target/'probe-sources')
            shutil.copy2(folders[area]/'source-working-tree.patch',target/'source-working-tree.patch')
        if area in EXTERNAL:
            source = Path('/tmp/studio-'+('publish-step' if area=='publish-navigation' else 'download-fullscreen')+'-probe.py')
            assert source.is_file(), source
            actual_hash=hashlib.sha256(source.read_bytes()).hexdigest()
            if 'probe_sha256' in packet['source_identity']: assert actual_hash==packet['source_identity']['probe_sha256']
            shutil.copy2(source,target/'probe-source.py')
            (target/'probe-source.sha256').write_text(actual_hash+'  probe-source.py\n')
        (target/'results.json').write_text(json.dumps(packet,indent=2)+'\n')
        for card_area, _, _, filename in cards:
            if card_area == area: shutil.copy2(folders[area]/filename,target/filename)
    manifest = {'status':('Ten-hour local delivery candidate; review evidence, not release acceptance' if args.sprint_ended else 'Ongoing ten-hour sprint; review evidence, not release acceptance'),'packaged_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_note':'Each area retains its own capture commit and source hashes. Source was evolving; these are not claimed as one frozen HEAD.','areas':{area:{'source_identity':packet['source_identity'],'states':[s['state'] for s in packet['states']]} for area,packet in packets.items()},'screenshot_count':len(cards),'limits':['Exact local read fixtures; expected writes refused','No connected persistence, upload, export, recording or generation','No push, merge or deployment']}
    (evidence/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    options = '<option value="overview">Design overview</option><option value="highlights">Detailed highlights</option><option value="all">All areas</option>'+''.join(f'<option value="{html.escape(a)}">{html.escape(a.replace("-"," ").title())}</option>' for a in args.areas)
    items = []
    overview_order={key:index for index,key in enumerate(OVERVIEW)}
    for area,state,name,filename in sorted(cards,key=lambda card:overview_order.get((card[0],card[2]),len(OVERVIEW))):
        title = OVERVIEW.get((area,name),name.replace('-',' ').capitalize())
        theme = 'dark' if state.startswith('dark') else 'light'
        highlight = name in HIGHLIGHTS and not state.startswith('narrow')
        overview = (area,name) in OVERVIEW and state in ['light-1440x900','dark-1030x600']
        src = f'evidence/{area}/{filename}'
        items.append(f'<article data-area="{area}" data-theme="{theme}" data-highlight="{str(highlight).lower()}" data-overview="{str(overview).lower()}"><a href="{src}" target="_blank"><img loading="lazy" src="{src}" alt="{html.escape(title)}"></a><div><small>{area.upper()} · {state}</small><h2>{html.escape(title)}</h2></div></article>')
    sprint_note = 'The ten-hour work window ended at 17:15 EDT on 2 October. ' if args.sprint_ended else 'The sprint continues through 17:15 EDT on 2 October. '
    page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Studio v4 · ten-hour progress</title><style>*{box-sizing:border-box}body{margin:0;background:#eff4ef;color:#253e37;font:14px/1.65 system-ui,sans-serif}header{max-width:1400px;margin:auto;padding:40px 28px 24px}header small{color:#397f72;font-weight:700;letter-spacing:.12em}h1{font:40px/1.15 Georgia,serif;margin:12px 0}p{max-width:90ch;color:#567268}nav{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:12px 0}select{padding:8px 12px;border:1px solid #c2d2c7;border-radius:8px;background:white;color:#253e37}main{max-width:1400px;margin:auto;padding:0 28px 40px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}article{background:white;border:1px solid #c8d8cb;border-radius:12px;overflow:hidden}article[hidden]{display:none}article img{width:100%;display:block}article>div{padding:12px 16px}article small{font-size:10px;letter-spacing:.1em;color:#70867b}h2{margin:4px 0;font-size:15px}@media(max-width:850px){main{grid-template-columns:1fr}}</style><header><small>DECKSTER STUDIO · LOCAL UAT WORK IN PROGRESS</small><h1>Ten hours toward the accepted design.</h1><p>'''+html.escape(sprint_note)+'''The design overview shows twelve broad surfaces first. Choose Dark to compare the short desktop view, or an area for complete captured states. Every image uses the actual local frontend with synthetic read fixtures. Expected writes are refused. Connected operations and release remain unverified.</p><p>Individual capture source identities are retained in the <a href="evidence/manifest.json">evidence manifest</a>. These images span evolving batches and are not represented as one frozen release.</p><nav><label>Area <select id="area">'''+options+'''</select></label><label>Theme <select id="theme"><option value="all">Both themes</option><option value="light" selected>Light</option><option value="dark">Dark</option></select></label><span id="count"></span></nav></header><main>'''+''.join(items)+'''</main><script>const area=document.getElementById('area'),theme=document.getElementById('theme');function filter(){let n=0;for(const e of document.querySelectorAll('article')){e.hidden=(area.value==='overview'?e.dataset.overview!=='true':area.value==='highlights'?e.dataset.highlight!=='true':area.value!=='all'&&e.dataset.area!==area.value)||(theme.value!=='all'&&e.dataset.theme!==theme.value);if(!e.hidden)n++;}document.getElementById('count').textContent=n+' screens';}area.addEventListener('change',filter);theme.addEventListener('change',filter);filter();</script></html>'''
    if args.sprint_ended:
        page=page.replace('<title>Studio v4 · ten-hour progress</title>','<title>Studio v4 · ten-hour local candidate</title>')
        page=page.replace('DECKSTER STUDIO · LOCAL UAT WORK IN PROGRESS','DECKSTER STUDIO · LOCAL FRONTEND CANDIDATE')
    (DEST/'REVIEW.html').write_text(page)
    print(json.dumps({'areas':len(packets),'screenshots':len(cards),'gallery':str(DEST/'REVIEW.html')}))

if __name__ == '__main__': main()
