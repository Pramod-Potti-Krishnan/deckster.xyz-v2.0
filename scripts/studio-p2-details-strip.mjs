// DET-03 (NEXT_PUBLIC_STUDIO_P2_DETAILS): the exact text this change adds to components/studio-personal/details-workspace.tsx, as [text with the
// change, base text]. scripts/test-studio-p2-details.mjs proves stripping gives back the base file byte for byte and that each addition is gated.
export const BASE_COMMIT = 'fbc77c0430099ec7e11a188307ee5521b6937719'
export const FILE = 'components/studio-personal/details-workspace.tsx'
export const CHANGES = [
  [
    `import "./personal-workspaces.css"\nimport { STUDIO_P2_DETAILS_ENABLED as p2Details, contactLine, httpsLogoUrl, logoUrlProblem } from "@/lib/studio-p2-details"\n`,
    `import "./personal-workspaces.css"\n`,
  ],
  [
    `  const [status, setStatus] = useState("")\n  // DET-03 (p2Details): the website and the logo URL of this local preview; never saved.\n  const [p2Fields, setP2Fields] = useState({ website: "", logoUrl: "" })\n  const p2LogoUrl = p2Details ? httpsLogoUrl(p2Fields.logoUrl) : null\n  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft(accountName)) || Boolean(logo) || (p2Details && Boolean(p2Fields.website || p2Fields.logoUrl))\n`,
    `  const [status, setStatus] = useState("")\n  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft(accountName)) || Boolean(logo)\n`,
  ],
  [
    `              <label className="sp-field"><span>{p2Details ? "Professional title" : "Job title"}</span>`,
    `              <label className="sp-field"><span>Job title</span>`,
  ],
  [
    `              {p2Details ? <>
                <label className="sp-field"><span>Contact email <small>Optional</small></span><input type="email" value={draft.email} maxLength={120} placeholder="name@example.com" autoComplete="off" onChange={event => update("email", event.target.value)} /></label>
                <label className="sp-field"><span>Website <small>Optional</small></span><input value={p2Fields.website} maxLength={120} placeholder="example.com" autoComplete="off" onChange={event => { setP2Fields(previous => ({ ...previous, website: event.target.value })); setStatus("Preview updated. Your account and presentations are unchanged.") }} /></label>
                <label className="sp-field sp-field-wide"><span>Confidentiality line <small>Optional</small></span><input value={draft.confidentiality} maxLength={120} placeholder="e.g. Internal discussion" onChange={event => update("confidentiality", event.target.value)} /></label>
                <label className="sp-field sp-field-wide"><span>Logo URL <small>Optional · https only</small></span><input type="url" value={p2Fields.logoUrl} maxLength={500} placeholder="https://example.com/logo.png" autoComplete="off" aria-invalid={logoUrlProblem(p2Fields.logoUrl) ? true : undefined} onChange={event => { setP2Fields(previous => ({ ...previous, logoUrl: event.target.value })); setStatus("Preview updated. Your account and presentations are unchanged.") }} />{logoUrlProblem(p2Fields.logoUrl) ? <small className="sp-error" role="alert">{logoUrlProblem(p2Fields.logoUrl)}</small> : <small>Shown in this preview only. A chosen logo file in Footer &amp; logo takes its place.</small>}</label>
              </> : <label className="sp-field sp-field-wide"><span>Contact line <small>Optional</small></span>`,
    `              <label className="sp-field sp-field-wide"><span>Contact line <small>Optional</small></span>`,
  ],
  [
    `onChange={event => update("email", event.target.value)} /></label>}\n            </div>`,
    `onChange={event => update("email", event.target.value)} /></label>\n            </div>`,
  ],
  [
    `{logo && <img key={logo.url} src={logo.url} alt="Your selected logo preview" onError={() => discardFailedLogo(logo.url)} />}{p2Details && !logo && p2LogoUrl && <img key={p2LogoUrl} src={p2LogoUrl} alt="Your logo URL preview" referrerPolicy="no-referrer" />}</div>`,
    `{logo && <img key={logo.url} src={logo.url} alt="Your selected logo preview" onError={() => discardFailedLogo(logo.url)} />}</div>`,
  ],
  [
    `{p2Details ? contactLine(draft.email, p2Fields.website) && <small>{contactLine(draft.email, p2Fields.website)}</small> : draft.email.trim() && <small>{draft.email.trim()}</small>}`,
    `{draft.email.trim() && <small>{draft.email.trim()}</small>}`,
  ],
]

export function stripP2Details(text) {
  return CHANGES.reduce((out, [added, base]) => out.replace(added, () => base), text)
}
