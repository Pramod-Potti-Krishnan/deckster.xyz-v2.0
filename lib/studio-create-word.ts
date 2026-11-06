// PASS2B G56 (flag NEXT_PUBLIC_STUDIO_CREATE_WORD, default off). Import-free: one word only.
//
// The Studio named the "make another one" action three ways: "New Presentation" on the Decks page, "Presentation" in the Sessions panel and
// (with the top-bar flag) "New deck" in the builder's top bar, while its rail, page titles and tabs already say "decks" ("Your decks"). The
// accepted v4 mockup also reads "Your decks" for the list. Behind the flag every create button says "New deck", the top bar's word. Labels only:
// routes, handlers, ids and every other string are untouched.

export const STUDIO_NEW_DECK_LABEL = 'New deck'

/** `original` (the base's own word at that call site) unless the flag, already resolved by the caller, is a real `true`. */
export function studioCreateLabel(unified: boolean, original: string): string {
  return unified === true ? STUDIO_NEW_DECK_LABEL : original
}
