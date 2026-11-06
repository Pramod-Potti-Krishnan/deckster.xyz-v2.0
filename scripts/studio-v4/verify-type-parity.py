"""Verify the bounded containment trial; this is not CP1.2 acceptance.

The complete four-flag/eight-viewport type matrix is deliberately held pending
the Architect's layout decision. Expected inputs are explicit before pairing.
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FOUR = ['light-1030x600', 'dark-1030x600', 'light-1280x720', 'dark-1280x720']
TWO = ['light-1030x600', 'dark-1280x720']
APP_FILES = ['app/builder/page.tsx', 'app/builder/studio-v4.css',
             'app/builder/studio-v4-type.css', 'components/builder/chat-input.tsx',
             'components/builder/chat/mention-popover.tsx']


def assert_states(proof, expected):
    actual = [s['state'] for s in proof['states']]
    assert actual == expected, f'Expected exact ordered states {expected}; got {actual}'
    assert len(set(actual)) == len(expected)


def messages(state, kind):
    return [json.loads(f) for f in state['outbound_fixture_frames']
            if isinstance(f, str) and f.startswith('{') and json.loads(f).get('type') == kind]


def request_counts(state):
    return collections.Counter((r['method'], r['path']) for r in state['intercepted_requests'])


def verify(source):
    result = []
    expected_common = {'initial', 'resized-tall', 'resized-back'}
    for variant, expected in [('sparse', FOUR), ('action-review', FOUR),
                              ('action-mention', TWO), ('stop', TWO)]:
        proofs = {}
        for mode in ['baseline', 'candidate']:
            path = source / f'containment-{variant}-{mode}' / 'browser-proof.json'
            proof = json.loads(path.read_text())
            assert_states(proof, expected)
            assert proof['tokens'] == proof['type'] == 'on'
            assert proof['preview_config'] == {'port': '8792', 'tokens': 'true', 'type': 'true', 'mentions': 'true'}
            for p in APP_FILES:
                assert proof['source_identity']['files'][p] == hashlib.sha256((ROOT / p).read_bytes()).hexdigest(), p
            assert all(s['status'] == 200 and not s['page_errors'] and not s['violations'] for s in proof['states'])
            proofs[mode] = proof
        # Both sequences have been checked for exact completeness before zip.
        for before, candidate in zip(proofs['baseline']['states'], proofs['candidate']['states']):
            assert before['state'] == candidate['state']
            row = {'variant': variant, 'state': before['state'], 'transportClean': True,
                   'applicationSourceHashesEqual': True}
            if variant == 'stop':
                for state in [before, candidate]:
                    assert list(state['stop_states']) == ['normal', 'hover', 'focus']
                    assert len(messages(state, 'user_message')) == len(messages(state, 'cancel_template_reuse')) == 1
                    assert all(x['icon_contrast'] >= 4.5 for x in state['stop_states'].values())
                    assert state['stop_states']['focus']['focusVisible']
                    assert state['stop_states']['focus']['focus_contrast'] >= 3
                assert messages(before, 'user_message') == messages(candidate, 'user_message')
                assert messages(before, 'cancel_template_reuse') == messages(candidate, 'cancel_template_reuse')
                assert request_counts(before) == request_counts(candidate)
                assert len(before['websockets']) == len(candidate['websockets'])
                row.update(buildAndCancelOnce=True, stopContrastFocusPreserved=True)
            else:
                assert not messages(before, 'user_message') and not messages(candidate, 'user_message')
                a, b = before['composition'], candidate['composition']
                assert expected_common <= set(a['records']) and expected_common <= set(b['records'])
                required = {'mention-open', 'mention-discovered', 'mention-mouse-selected', 'mention-keyboard-selected'} if variant != 'action-review' else {'crowded-uploading', 'crowded-error-top', 'files-cleared', 'banners-cleared'}
                assert required <= set(a['records']) and required <= set(b['records'])
                for state in [a, b]:
                    records = state['records']
                    tail = list(records.values())[-3:]
                    assert all(x['draft'] == tail[0]['draft'] and x['caret'] == tail[0]['caret'] for x in tail)
                    assert all(x['iframes'] == 0 for x in records.values())
                    if variant != 'action-review':
                        assert all(state['observations'].get(k) for k in ['suggestionsDiscoverableByWheel', 'mouseSelectKeepsCaret', 'enterSelectNoSend', 'tabSelectNoSend'])
                    if variant != 'sparse':
                        assert state['observations']['clearFilesPreservesDraft']
                if variant != 'sparse':
                    assert all(x.get('reachableByNormalWheel', False) or x.get('disabledRetained', False) for x in b['access']), b['access']
                    for kind in ['theme', 'research']:
                        if variant == 'action-mention' and kind == 'theme':
                            assert any(x['action'] == 'theme-trigger' and x.get('disabledRetained') for x in b['access'])
                        else:
                            assert b['observations'][kind + 'FocusReturn']
                    row['candidateControlsReachable'] = True
                row.update(noMentionMessageSent=True, draftCaretResizePreserved=True,
                           commonPhases=sorted(set(a['records']) & set(b['records'])))
                for name in row['commonPhases']:
                    assert a['records'][name]['draft'] == b['records'][name]['draft'], (variant, name)
                if variant == 'sparse':
                    assert request_counts(before) == request_counts(candidate)
                else:
                    # Baseline short-window menu triggers can be unreachable by
                    # wheel. Added GETs are reported, not hidden as equal traffic.
                    delta = request_counts(candidate) - request_counts(before)
                    assert all(method == 'GET' and path == '/api/themes' for method, path in delta), delta
                    row['extraReachableMenuGets'] = sum(delta.values())
                    row['conversationHeightDuringUpload'] = {
                        'baseline': a['records']['crowded-uploading']['transcript']['height'],
                        'candidate': b['records']['crowded-uploading']['transcript']['height']}
            result.append(row)
    heights = [r['conversationHeightDuringUpload']['candidate'] for r in result if 'conversationHeightDuringUpload' in r]
    assert heights and min(heights) == 0, 'Reassess disposition if the observed layout changes'
    return {'trialDisposition': 'Do not adopt: the measured crowded transcript collapses; remaining normal-height access is also very small.',
            'observedCrowdedConversationHeights': sorted(set(heights)),
            'notCP12Acceptance': True, 'expectedGroups': {'sparse': FOUR, 'action-review': FOUR, 'action-mention': TWO, 'stop': TWO},
            'results': result}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--trial', action='store_true', required=True)
    parser.add_argument('--source', type=Path, default=ROOT.parent / 'studio-v4-cp12-captures-20261001')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = verify(args.source)
    data = json.dumps(result, indent=2) + '\n'
    if args.output:
        args.output.write_text(data)
    print(data)


if __name__ == '__main__':
    main()
