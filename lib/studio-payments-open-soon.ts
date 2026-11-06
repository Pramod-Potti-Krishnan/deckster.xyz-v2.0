// NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON (FRONTEND-2, controlled release; default off): there is no Stripe account yet, so no control may start a NEW payment. Import-free: the flag,
// the words, the refusal the two checkout routes answer with, and the small DOM pass for the controls whose files other changes hold byte for byte (the Billing page, the account menu).
//
// What it leaves alone: the plan a user is on (name, price, status, renewal), "Manage Subscription" (the Stripe portal link of an existing subscriber), the Credit Balance and its
// transactions, and everything about invites and coupons (redeem, sign-up, admin). The Stripe real-tier flag and its code path (the webhook, the price-to-plan table) are not read or touched here.
//
// The pass NEVER changes a text node and never inserts or removes a node: React keeps references to the nodes it rendered, and a node it cannot find again makes its next re-render throw (NotFoundError
// from removeChild / insertBefore), which would take a paid user's Billing page down. It only sets attributes. The look ("Payments open soon" in place of the label, the greyed control, the line under
// the credit packs) is components/billing/studio-payments-open-soon.css, scoped to <html data-studio-payments-soon="true">; the activation (a click, Enter or Space on a gated control) is stopped by
// one capture-phase listener on the document. Nothing here sets the `disabled` property of an element React owns (aria-disabled does that job for assistive technology).

/** Exact "true" only, read at build time (Next inlines NEXT_PUBLIC_ values in the browser and server bundles alike). */
export const STUDIO_PAYMENTS_OPEN_SOON_ENABLED = process.env.NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON === 'true'

/** The one line every gated control says. */
export const PAYMENTS_OPEN_SOON_LINE = 'Payments open soon'

/** What the two checkout routes (subscription, credit top-up) answer with while it is on: nothing is created at Stripe. */
export const PAYMENTS_OPEN_SOON_STATUS = 503
export const PAYMENTS_OPEN_SOON_BODY = { error: PAYMENTS_OPEN_SOON_LINE, code: 'payments_open_soon' } as const

/** On <html> while the flag is on (the stylesheet is scoped to it). */
export const PAYMENTS_OPEN_SOON_HTML_ATTR = 'data-studio-payments-soon'
/** "1" on a gated control; the stylesheet and the click guard both look for exactly this. */
export const PAYMENTS_OPEN_SOON_GATE_ATTR = 'data-studio-payments-soon-gate'
/** On a gated control: the id of the rule that matched it, and its kind (label: the label becomes the line; price: the price stays and the group says the line once). */
export const PAYMENTS_OPEN_SOON_RULE_ATTR = 'data-studio-payments-soon-rule'
export const PAYMENTS_OPEN_SOON_KIND_ATTR = 'data-studio-payments-soon-kind'
/** "1" on the container of gated price buttons (the credit-pack grid): the stylesheet draws the one line after its last child. */
export const PAYMENTS_OPEN_SOON_GROUP_ATTR = 'data-studio-payments-soon-group'

interface ControlRule {
  id: string
  kind: 'label' | 'price'
  /** The one route the rule applies on; none: anywhere the pass runs. */
  path?: string
  match: (el: Element, text: string) => boolean
}

/** The controls that start a NEW checkout or upgrade. Nothing else is matched: not "Manage Subscription", not a coupon or invite control. */
export const PAYMENTS_OPEN_SOON_RULES: readonly ControlRule[] = [
  // The account menu's "Upgrade for more usage" row; both menus (the original and the Pass 2 one) carry the role.
  { id: 'profile-upgrade', kind: 'label', match: (el) => el.getAttribute('data-studio-v4-profile-role') === 'upgrade' },
  // Billing, a subscriber on Pro: "Upgrade to <next plan>" ("Upgrade to Enterprise" with the Pass 2 plan list off).
  { id: 'billing-upgrade-to', kind: 'label', path: '/billing', match: (el, text) => el.tagName === 'BUTTON' && /^Upgrade to\b/.test(text) },
  // Billing, a free user: the "Unlock all features" row's button.
  { id: 'billing-view-plans', kind: 'label', path: '/billing', match: (el, text) => el.tagName === 'BUTTON' && text === 'View Plans' },
  // Billing, Add Credits: the four top-up packs ($10 to $100) each start a Stripe checkout.
  { id: 'billing-credit-pack', kind: 'price', path: '/billing', match: (el, text) => el.tagName === 'BUTTON' && /^\$\d+$/.test(text) },
]

const CANDIDATES = 'button, [data-studio-v4-profile-role="upgrade"]'
const compact = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim()

/** Marks one control. Attributes only: no text, no node, no `disabled`. */
function gate(el: Element, rule: ControlRule, text: string): void {
  el.setAttribute(PAYMENTS_OPEN_SOON_GATE_ATTR, '1')
  el.setAttribute(PAYMENTS_OPEN_SOON_RULE_ATTR, rule.id)
  el.setAttribute(PAYMENTS_OPEN_SOON_KIND_ATTR, rule.kind)
  el.setAttribute('aria-disabled', 'true')
  // The accessible name cannot change through the stylesheet: the label that is drawn is the line, and so is the name (a price keeps its price).
  el.setAttribute('aria-label', rule.kind === 'price' ? `${text}, ${PAYMENTS_OPEN_SOON_LINE}` : PAYMENTS_OPEN_SOON_LINE)
  if (rule.kind === 'price' && el.parentElement) el.parentElement.setAttribute(PAYMENTS_OPEN_SOON_GROUP_ATTR, '1')
}

/** Gates every matching control under `root` that is not gated yet. Safe to run again and again; the number of controls newly gated (0 when nothing was left to do). */
export function applyPaymentsOpenSoon(root: ParentNode, pathname: string): number {
  const path = pathname.replace(/\/+$/, '') || '/'
  let gated = 0
  for (const el of Array.from(root.querySelectorAll(CANDIDATES))) {
    if (el.getAttribute(PAYMENTS_OPEN_SOON_GATE_ATTR) === '1') continue
    const text = compact(el.textContent)
    const rule = PAYMENTS_OPEN_SOON_RULES.find((item) => (!item.path || item.path === path) && item.match(el, text))
    if (!rule) continue
    gate(el, rule, text)
    gated++
  }
  return gated
}

/** Takes every attribute this pass set off again (a page that stays mounted when the pass stops is as it was). */
function release(root: ParentNode): void {
  for (const el of Array.from(root.querySelectorAll(`[${PAYMENTS_OPEN_SOON_GATE_ATTR}], [${PAYMENTS_OPEN_SOON_GROUP_ATTR}]`))) {
    if (el.hasAttribute(PAYMENTS_OPEN_SOON_GATE_ATTR)) {
      for (const attr of [PAYMENTS_OPEN_SOON_GATE_ATTR, PAYMENTS_OPEN_SOON_RULE_ATTR, PAYMENTS_OPEN_SOON_KIND_ATTR, 'aria-disabled', 'aria-label']) el.removeAttribute(attr)
    }
    el.removeAttribute(PAYMENTS_OPEN_SOON_GROUP_ATTR)
  }
}

/**
 * Turns the pass on for a window: <html> carries the attribute the stylesheet is scoped to, the pass runs now and after every change of the page (a control that appears later, a menu that opens),
 * and one capture-phase listener on the document stops a click, or Enter or Space, whose target is inside a gated control. Returns the undo.
 */
export function installPaymentsOpenSoon(win: Window & typeof globalThis): () => void {
  const doc = win.document
  const html = doc.documentElement
  html.setAttribute(PAYMENTS_OPEN_SOON_HTML_ATTR, 'true')
  let timer: number | null = null
  const run = () => { timer = null; applyPaymentsOpenSoon(doc, win.location.pathname) }
  const schedule = () => { if (timer === null) timer = win.setTimeout(run, 0) } // many changes in one tick (a streaming chat) are one pass
  const observer = new win.MutationObserver(schedule)
  observer.observe(doc.body, { childList: true, subtree: true, characterData: true })
  const guard = (event: Event) => {
    if (event.type === 'keydown') {
      const key = (event as KeyboardEvent).key
      if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') return
    }
    const target = event.target as Element | null
    if (target && typeof target.closest === 'function' && target.closest(`[${PAYMENTS_OPEN_SOON_GATE_ATTR}="1"]`)) { event.preventDefault(); event.stopPropagation() }
  }
  doc.addEventListener('click', guard, true)
  doc.addEventListener('keydown', guard, true)
  run()
  return () => {
    observer.disconnect()
    doc.removeEventListener('click', guard, true)
    doc.removeEventListener('keydown', guard, true)
    if (timer !== null) win.clearTimeout(timer)
    release(doc)
    html.removeAttribute(PAYMENTS_OPEN_SOON_HTML_ATTR)
  }
}
