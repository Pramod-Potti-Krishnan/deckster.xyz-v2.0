// PASS2D (flag NEXT_PUBLIC_STUDIO_THEME_PLAIN_WORDS, exact "true" and the Studio shell; default off): the theme pickers describe each theme in plain words, and a search
// matches theme names only.
//
// What the J4 run saw (PASS2-J4-FINDINGS item 4b; THEME-2 look-and-feel ranks 2 and 3): the descriptions Theme Builder ships with the canon presets are style notes for
// engineers ("card-token", "THE one red element per slide", "acid #D6F221", "role-swap", "Border-not-fill"), and they showed in the canvas dialog's preview header and as
// tooltips, and the composer's Build theme search matched them: typing "gold" returned Vibrant because its hidden description mentions gold, with no visible reason.
// #363 only moved the descriptions into tooltips.
//
// With the flag on: a theme the table below knows is described by its line here (what the slides look like and what it suits, no colour codes), wherever the pickers show a
// description; a theme it does not know keeps the description it came with. A search matches the theme's name and nothing hidden. Names, colours, order, selection, Apply
// and the payload do not change.
//
// This file imports nothing, so a node test can load it on its own.

// Literal property access so Next inlines the values into the client bundle.
export const STUDIO_THEME_PLAIN_WORDS_ENABLED = process.env.NEXT_PUBLIC_STUDIO_THEME_PLAIN_WORDS === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

/** The ten Theme Builder presets, described by what the slides look like. Written against the canon palettes (Theme Builder config/canon_presets.py). */
export const THEME_PLAIN_DESCRIPTIONS: Readonly<Record<string, string>> = {
  corporate_light: 'Light slides with navy headings and a red accent. Clean and businesslike.',
  corporate_dark: 'Dark slides with bright cyan highlights. Sharp and modern.',
  minimal: 'White slides with black text and one red accent. Quiet and uncluttered.',
  vibrant: 'Warm cream slides with red, gold and navy. Friendly and energetic.',
  executive: 'White slides with deep green and black. Formal and polished.',
  pastel: 'Soft ivory slides with forest green and terracotta. Calm and gentle.',
  concrete_acid: 'Concrete-grey slides with black text and one bright lime highlight. Bold and modern.',
  espresso_editorial: 'Warm ivory pages with brown text and caramel touches. Reads like a printed magazine.',
  gilded_noir: 'Near-black slides with thin gold lines and gold text. Dramatic and luxurious.',
  mission_amber: 'Warm dark slides with orange highlights, plus cream paper slides. Bold and warm.',
}

/** The description to show for a preset: its plain-words line when the flag is on and the preset is known, else the description it came with. */
export function themePlainDescription(enabled: boolean, presetId: string | null | undefined, original: string): string {
  if (enabled !== true || typeof presetId !== 'string') return original
  return Object.prototype.hasOwnProperty.call(THEME_PLAIN_DESCRIPTIONS, presetId) ? THEME_PLAIN_DESCRIPTIONS[presetId] : original
}

/** The text a theme search matches: the name alone with the flag on; the name and the description (as before) with it off. */
export function themeSearchText(enabled: boolean, name: string, description: string): string {
  return enabled === true ? name : `${name} ${description}`
}
