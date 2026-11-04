import assert from 'node:assert/strict'
import { detailsHarness, find, nodes, text, button, deferred, response, flush } from './test-atlas-details-harness.mjs'

for (const shell of ['true', 'false']) {
  const h = detailsHarness(shell), { env } = h
  const host = h.createHost(h.loadLeaf('account-profile-editor').AccountProfileEditor)
  let tree = host.render()
  const render = () => tree = host.render()
  const edit = value => { button(tree, 'Edit display name').props.onClick(); render(); find(tree, n => n.props['aria-label'] === 'Account display name').props.onChange({ target: { value } }); render() }
  edit('  Authored name  ')
  const request = deferred(); env.fetch = () => request.promise
  button(tree, 'Save account name').props.onClick(); render()
  assert.equal(env.requests.length, 1)
  assert.equal(env.requests[0].path, '/api/profile')
  assert.equal(env.requests[0].options.method, 'PATCH')
  assert.equal(env.requests[0].options.headers['Content-Type'], 'application/json')
  assert.equal(env.requests[0].options.body, JSON.stringify({ name: 'Authored name' }))
  assert.equal(button(tree, 'Saving…').props.disabled, true)
  assert.equal(button(tree, 'Cancel').props.disabled, true)
  button(tree, 'Saving…').props.onClick()
  assert.equal(env.requests.length, 1, 'Busy guard prevents a duplicate actual handler request')
  request.resolve(response({ error: 'Local refusal retains the edit' }, false)); await flush(); render()
  assert.equal(find(tree, n => n.props['aria-label'] === 'Account display name').props.value, '  Authored name  ')
  assert.ok(text(tree).includes('Local refusal retains the edit'))
  assert.equal(env.updates.length, 0)
  const refresh = deferred(); env.fetch = async () => response({ name: 'Authored name' }); env.update = () => refresh.promise
  button(tree, 'Save account name').props.onClick(); await flush(); render()
  assert.equal(env.updates.length, 1)
  assert.equal(env.updates[0].name, 'Authored name')
  refresh.resolve({ user: { ...env.user, name: 'Authored name' } }); await flush(); render()
  assert.ok(text(tree).includes('Display name saved to your account.'))

  // A deferred old-owner response may not refresh or acknowledge the new account.
  edit('Old owner pending name')
  const oldResponse = deferred(); env.fetch = () => oldResponse.promise
  button(tree, 'Save account name').props.onClick(); render()
  const updatesBeforeSwitch = env.updates.length
  env.user = { id: 'owner-b', name: 'Account B', email: 'b@example.invalid' }; render()
  oldResponse.resolve(response({ name: 'Old owner pending name' })); await flush(); render()
  assert.equal(env.updates.length, updatesBeforeSwitch)
  assert.ok(!text(tree).includes('Display name saved to your account.'))
  host.cleanup()
}

// Exercise request and refresh lifetime boundaries on clean actual leaf instances.
for (const phase of ['unmount-before-response', 'replay-before-response', 'replay-during-refresh', 'owner-during-refresh', 'wrong-owner-receipt', 'refresh-refused']) {
  const h = detailsHarness(), { env } = h
  const host = h.createHost(h.loadLeaf('account-profile-editor').AccountProfileEditor)
  let tree = host.render()
  button(tree, 'Edit display name').props.onClick(); tree = host.render()
  find(tree, n => n.props['aria-label'] === 'Account display name').props.onChange({ target: { value: 'Deferred authored name' } }); tree = host.render()
  const read = deferred(), refresh = deferred(); env.fetch = () => read.promise; env.update = () => refresh.promise
  button(tree, 'Save account name').props.onClick(); tree = host.render()
  if (phase === 'unmount-before-response') host.cleanup()
  if (phase === 'replay-before-response') {
    host.replayEffects(); tree = host.render()
    assert.equal(button(tree, 'Save account name').props.disabled, false)
    assert.equal(button(tree, 'Cancel').props.disabled, false)
    assert.ok(text(tree).includes('Its outcome is unconfirmed'))
    assert.equal(find(tree, n => n.props['aria-label'] === 'Account display name').props.value, 'Deferred authored name')
  }
  read.resolve(response({ name: 'Deferred authored name' })); await flush()
  if (phase.includes('before-response')) { assert.equal(env.updates.length, 0); host.cleanup(); continue }
  assert.equal(env.updates.length, 1)
  if (phase === 'replay-during-refresh') { host.replayEffects(); tree = host.render() }
  if (phase === 'owner-during-refresh') { env.user = { id: 'owner-b', name: 'Account B' }; host.render() }
  if (phase === 'refresh-refused') refresh.reject(new Error('Local session refresh refusal'))
  else refresh.resolve({ user: { id: phase === 'wrong-owner-receipt' ? 'owner-b' : 'owner-a', name: 'Deferred authored name' } })
  await flush(); tree = host.render()
  if (phase === 'replay-during-refresh') {
    assert.ok(text(tree).includes('Its outcome is unconfirmed'))
    assert.equal(button(tree, 'Save account name').props.disabled, false)
    assert.ok(!text(tree).includes('Display name saved'))
  } else if (phase === 'owner-during-refresh') assert.ok(!text(tree).includes('Display name saved'))
  else assert.ok(text(tree).includes('Display name saved. Reload to refresh your account session.'))
  host.cleanup()
}

// Avatar keeps its exact multipart contract, guards and deferred-owner semantics.
for (const outcome of ['refused', 'owner-change', 'replay', 'valid', 'wrong-owner-receipt']) {
  const h = detailsHarness(), { env } = h
  const host = h.createHost(h.loadLeaf('account-profile-editor').AccountProfileEditor)
  let tree = host.render()
  const file = { type: 'image/png', size: 123, name: 'account.png' }
  const pending = deferred(); env.fetch = () => pending.promise
  const input = find(tree, n => n.props['aria-label'] === 'Upload account photo')
  const event = { target: { files: [file], value: 'file' } }; input.props.onChange(event); tree = host.render()
  assert.equal(event.target.value, '')
  assert.equal(env.requests[0].path, '/api/profile/avatar')
  assert.equal(env.requests[0].options.method, 'POST')
  assert.equal(env.requests[0].options.body.parts[0][0], 'avatar')
  assert.equal(env.requests[0].options.body.parts[0][1], file)
  if (outcome === 'owner-change') { env.user = { id: 'owner-b', name: 'Account B' }; tree = host.render() }
  if (outcome === 'replay') {
    host.replayEffects(); tree = host.render()
    assert.equal(button(tree, 'Change account photo').props.disabled, false)
    assert.ok(text(tree).includes('Its outcome is unconfirmed'))
  }
  if (outcome === 'wrong-owner-receipt') env.update = async fields => ({ user: { id: 'owner-b', ...fields } })
  pending.resolve(outcome === 'refused' ? response({ error: 'Avatar locally refused' }, false) : response({ image: 'https://example.invalid/confirmed.png' })); await flush(); tree = host.render()
  if (outcome === 'replay') { assert.equal(env.updates.length, 0); assert.ok(text(tree).includes('Its outcome is unconfirmed')); assert.equal(button(tree, 'Change account photo').props.disabled, false) }
  else if (outcome === 'owner-change') { assert.equal(env.updates.length, 0); assert.ok(!text(tree).includes('Account photo saved')) }
  else if (outcome === 'refused') { assert.equal(env.updates.length, 0); assert.ok(text(tree).includes('Avatar locally refused')); assert.equal(button(tree, 'Change account photo').props.disabled, false) }
  else assert.ok(text(tree).includes(outcome === 'valid' ? 'Account photo saved.' : 'Account photo saved. Reload to refresh your account session.'))
  host.cleanup()
}
for (const file of [{ type: 'text/plain', size: 1 }, { type: 'image/png', size: 5 * 1024 * 1024 + 1 }, { type: 'image/gif', size: 0 }]) {
  const h = detailsHarness(), host = h.createHost(h.loadLeaf('account-profile-editor').AccountProfileEditor)
  const tree = host.render(); find(tree, n => n.props['aria-label'] === 'Upload account photo').props.onChange({ target: { files: [file], value: 'file' } }); await flush()
  assert.equal(h.env.requests.length, 0); assert.equal(h.env.updates.length, 0); host.cleanup()
}
for (const value of [' ', 'x'.repeat(81)]) {
  const h = detailsHarness(), host = h.createHost(h.loadLeaf('account-profile-editor').AccountProfileEditor)
  let tree = host.render(); button(tree, 'Edit display name').props.onClick(); tree = host.render()
  find(tree, n => n.props['aria-label'] === 'Account display name').props.onChange({ target: { value } }); tree = host.render()
  button(tree, 'Save account name').props.onClick(); await flush(); tree = host.render()
  assert.ok(text(tree).includes('between 1 and 80 characters'))
  assert.equal(h.env.requests.length, 0); assert.equal(h.env.updates.length, 0); host.cleanup()
}
for (const kind of ['stale-handler', 'unconfirmed-receipt']) {
  const h = detailsHarness(), host = h.createHost(h.loadLeaf('account-profile-editor').AccountProfileEditor)
  let tree = host.render(); button(tree, 'Edit display name').props.onClick(); tree = host.render()
  find(tree, n => n.props['aria-label'] === 'Account display name').props.onChange({ target: { value: 'Unsent account edit' } }); tree = host.render()
  const oldSave = button(tree, 'Save account name').props.onClick
  if (kind === 'stale-handler') { h.env.user = { id: 'owner-b', name: 'Account B' }; host.render() }
  else h.env.fetch = async () => response({ name: 'Different unconfirmed name' })
  oldSave(); await flush(); tree = host.render()
  assert.equal(h.env.updates.length, 0)
  assert.equal(h.env.requests.length, kind === 'stale-handler' ? 0 : 1)
  if (kind === 'unconfirmed-receipt') {
    assert.ok(text(tree).includes('The name update was not confirmed'))
    assert.equal(find(tree, n => n.props['aria-label'] === 'Account display name').props.value, 'Unsent account edit')
    button(tree, 'Cancel').props.onClick(); tree = host.render()
    assert.ok(!nodes(tree).some(n => n.props['aria-label'] === 'Account display name'))
  }
  host.cleanup()
}
for (const kind of ['name', 'avatar']) {
  const h = detailsHarness(), host = h.createHost(h.loadLeaf('account-profile-editor').AccountProfileEditor)
  let tree = host.render()
  if (kind === 'name') {
    button(tree, 'Edit display name').props.onClick(); tree = host.render()
    find(tree, n => n.props['aria-label'] === 'Account display name').props.onChange({ target: { value: 'Retry after local interruption' } }); tree = host.render()
  }
  const submit = () => kind === 'name' ? button(tree, 'Save account name').props.onClick()
    : find(tree, n => n.props['aria-label'] === 'Upload account photo').props.onChange({ target: { files: [{ type: 'image/png', size: 5 }], value: 'file' } })
  const old = deferred(), retry = deferred(); h.env.fetch = () => old.promise
  submit(); tree = host.render(); host.replayEffects(); tree = host.render()
  h.env.fetch = () => retry.promise; submit(); tree = host.render()
  const receipt = kind === 'name' ? { name: 'Retry after local interruption' } : { image: 'https://example.invalid/retried.png' }
  old.resolve(response(receipt)); await flush(); tree = host.render()
  assert.equal(h.env.updates.length, 0)
  assert.equal(button(tree, kind === 'name' ? 'Saving…' : 'Uploading…').props.disabled, true, 'Old finally cannot release a newer pending request')
  retry.resolve(response(receipt)); await flush(); tree = host.render()
  assert.equal(h.env.updates.length, 1)
  assert.ok(text(tree).includes(kind === 'name' ? 'Display name saved to your account.' : 'Account photo saved.'))
  host.cleanup()
}
console.log('PASS: actual account leaf offline payload/guards, refusal/retry, duplicate exclusion, request-owner/refresh-owner checks, unmount and effect-replay boundaries; no connected calls')
