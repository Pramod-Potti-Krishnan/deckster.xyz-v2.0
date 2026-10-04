import type { CSSProperties } from 'react'
import { isCanonicalThemePresetId, isValidThemeHex, normalizeThemePresetId, type BuildThemeSelection, type CanonicalThemePresetId } from '@/lib/theme-builder'

// Palette guides match the existing ThemePanel. The authoritative rendered
// theme (including generated harmony and typography) remains Director-owned.
const PREVIEW_PALETTES: Record<CanonicalThemePresetId, Record<string, string>> = {
  corporate_light: { background: '#ffffff', surface: '#eff6ff', primary: '#1e40af', accent: '#f59e0b', text_primary: '#172033' },
  corporate_dark: { background: '#0f172a', surface: '#1e293b', primary: '#60a5fa', accent: '#fbbf24', text_primary: '#f8fafc' },
  minimal: { background: '#ffffff', surface: '#f8fafc', primary: '#334155', accent: '#94a3b8', text_primary: '#0f172a' },
  vibrant: { background: '#fff7ed', surface: '#f5f3ff', primary: '#6d28d9', accent: '#f97316', text_primary: '#27203b' },
  executive: { background: '#f8fafc', surface: '#e2e8f0', primary: '#0f172a', accent: '#b45309', text_primary: '#111827' },
  pastel: { background: '#fdf2f8', surface: '#ecfeff', primary: '#8b5cf6', accent: '#2dd4bf', text_primary: '#3f3a52' },
}

export function themePreviewPalette(selection: BuildThemeSelection) {
  const id = normalizeThemePresetId(selection.preset_id)
  const base = PREVIEW_PALETTES[isCanonicalThemePresetId(id) ? id : 'corporate_light']
  const palette: Record<string, string> = { ...base, secondary: base.accent, tertiary: base.primary, neutral: '#64748b', text_body: base.text_primary, border: '#94a3b8' }
  for (const key of ['primary', 'secondary', 'tertiary', 'neutral'] as const) {
    const color = selection[`${key}_hex`]
    if (selection.mode === 'custom' && isValidThemeHex(color)) palette[key] = color
  }
  if (selection.mode === 'custom' && isValidThemeHex(selection.secondary_hex)) palette.accent = selection.secondary_hex
  for (const [token, color] of Object.entries(selection.color_overrides || {})) {
    if (isValidThemeHex(color)) palette[token] = color
  }
  return palette
}

export const THEME_TOKENS = [
  ['primary', 'Primary'], ['secondary', 'Secondary'], ['tertiary', 'Tertiary'], ['neutral', 'Neutral'],
  ['accent', 'Accent'], ['background', 'Background'], ['surface', 'Surface'],
  ['text_primary', 'Heading text'], ['text_body', 'Body text'], ['border', 'Border'],
] as const

export function ThemeSwatches({ selection }: { selection: BuildThemeSelection }) {
  const palette = themePreviewPalette(selection)
  return <span className="sl-swatches" aria-hidden="true">{['primary', 'accent', 'surface', 'background'].map(token => <i key={token} style={{ backgroundColor: palette[token] }} />)}</span>
}

export type ThemeSpecimen = 'title' | 'data' | 'content'

export function ThemePreview({ selection, specimen, name }: { selection: BuildThemeSelection; specimen: ThemeSpecimen; name: string }) {
  const palette = themePreviewPalette(selection)
  const style = Object.fromEntries(Object.entries(palette).map(([key, value]) => [`--spec-${key}`, value])) as CSSProperties
  return <div className={`sl-theme-slide sl-theme-${specimen}`} style={style} aria-label={`${specimen} palette specimen for ${name}`}>
    <span className="sl-slide-kicker">{name || 'YOUR THEME'} / PALETTE STUDY</span>
    {specimen === 'title' ? <><h2>A clear vision.<br />A lasting impression.</h2><p>Build a visual language that makes<br />every story feel like yours.</p><div className="sl-theme-art" aria-hidden="true"><i /><i /><i /></div></>
      : specimen === 'data' ? <><h2>Progress, made visible.</h2><p>Illustrative data for comparing your colors.</p><div className="sl-specimen-data"><div className="sl-chart" aria-label="Illustrative chart"><i style={{ height: '38%' }} /><i style={{ height: '57%' }} /><i style={{ height: '69%' }} /><i style={{ height: '91%' }} /></div><div><strong>24<span>%</span></strong><p>Sample growth metric</p><small>Sample only · not your data</small></div></div></>
        : <><h2>One idea. Three perspectives.</h2><p>A simple content layout to check hierarchy and contrast.</p><div className="sl-specimen-columns">{['Find the signal', 'Make it meaningful', 'Move it forward'].map((title, index) => <div key={title}><span>0{index + 1}</span><h3>{title}</h3><p>A focused message and the evidence that helps it land.</p></div>)}</div></>}
    <footer><span>DESIGN SPECIMEN</span><span>0{specimen === 'title' ? 1 : specimen === 'data' ? 2 : 3}</span></footer>
  </div>
}
