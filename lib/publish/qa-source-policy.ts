/** Unknown kinds deny, so a source type added later cannot become readable by
 *  the audience merely because nobody updated this function. */
export function defaultAllowForKind(kind: string): boolean {
  return kind === 'deck' || kind === 'web'
}
