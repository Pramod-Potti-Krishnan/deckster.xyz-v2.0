import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

// Strict, source-bound candidate receipt. This does not grant Architect acceptance.
export function verifyVoiceRenderSource(root) {
  const sha = value => crypto.createHash('sha256').update(value).digest('hex')
  const read = file => fs.readFileSync(path.join(root, file))
  const packet = 'docs/studio-v4/twenty-four-hour-parity-20261005/builder1/'
  const accepted = JSON.parse(read(packet + 'voice-correction/APP-MANIFEST.json'))
  const correctionPath = packet + 'voice-question-scroll-correction/APP-MANIFEST.json'
  const correction = JSON.parse(read(correctionPath))
  const leaf = 'components/builder/voice-interactive/director-call.tsx'
  const before = '28a1e780bb7f534248c250ebf7d22d455936f4979754d1968ebc557d7b39fcb1'
  const after = 'd09fd9e07a1d12781b5f3fbd47a822caed341093273c1fa31dcc02e0d9c22326'
  assert.deepEqual(correction.files, [{path: leaf, before_sha256: before, result_sha256: after}])
  const predecessor = read(packet + 'voice-shared-review/source/' + leaf).toString()
  assert.equal(sha(predecessor), before)
  assert.equal(predecessor.split('card.scrollIntoView(').length, 2)
  assert.equal(read(leaf).toString(), predecessor.replace('card.scrollIntoView({ block: \"nearest\", behavior: reduced ? \"auto\" : \"smooth\" })', 'control.scrollIntoView({ block: \"center\", behavior: reduced ? \"auto\" : \"smooth\" })'))
  assert.equal(accepted.app.length, 7)
  const files = accepted.app.map(row => {
    const actual = sha(read(row.path))
    assert.equal(actual, row.path === leaf ? after : row.resultSha256, row.path)
    if (row.path === leaf) assert.equal(row.resultSha256, before)
    return {path: row.path, sha256: actual, acceptedPredecessorSha256: row.resultSha256}
  })
  const aggregate = rows => sha(rows.map(row => `${row.path}\t${row.sha256}`).join('\n') + '\n')
  const baseAggregate = aggregate(files.map(row => ({path: row.path, sha256: row.acceptedPredecessorSha256})))
  assert.equal(baseAggregate, '48393caff67596ed0564a649182f971507e797c992314a443cd141e4b0d072c9')
  const integrationPath = packet + 'voice-integration/APP-MANIFEST.json'
  const integrationBytes = read(integrationPath)
  assert.equal(sha(integrationBytes), '06c4a84b14046f8391f88c4dfefb2ad3b38666b40b3b0ca2ad0944596fa82745')
  const integration = JSON.parse(integrationBytes)
  assert.equal(integration.files.length, 17)
  for (const row of integration.files) assert.equal(sha(read(row.path)), row.result.sha256, row.path)
  assert.equal(sha(read('app/builder/page.tsx')), '451ecd0da1cf298279116723dc2436e389e98b06bfd670c5dab0a8e2d1715e3c')
  return {files, baseAggregate, currentAggregate: aggregate(files), exactOneLineSuccessor: true,
    correctionManifest: {path: correctionPath, sha256: sha(read(correctionPath))},
    integrationManifest: {path: integrationPath, sha256: sha(integrationBytes), fileCount: 17},
    acceptanceLevel: 'Exact root-owned one-line candidate; six accepted leaves unchanged. Architect and browser recheck separate.'}
}
