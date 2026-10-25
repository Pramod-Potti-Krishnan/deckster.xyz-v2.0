// NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT (FRONTEND-2; default off, exact "true", read at build time in lib/studio-bulk-edit-wire.ts). Type-only imports, so a plain-node test can load it.
//
// DIRECTOR-2's whole-deck edit confirm (Director !542 and the I2 polish) sends its own sentence for the card as payload.prompt_text ("Change 5 slides (slides 1-5)? I'll apply ... Rough cost: about $0.25 to $0.50.").
// With the flag on the wire parser keeps that sentence as the model's promptText (plain text, trimmed, 600 characters at most), and the card draws it ONCE, under the heading and before the quoted instruction.
// The sentence usually carries the estimate label as well ("Rough cost: <label>."): Studio must never say the same label twice, so when the sentence already holds the label the card does not draw its own
// "Estimate: <label>" line. Everything else is as it was: no sentence (flag off, missing, empty) gives back the very same model object.
import type { BulkEditConfirm } from '@/lib/studio-bulk-edit-wire'

/** The model the confirm card draws: the same object unless Director's sentence already says the estimate label, in which case a copy without estimateLabel (the sentence is the only place it is drawn). */
export function bulkEditPromptCardModel(model: BulkEditConfirm): BulkEditConfirm {
  const sentence = model.promptText
  if (typeof sentence !== 'string' || sentence === '') return model
  const label = model.estimateLabel
  return label && sentence.includes(label) ? { ...model, estimateLabel: null } : model
}
