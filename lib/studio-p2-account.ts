/**
 * PASS2-PAGES Account settings (streams/ops/PASS2-PAGES/account-settings.md), the "move to mock" rows owned by this page:
 *   ACC-04  primary actions are ink-slate (--ss-action), not violet: Profile "Save", the billing plan button and the upgrade alert's button.
 *           Violet stays for AI / generation (D1).
 *   ACC-17  /shortcuts on the Studio tokens: left-aligned title, flat rows with a hairline, outlined mono key chips, token tip box, token filter
 *           chips; readable in dark mode (base hovered rows went near-white under light text).
 * ACC-02 (menu entries) is the profile-menu PR's (NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU). ACC-12/13/14/16 are third-option rows and are not built.
 *
 * Flag NEXT_PUBLIC_STUDIO_P2_ACCOUNT: exact "true", and only with the literal Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL). Off: the account frame
 * and /shortcuts render exactly as before (the only change is attributes that are absent when off) and the new CSS matches nothing.
 * Import-free on purpose, so scripts/test-studio-p2-account.mjs can run the real file in a bare vm.
 */
export const STUDIO_P2_ACCOUNT_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === 'true'

/** The attribute value for the account frame and the shortcuts page: "true" with the flag, absent (undefined) without it. */
export function p2AccountAttr(enabled: boolean): 'true' | undefined {
  return enabled ? 'true' : undefined
}
