"use client"

// PASS2 ADMIN USERS + COUPONS (NEXT_PUBLIC_STUDIO_P2_ADMIN, default off): /admin/users and /admin/coupons in the Studio shell's tokens, type and spacing, light and dark.
// app/admin/users/layout.tsx and app/admin/coupons/layout.tsx render these instead of the old pages; the old pages (page.tsx) are not touched. Same six requests with the same bodies, the same
// sign-in redirect, the same "Access denied" for a 403 (lib/studio-p2-admin.ts holds the words and rules). The admin chrome (links to the other admin page and to Studio) is drawn only once the
// route has said yes to this account; until then, and for a 403 or a failed read, the page is one neutral panel, as before.

import { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { format } from "date-fns"
import { AlertCircle, Check, Copy, Layers, Plus, RefreshCw, Search, Ticket, ToggleLeft, ToggleRight, X } from "lucide-react"
import {
  STUDIO_P2_ADMIN_API, STUDIO_P2_ADMIN_COPIED_MS, STUDIO_P2_ADMIN_CREATE_FAILURE, STUDIO_P2_ADMIN_DEFAULT_FILTER, STUDIO_P2_ADMIN_EMPTY_FORM, STUDIO_P2_ADMIN_FILTER_LABELS,
  STUDIO_P2_ADMIN_NAV, STUDIO_P2_ADMIN_ROUTES, STUDIO_P2_ADMIN_SIGN_IN, STUDIO_P2_ADMIN_USER_FILTERS, STUDIO_P2_ADMIN_WORDS as WORDS,
  studioP2AdminApproveFailure, studioP2AdminApproveInit, studioP2AdminCopyFailure, studioP2AdminCouponTotals, studioP2AdminCreateInit, studioP2AdminDate, studioP2AdminExpiry, studioP2AdminFailureSentence,
  studioP2AdminFilterUsers, studioP2AdminInitial, studioP2AdminListOutcome, studioP2AdminMoney, studioP2AdminRedeemed, studioP2AdminRows, studioP2AdminTierLabel, studioP2AdminToggleFailure,
  studioP2AdminToggleInit, studioP2AdminUserCounts, studioP2AdminUsersEmpty,
  type StudioP2AdminCoupon, type StudioP2AdminCouponForm, type StudioP2AdminListOutcome, type StudioP2AdminUser, type StudioP2AdminUserFilter,
} from "@/lib/studio-p2-admin"
import "./studio-p2-admin.css"

type Page = "users" | "coupons"
type Load = "loading" | StudioP2AdminListOutcome

const day = (value: string | null | undefined) => { const date = studioP2AdminDate(value); return date ? format(date, "MMM d, yyyy") : "" }
const readError = async (response: Response) => { try { return ((await response.json()) as { error?: unknown } | null)?.error } catch { return undefined } }

// Pure pieces (no hooks: the page components own every piece of state).
function Frame({ page, state, children }: { page: Page; state: Load; children: React.ReactNode }) {
  return (
    <div data-studio-p2-admin="true" data-page={page} data-state={state}>
      <header className="sa-bar">
        <div className="sa-bar-in">
          <Link href="/" className="sa-brand" aria-label={WORDS.home}><Layers aria-hidden="true" /></Link>
          <span className="sa-eyebrow">{WORDS.eyebrow}</span>
          <nav className="sa-nav" aria-label={WORDS.navLabel}>
            {STUDIO_P2_ADMIN_NAV.map(item => <Link key={item.id} href={item.href} className="sa-nav-link" aria-current={item.id === page ? "page" : undefined}>{item.label}</Link>)}
          </nav>
          <Link href={STUDIO_P2_ADMIN_ROUTES.studio} className="sa-studio">{WORDS.openStudio}</Link>
        </div>
      </header>
      <main className="sa-main">{children}</main>
    </div>
  )
}

function Bare({ page, state, title, body, children }: { page: Page; state: Load; title?: string; body?: string; children?: React.ReactNode }) {
  return (
    <div data-studio-p2-admin="true" data-page={page} data-state={state}>
      <main className="sa-center">
        {state === "loading"
          ? <div className="sa-loading" role="status"><span className="sa-spin" aria-hidden="true" /><span>{body}</span></div>
          : <section className="sa-card" aria-labelledby={`sa-${page}-${state}`}>
              <AlertCircle aria-hidden="true" />
              <h1 id={`sa-${page}-${state}`}>{title}</h1>
              <p>{body}</p>
              <div className="sa-card-actions">{children}</div>
            </section>}
      </main>
    </div>
  )
}

function Stats({ items }: { items: { label: string; value: string | number; hint?: string }[] }) {
  return <dl className="sa-stats">{items.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd>{item.hint && <small>{item.hint}</small>}</div>)}</dl>
}

function Empty({ title, body }: { title: string; body: string }) {
  return <div className="sa-empty" role="status"><b>{title}</b>{body && <> <span>{body}</span></>}</div>
}

/** The state both pages share: the session, the first read, what a read means, and the redirects the old pages made. */
function useAdminList<Row>(page: Page, url: string, key: "users" | "coupons") {
  const { status } = useSession()
  const router = useRouter()
  const [load, setLoad] = useState<Load>("loading")
  const [rows, setRows] = useState<Row[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const started = useRef(false)
  const hasRows = useRef(false)

  const read = async () => {
    setRefreshing(true)
    let outcome: StudioP2AdminListOutcome = "failed"
    let next: Row[] = []
    try {
      const response = await fetch(url)
      outcome = studioP2AdminListOutcome(response.status)
      if (outcome === "ready") next = studioP2AdminRows<Row>(await response.json(), key)
    } catch { outcome = "failed" }
    if (outcome === "ready") { hasRows.current = true; setRows(next); setLoad("ready"); setNotice(null) }
    else if (outcome === "failed" && hasRows.current) setNotice(WORDS.refreshFailed)
    else setLoad(outcome)
    setRefreshing(false)
  }

  useEffect(() => { if (status === "unauthenticated") router.push(STUDIO_P2_ADMIN_SIGN_IN[page]) }, [status, router, page])
  useEffect(() => { if (status === "authenticated" && !started.current) { started.current = true; void read() } }, [status])
  useEffect(() => { if (load === "forbidden") router.push(STUDIO_P2_ADMIN_ROUTES.studio) }, [load, router])

  const gate = (loadingWords: string, failedTitle: string) => {
    if (status === "loading" || load === "loading") return <Bare page={page} state="loading" body={loadingWords} />
    if (load === "forbidden") return <Bare page={page} state="forbidden" title={WORDS.deniedTitle} body={WORDS.deniedBody}><Link href={STUDIO_P2_ADMIN_ROUTES.studio} className="sa-btn" data-primary="true">{WORDS.openStudio}</Link></Bare>
    if (load === "signin") return <Bare page={page} state="signin" title={WORDS.signedOutTitle} body={WORDS.signedOutBody}><Link href={STUDIO_P2_ADMIN_SIGN_IN[page]} className="sa-btn" data-primary="true">{WORDS.signIn}</Link></Bare>
    if (load === "failed") return <Bare page={page} state="failed" title={failedTitle} body={WORDS.failedBody}><button type="button" className="sa-btn" data-primary="true" disabled={refreshing} onClick={read}>{WORDS.retry}</button></Bare>
    return null
  }
  return { load, rows, refreshing, notice, setNotice, read, gate }
}

export function StudioP2AdminUsers() {
  const list = useAdminList<StudioP2AdminUser>("users", STUDIO_P2_ADMIN_API.users, "users")
  const [filter, setFilter] = useState<StudioP2AdminUserFilter>(STUDIO_P2_ADMIN_DEFAULT_FILTER)
  const [query, setQuery] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const decide = async (user: StudioP2AdminUser, approved: boolean) => {
    setBusyId(user.id)
    list.setNotice(null)
    try {
      const response = await fetch(STUDIO_P2_ADMIN_API.approve, studioP2AdminApproveInit(user.id, approved))
      if (response.ok) await list.read()
      else list.setNotice(studioP2AdminFailureSentence(response.status, await readError(response), studioP2AdminApproveFailure(user.name || user.email, approved)))
    } catch {
      list.setNotice(studioP2AdminApproveFailure(user.name || user.email, approved))
    } finally {
      setBusyId(null)
    }
  }

  const gated = list.gate(WORDS.loadingUsers, WORDS.failedUsersTitle)
  if (gated) return gated
  const counts = studioP2AdminUserCounts(list.rows)
  const shown = studioP2AdminFilterUsers(list.rows, filter, query)
  const empty = studioP2AdminUsersEmpty(filter, query, counts.total)
  return (
    <Frame page="users" state="ready">
      <div className="sa-head"><div><h1>{WORDS.usersTitle}</h1><p>{WORDS.usersLead}</p></div></div>
      {list.notice && <p className="sa-notice" role="alert">{list.notice}</p>}
      <Stats items={[{ label: WORDS.statTotalUsers, value: counts.total }, { label: WORDS.statPending, value: counts.pending }, { label: WORDS.statApproved, value: counts.approved }]} />
      <section className="sa-panel" aria-label={WORDS.usersTitle}>
        <div className="sa-toolbar">
          <div className="sa-filters" role="group" aria-label="Show">
            {STUDIO_P2_ADMIN_USER_FILTERS.map(option => <button key={option} type="button" className="sa-filter" aria-pressed={filter === option} onClick={() => setFilter(option)}>{STUDIO_P2_ADMIN_FILTER_LABELS[option]} <span>({option === "all" ? counts.total : option === "pending" ? counts.pending : counts.approved})</span></button>)}
          </div>
          <div className="sa-tools">
            <label className="sa-search"><Search aria-hidden="true" /><input type="search" aria-label={WORDS.searchLabel} placeholder={WORDS.searchPlaceholder} value={query} onChange={event => setQuery(event.target.value)} /></label>
            <button type="button" className="sa-icon-btn" aria-label={WORDS.refreshUsers} title={WORDS.refreshUsers} disabled={list.refreshing} onClick={list.read}><RefreshCw className={list.refreshing ? "sa-spinning" : undefined} aria-hidden="true" /></button>
          </div>
        </div>
        {shown.length === 0
          ? <Empty title={empty.title} body={empty.body} />
          : <ul className="sa-rows">
              {shown.map(user => {
                const name = user.name || WORDS.noName
                const busy = busyId === user.id
                const signedUp = day(user.createdAt), approvedOn = day(user.approvedAt)
                return (
                  <li key={user.id} className="sa-row">
                    <span className="sa-avatar" aria-hidden="true">{user.image ? <img src={user.image} alt="" /> : studioP2AdminInitial(user.name, user.email)}</span>
                    <div className="sa-who">
                      <div className="sa-line">
                        <b className="sa-name">{name}</b>{" "}
                        <span className="sa-chip" data-tone={user.approved ? "ok" : "wait"}>{user.approved && <Check aria-hidden="true" />}{user.approved ? WORDS.statusApproved : WORDS.statusPending}</span>{" "}
                        <span className="sa-chip">{studioP2AdminTierLabel(user.tier)}</span>
                      </div>
                      <span className="sa-email">{user.email}</span>
                      <span className="sa-meta">{signedUp && `Signed up ${signedUp}`}{approvedOn && ` · Approved ${approvedOn}`}</span>
                    </div>
                    <button type="button" className="sa-btn" data-primary={user.approved ? undefined : "true"} data-tone={user.approved ? "danger" : undefined} disabled={busy} aria-busy={busy || undefined} aria-label={`${user.approved ? WORDS.revoke : WORDS.approve} ${user.name || user.email}`} onClick={() => decide(user, !user.approved)}>
                      {busy ? <RefreshCw className="sa-spinning" aria-hidden="true" /> : user.approved ? <X aria-hidden="true" /> : <Check aria-hidden="true" />}{user.approved ? WORDS.revoke : WORDS.approve}
                    </button>
                  </li>
                )
              })}
            </ul>}
      </section>
    </Frame>
  )
}

export function StudioP2AdminCoupons() {
  const list = useAdminList<StudioP2AdminCoupon>("coupons", STUDIO_P2_ADMIN_API.coupons, "coupons")
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [form, setForm] = useState<StudioP2AdminCouponForm>(STUDIO_P2_ADMIN_EMPTY_FORM)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const codeField = useRef<HTMLInputElement>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const set = (field: keyof StudioP2AdminCouponForm, value: string) => setForm(previous => ({ ...previous, [field]: value }))

  // Opening the form puts the keyboard in its first field.
  useEffect(() => { if (showCreate) codeField.current?.focus() }, [showCreate])
  useEffect(() => () => { if (copiedTimer.current) clearTimeout(copiedTimer.current) }, [])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const response = await fetch(STUDIO_P2_ADMIN_API.coupons, studioP2AdminCreateInit(form))
      if (!response.ok) { setCreateError(studioP2AdminFailureSentence(response.status, await readError(response), STUDIO_P2_ADMIN_CREATE_FAILURE)); return }
      setForm(STUDIO_P2_ADMIN_EMPTY_FORM)
      setShowCreate(false)
      await list.read()
    } catch {
      setCreateError(STUDIO_P2_ADMIN_CREATE_FAILURE)
    } finally {
      setCreating(false)
    }
  }

  const toggle = async (coupon: StudioP2AdminCoupon) => {
    setTogglingId(coupon.id)
    list.setNotice(null)
    try {
      const response = await fetch(STUDIO_P2_ADMIN_API.coupon(coupon.id), studioP2AdminToggleInit(coupon.active))
      if (response.ok) await list.read()
      else list.setNotice(studioP2AdminFailureSentence(response.status, await readError(response), studioP2AdminToggleFailure(coupon.code, coupon.active)))
    } catch {
      list.setNotice(studioP2AdminToggleFailure(coupon.code, coupon.active))
    } finally {
      setTogglingId(null)
    }
  }

  const copy = async (coupon: StudioP2AdminCoupon) => {
    list.setNotice(null)
    try {
      await navigator.clipboard.writeText(coupon.code)
    } catch {
      setCopiedId(null)
      list.setNotice(studioP2AdminCopyFailure(coupon.code))
      return
    }
    setCopiedId(coupon.id)
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopiedId(null), STUDIO_P2_ADMIN_COPIED_MS)
  }

  const gated = list.gate(WORDS.loadingCoupons, WORDS.failedCouponsTitle)
  if (gated) return gated
  const totals = studioP2AdminCouponTotals(list.rows)
  const now = Date.now()
  return (
    <Frame page="coupons" state="ready">
      <div className="sa-head">
        <div><h1>{WORDS.couponsTitle}</h1><p>{WORDS.couponsLead}</p></div>
        <div className="sa-head-actions">
          <button type="button" className="sa-icon-btn" aria-label={WORDS.refreshCoupons} title={WORDS.refreshCoupons} disabled={list.refreshing} onClick={list.read}><RefreshCw className={list.refreshing ? "sa-spinning" : undefined} aria-hidden="true" /></button>
          <button type="button" className="sa-btn" data-primary="true" aria-expanded={showCreate} aria-controls="sa-create" onClick={() => setShowCreate(!showCreate)}><Plus aria-hidden="true" />{WORDS.newCoupon}</button>
        </div>
      </div>
      {list.notice && <p className="sa-notice" role="alert">{list.notice}</p>}
      <Stats items={[{ label: WORDS.statTotalCoupons, value: totals.total }, { label: WORDS.statActive, value: totals.active }, { label: WORDS.statRedemptions, value: totals.redemptions, hint: `${studioP2AdminMoney(totals.creditedCents)} credited` }]} />
      {showCreate && (
        <section className="sa-panel sa-create" id="sa-create" aria-labelledby="sa-create-title">
          <h2 id="sa-create-title">{WORDS.createTitle}</h2>
          <form onSubmit={create} className="sa-form">
            <div className="sa-field"><label htmlFor="code">{WORDS.labels.code}</label><input ref={codeField} id="code" className="sa-mono" value={form.code} onChange={event => set("code", event.target.value.toUpperCase())} placeholder={WORDS.placeholders.code} required /></div>
            <div className="sa-field"><label htmlFor="value">{WORDS.labels.value}</label><input id="value" type="number" step="0.01" min="0.01" value={form.valueDollars} onChange={event => set("valueDollars", event.target.value)} placeholder={WORDS.placeholders.value} required /></div>
            <div className="sa-field">
              <label htmlFor="tier">{WORDS.labels.tier}</label>
              <select id="tier" value={form.tier} onChange={event => set("tier", event.target.value)}>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="premium">Max</option>
              </select>
            </div>
            <div className="sa-field"><label htmlFor="maxRedemptions">{WORDS.labels.max}</label><input id="maxRedemptions" type="number" min="1" value={form.maxRedemptions} onChange={event => set("maxRedemptions", event.target.value)} placeholder={WORDS.placeholders.max} /></div>
            <div className="sa-field"><label htmlFor="expiresAt">{WORDS.labels.expires}</label><input id="expiresAt" type="datetime-local" value={form.expiresAt} onChange={event => set("expiresAt", event.target.value)} /></div>
            <div className="sa-field" data-wide="true"><label htmlFor="note">{WORDS.labels.note}</label><input id="note" value={form.note} onChange={event => set("note", event.target.value)} placeholder={WORDS.placeholders.note} /></div>
            {createError && <p className="sa-error" role="alert">{createError}</p>}
            <div className="sa-form-actions">
              <button type="submit" className="sa-btn" data-primary="true" disabled={creating}>{creating ? <RefreshCw className="sa-spinning" aria-hidden="true" /> : <Ticket aria-hidden="true" />}{WORDS.createSubmit}</button>
              <button type="button" className="sa-btn" onClick={() => setShowCreate(false)}>{WORDS.cancel}</button>
            </div>
          </form>
        </section>
      )}
      <section className="sa-panel" aria-label={WORDS.couponsTitle}>
        {list.rows.length === 0
          ? <Empty title={WORDS.noCoupons} body="" />
          : <ul className="sa-rows">
              {list.rows.map(coupon => {
                const expiry = studioP2AdminExpiry(coupon.expiresAt, now)
                const created = day(coupon.createdAt)
                const copied = copiedId === coupon.id
                const busy = togglingId === coupon.id
                return (
                  <li key={coupon.id} className="sa-row" data-active={coupon.active ? "true" : "false"}>
                    <div className="sa-who">
                      <div className="sa-line">
                        <button type="button" className="sa-code" title={WORDS.copyTitle} aria-label={`Copy ${coupon.code}`} onClick={() => copy(coupon)}>{coupon.code}{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}</button>{" "}
                        {copied && <><span className="sa-copied" role="status">{WORDS.copied}</span>{" "}</>}
                        <span className="sa-chip" data-tone={coupon.active ? "ok" : undefined}>{coupon.active ? WORDS.statusActive : WORDS.statusInactive}</span>{" "}
                        <span className="sa-chip">{studioP2AdminMoney(coupon.valueCents)}</span>{" "}
                        <span className="sa-chip">{studioP2AdminTierLabel(coupon.tier)}</span>
                      </div>
                      <span className="sa-meta">
                        {studioP2AdminRedeemed(coupon.timesRedeemed, coupon.maxRedemptions)}
                        {expiry && <span data-expired={expiry.expired ? "true" : undefined}> · {expiry.word} {format(expiry.date, "MMM d, yyyy")}</span>}
                        {created && ` · Created ${created}`}
                      </span>
                      {coupon.note && <span className="sa-note">{coupon.note}</span>}
                    </div>
                    <button type="button" className="sa-btn" disabled={busy} aria-busy={busy || undefined} aria-label={`${coupon.active ? WORDS.disable : WORDS.enable} ${coupon.code}`} onClick={() => toggle(coupon)}>
                      {busy ? <RefreshCw className="sa-spinning" aria-hidden="true" /> : coupon.active ? <ToggleRight aria-hidden="true" /> : <ToggleLeft aria-hidden="true" />}{coupon.active ? WORDS.disable : WORDS.enable}
                    </button>
                  </li>
                )
              })}
            </ul>}
      </section>
    </Frame>
  )
}
