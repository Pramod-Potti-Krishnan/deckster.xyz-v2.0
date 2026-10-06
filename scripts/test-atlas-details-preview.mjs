import assert from 'node:assert/strict'
import { detailsHarness, find, nodes, text, button } from './test-atlas-details-harness.mjs'

const h = detailsHarness(), { env } = h
const leaves = h.loadLeaf('details-workspace')
const accountHost = h.createHost(leaves.AccountDetailsWorkspace)
let child = accountHost.render()
assert.equal(child.type, leaves.DetailsWorkspace)
assert.equal(child.key, 'owner-a')
const draftHost = h.createHost(child.type)
let tree = draftHost.render(child.props)
const render = () => tree = draftHost.render(child.props)
button(tree, 'Presenter preview').props.onClick(); render()
const author = () => find(tree, n => n.type === 'label' && text(n).includes('Author name'))
find(author(), n => n.type === 'input').props.onChange({ target: { value: 'Unsent presenter A' } }); render()
button(tree, 'Footer & logo').props.onClick(); render()
const pickLogo = file => {
  const event = { target: { files: [file], value: 'local' } }
  find(tree, n => n.props['aria-label'] === 'Choose logo preview image').props.onChange(event)
  assert.equal(event.target.value, '')
  render()
}
const logoImage = () => find(tree, n => n.type === 'img' && n.props.alt === 'Your selected logo preview')
const file = { name: 'first.png', type: 'image/png', size: 25 }
pickLogo(file)
const first = logoImage(), firstUrl = first.props.src
assert.equal(first.key, firstUrl)
assert.equal(env.created.length, 1)
assert.equal(env.revoked.length, 0)
assert.equal(env.requests.length, 0)

// Same-owner SessionProvider loading/refresh keeps the actual keyed local leaf intact.
env.loading = true; child = accountHost.render()
assert.equal(child.type, leaves.DetailsWorkspace)
assert.equal(child.key, 'owner-a')
render(); assert.equal(logoImage().props.src, firstUrl)
env.loading = false; env.user = { ...env.user, name: 'Saved account A' }; child = accountHost.render(); render()
button(tree, 'Presenter preview').props.onClick(); render()
assert.equal(find(author(), n => n.type === 'input').props.value, 'Unsent presenter A')
const identity = find(tree, n => n.type?.name === 'AccountIdentityPreview')
assert.equal(identity.props.name, 'Saved account A', 'Confirmed preview gets session identity, never presenter draft')
button(tree, 'Account').props.onClick(); render()
button(tree, 'Footer & logo').props.onClick(); render()
assert.equal(logoImage().props.src, firstUrl)

// Replacement revokes only the old URL. Late old-image failures cannot clear its successor.
pickLogo({ name: 'second.webp', type: 'image/webp', size: 10 })
const secondUrl = logoImage().props.src
assert.notEqual(firstUrl, secondUrl)
assert.deepEqual(env.revoked, [firstUrl])
first.props.onError(); render()
assert.equal(logoImage().props.src, secondUrl)
assert.ok(!text(tree).includes('This file could not be displayed.'))
for (const invalid of [{ type: 'text/plain', size: 1 }, { type: 'image/jpeg', size: 2 * 1024 * 1024 + 1 }, { type: 'image/png', size: 0 }]) {
  pickLogo(invalid); assert.equal(logoImage().props.src, secondUrl)
}
assert.equal(env.created.length, 2)
env.failObjectUrl = true
pickLogo({ name: 'refused.png', type: 'image/png', size: 5 })
assert.equal(logoImage().props.src, secondUrl)
assert.ok(text(tree).includes('Your browser could not preview this image.'))
env.failObjectUrl = false
logoImage().props.onError(); render()
assert.ok(!nodes(tree).some(n => n.type === 'img' && n.props.alt === 'Your selected logo preview'))
assert.deepEqual(env.revoked, [firstUrl, secondUrl])
assert.ok(text(tree).includes('This file could not be displayed. Choose another image.'))
pickLogo({ name: 'remove.png', type: 'image/png', size: 4 })
const removedUrl = logoImage().props.src
button(tree, 'Remove preview logo').props.onClick(); render()
assert.equal(env.revoked.at(-1), removedUrl)
pickLogo({ name: 'reset.png', type: 'image/png', size: 4 })
const resetUrl = logoImage().props.src
button(tree, 'Reset draft').props.onClick(); render()
assert.equal(env.revoked.at(-1), resetUrl)
assert.equal(button(tree, 'Save as defaults').props.disabled, true)
const master = find(tree, n => n.type === h.workflowAction)
assert.equal(master.props.action, 'master')
assert.equal(master.props.itemId, undefined)
assert.equal(master.props.brief, undefined)

// Actual owner key changes scope both draft and local blob lifetime to the new account.
pickLogo({ name: 'account-a.png', type: 'image/png', size: 4 })
const accountAUrl = logoImage().props.src
env.user = { id: 'owner-b', name: 'Account B', email: 'b@example.invalid' }; child = accountHost.render()
assert.equal(child.key, 'owner-b')
draftHost.cleanup()
assert.equal(env.revoked.at(-1), accountAUrl)
const newDraftHost = h.createHost(child.type)
tree = newDraftHost.render(child.props)
button(tree, 'Presenter preview').props.onClick(); tree = newDraftHost.render(child.props)
assert.equal(find(author(), n => n.type === 'input').props.value, 'Account B')
assert.ok(!text(tree).includes('Unsent presenter A'))
newDraftHost.cleanup()
env.loading = true; env.user = null; child = accountHost.render(); assert.equal(child.props.role, 'status')
env.loading = false; child = accountHost.render(); assert.equal(child.props.role, 'alert')

// The actual confirmed identity leaf has photo fallback/retry without a service request.
const previewHost = h.createHost(h.loadLeaf('account-identity-preview').AccountIdentityPreview)
const props = { active: true, name: 'Confirmed owner', email: 'confirmed@example.invalid', image: 'https://example.invalid/saved.png', onPresenterPreview() {} }
tree = previewHost.render(props)
find(tree, n => n.type === 'img').props.onError(); tree = previewHost.render(props)
assert.ok(text(tree).includes('Your saved account photo could not be displayed.'))
button(tree, 'Retry photo').props.onClick(); tree = previewHost.render(props)
assert.equal(find(tree, n => n.type === 'img').props.src, props.image)
previewHost.cleanup()
assert.equal(env.requests.length, 0)
assert.equal(env.updates.length, 0)
assert.equal(new Set(env.revoked).size, env.revoked.length, 'Each disposable local URL is revoked once')
console.log('PASS: actual Details leaf owner keys, same-owner refresh/tab draft continuity, confirmed identity, safe local logo replacement/error/remove/reset/unmount, inactive defaults and Master intent; zero service calls')
