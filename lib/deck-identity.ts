/**
 * Deck identity — who is presenting (contract G3).
 *
 * See documents/DECK_IDENTITY_FOOTER_CONTRACT.md §1. The frontend is the ONLY
 * author of this object: Director never invents any of these values and never
 * restamps the date. Every field is optional, an empty string is treated as
 * absent, and **no layer may substitute a placeholder** ("Presenter Name",
 * "Your Company", "AI-Generated Presentation"). Absent means absent.
 *
 * Inputs today:
 *   - `presenter`    → the signed-in NextAuth profile name (`session.user.name`)
 *   - `company` / `confidentiality` / `logo_url`
 *                    → an optional Builder form, persisted per browser in
 *                      localStorage under DECK_IDENTITY_STORAGE_KEY
 *   - `date`         → today, local, ISO `YYYY-MM-DD`
 *
 * Everything here is pure and side-effect free apart from the two storage
 * helpers, which tolerate SSR and a throwing/blocked storage.
 */

export type DeckIdentitySource = 'profile' | 'form' | 'probe';

/** The wire object attached to `user_message.data.deck_identity`. */
export interface DeckIdentity {
  presenter?: string;
  company?: string;
  date?: string;
  confidentiality?: string;
  logo_url?: string;
  source: DeckIdentitySource;
}

/**
 * The one deck-wide chrome footer (contract G2, §1). The frontend never
 * authors this — Director composes it from `deck_identity` and echoes it back
 * on `slide_context.payload.deck.footer`; this type exists so the settings
 * panel can seed from the package.
 */
export interface DeckFooterConfig {
  /** Only Layout's five substitutions: {title} {page} {total} {date} {author}. */
  template?: string;
  values?: {
    title?: string;
    date?: string;
    author?: string;
    confidentiality?: string;
  };
  page_numbers?: boolean;
  logo_url?: string | null;
}

/** The three fields the optional Builder form owns. */
export interface DeckIdentityForm {
  company?: string;
  confidentiality?: string;
  logoUrl?: string;
}

export const DECK_IDENTITY_STORAGE_KEY = 'deckster.deck_identity.v1';

/**
 * Fired on `window` after a successful write so any mounted `useDeckIdentity`
 * recomputes immediately. (The native `storage` event only fires in *other*
 * tabs, so the writing tab needs its own signal.)
 */
export const DECK_IDENTITY_FORM_EVENT = 'deckster:deck-identity-form-changed';

/**
 * Values that mean "nothing was filled in". Substituting any of these would
 * break G3's acceptance ("an empty profile field falls back to the default,
 * never to a placeholder"), so we drop them on the way in as well as never
 * producing them ourselves.
 */
const PLACEHOLDER_VALUES: ReadonlySet<string> = new Set([
  'presenter name',
  'presenter',
  'your name',
  'your company',
  'your organisation',
  'your organization',
  'company name',
  'organisation name',
  'organization name',
  'ai-generated presentation',
  'untitled',
  'untitled presentation',
  'n/a',
  'tbd',
]);

/**
 * Zero-width and BOM characters: invisible on screen but enough to make a
 * value non-empty and to slip past the placeholder set. Stripped first so a
 * paste of "​" reads as empty and "Presenter​ Name" still matches.
 */
const ZERO_WIDTH = /[​-‍﻿]/g;

/**
 * Trim; return undefined for empty, non-string, or placeholder text.
 *
 * Normalises before the placeholder check — zero-width characters removed and
 * internal whitespace runs collapsed to one space — so "Presenter  Name" and
 * "Presenter\tName" are caught by the same set as "Presenter Name". The
 * normalised form is what gets returned and sent.
 */
export function cleanIdentityValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(ZERO_WIDTH, '').replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  if (PLACEHOLDER_VALUES.has(normalized.toLowerCase())) return undefined;
  return normalized;
}

/**
 * The contract calls `logo_url` an "optional https URL". Anything that is not
 * an https:// URL is dropped rather than forwarded — a broken or `javascript:`
 * value would travel all the way to Layout's derivative logo.
 *
 * Embedded credentials (`https://user:pass@host/…`) are dropped too: they are
 * never what someone means by a logo, they leak a secret into the package and
 * into every downstream log, and `user@host` is also the classic way to make a
 * hostile URL read as a trusted one.
 */
export function cleanLogoUrl(value: unknown): string | undefined {
  const cleaned = cleanIdentityValue(value);
  if (!cleaned) return undefined;
  try {
    const url = new URL(cleaned);
    if (url.protocol !== 'https:') return undefined;
    if (url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/**
 * Today as ISO `YYYY-MM-DD` — the LOCAL calendar date.
 *
 * Built from the local getters rather than `toISOString()` on purpose:
 * `toISOString()` converts to UTC first, which hands back yesterday's or
 * tomorrow's date for anyone west or east of Greenwich for part of the day.
 */
export function formatDeckIdentityDate(now: Date = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface BuildDeckIdentityInput {
  /** `session.user.name` from NextAuth, or null when signed out / unnamed. */
  sessionName?: string | null;
  /** The optional Builder form; `{}` or undefined when never filled in. */
  form?: DeckIdentityForm | null;
  /** Injected for testability; defaults to now. */
  now?: Date;
}

/**
 * Compose the wire object, or `null` when nothing is known.
 *
 * `source` is provenance only: "form" when the user typed anything into the
 * Builder form, otherwise "profile". A date on its own is not "knowing
 * something" — with no presenter and no form fields we send nothing at all,
 * and Director falls back to its identity-absent footer.
 */
export function buildDeckIdentity(input: BuildDeckIdentityInput = {}): DeckIdentity | null {
  const presenter = cleanIdentityValue(input.sessionName);
  const form = input.form || {};
  const company = cleanIdentityValue(form.company);
  const confidentiality = cleanIdentityValue(form.confidentiality);
  const logoUrl = cleanLogoUrl(form.logoUrl);

  const hasFormValue = Boolean(company || confidentiality || logoUrl);
  if (!presenter && !hasFormValue) return null;

  return {
    ...(presenter ? { presenter } : {}),
    ...(company ? { company } : {}),
    date: formatDeckIdentityDate(input.now),
    ...(confidentiality ? { confidentiality } : {}),
    ...(logoUrl ? { logo_url: logoUrl } : {}),
    source: hasFormValue ? 'form' : 'profile',
  };
}

/** Normalise an arbitrary parsed blob into the three known form fields. */
export function normalizeDeckIdentityForm(raw: unknown): DeckIdentityForm {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const company = cleanIdentityValue(source.company);
  const confidentiality = cleanIdentityValue(source.confidentiality);
  // Keep the raw string here (not cleanLogoUrl) so the form can show back what
  // the user typed; buildDeckIdentity is where a non-https value is dropped.
  const logoUrl = cleanIdentityValue(source.logoUrl);
  return {
    ...(company ? { company } : {}),
    ...(confidentiality ? { confidentiality } : {}),
    ...(logoUrl ? { logoUrl } : {}),
  };
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    // Private mode / blocked site data throw on *access*, not just on use.
    return null;
  }
}

/** Read the stored form. Never throws; `{}` when absent, unreadable or SSR. */
export function readDeckIdentityForm(): DeckIdentityForm {
  const storage = getLocalStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(DECK_IDENTITY_STORAGE_KEY);
    if (!raw) return {};
    return normalizeDeckIdentityForm(JSON.parse(raw));
  } catch {
    return {};
  }
}

/**
 * Persist the form (removing the key entirely when every field is empty) and
 * notify listeners in this tab. Returns the normalised form that was stored.
 */
export function writeDeckIdentityForm(form: DeckIdentityForm | null | undefined): DeckIdentityForm {
  const normalized = normalizeDeckIdentityForm(form);
  const storage = getLocalStorage();
  if (storage) {
    try {
      if (Object.keys(normalized).length === 0) {
        storage.removeItem(DECK_IDENTITY_STORAGE_KEY);
      } else {
        storage.setItem(DECK_IDENTITY_STORAGE_KEY, JSON.stringify(normalized));
      }
    } catch {
      // Storage full or blocked — the in-memory form still drives this session.
    }
  }
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event(DECK_IDENTITY_FORM_EVENT));
    }
  } catch {
    // CustomEvent unavailable (non-DOM env) — nothing to notify.
  }
  return normalized;
}

/**
 * `NEXT_PUBLIC_DECK_IDENTITY_ENABLED` — "1" or "true". When off, no
 * `deck_identity` key is ever attached to a frame and no UI is shown.
 * Referenced statically so Next can inline it at build time.
 */
export function isDeckIdentityEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_DECK_IDENTITY_ENABLED;
  const value = String(raw ?? '').trim().toLowerCase();
  return value === '1' || value === 'true';
}
