/**
 * How a reply sounds, from its words (client-safe, pure). The call uses it to pick the character's mood while it speaks: a smile and
 * bigger gestures for good news, worried brows and a frown for trouble. It is a cheap word count, not understanding: a few dozen
 * words that almost always carry good or bad news in a Director's reply, with the common "no blockers" style of negation
 * handled first so good news is not read as bad.
 */
import type { AvatarTone, RigCue } from "./avatar-rig";

/** Good news in a word or a phrase, with a weight (2 = clearly good). */
const POSITIVE: readonly [RegExp, number][] = [
  [/\b(?:good news|congrats|congratulations|great news|nailed it|well done)\b/gi, 2],
  [/\b(?:great|perfect|wonderful|excellent|fantastic|brilliant|delighted|thrilled|love)\b/gi, 2],
  [/\b(?:done|ready|approved|shipped|shipping|launched|merged|finished|completed?|resolved|fixed|passed|passing|green|unblocked|cleared)\b/gi, 1],
  [/\b(?:on track|all clear|all good|all set|good to go|looks good|went well|no problem|under budget|within budget|on budget|ahead of schedule|ahead)\b/gi, 1.5],
  [/\b(?:nice|good|glad|happy|welcome|thanks|thank you|pleased|smooth|win|wins|success|successful|solid)\b/gi, 1],
];

/** Trouble in a word or a phrase, with a weight (2 = clearly bad). */
const NEGATIVE: readonly [RegExp, number][] = [
  [/\b(?:over budget|overspent|overspend|exceeded|ran out of|out of credits|limit (?:was )?reached|cap (?:was )?reached|budget (?:is |was )?(?:nearly |almost |all )?(?:blown|gone|used up|spent)|bad news)\b/gi, 2],
  [/\b(?:blocked|blocker|blockers|failed|failure|failures|failing|crashed|crash|outage|broken|broke|rejected|denied|disaster)\b/gi, 2],
  [/\b(?:error|errors|stuck|stalled|risk|risky|overdue|late|behind|delayed|delay|urgent|problem|problems|issue|issues|missing|unable|worried|concern|concerned|sorry|unfortunately)\b/gi, 1.2],
  [/\b(?:can'?t|cannot|couldn'?t|won'?t|isn'?t working|not working|paused|stopped)\b/gi, 1],
  [/\bbudget\b/gi, 0.7],
];

/** "no blockers", "nothing failed", "not blocked": the trouble word is the good news. Counted as positive, then removed. */
const NEGATED = /\b(?:no|nothing|not|isn'?t|aren'?t|wasn'?t|weren'?t|without|zero|never)\s+(?:\w+\s+)?(?:blocked|blockers?|failed|failures?|errors?|issues?|problems?|risks?|delays?|delayed|late|overdue|stuck|behind|urgent|broken)\b/gi;

const count = (text: string, list: readonly [RegExp, number][]): number => {
  let score = 0;
  for (const [re, w] of list) {
    const m = text.match(re);
    if (m) score += w * Math.min(m.length, 3);
  }
  return score;
};

/**
 * "pleased" when the good words outweigh the bad by at least one, "concerned" when the bad outweigh the good, "neutral" otherwise.
 * Short text (under 3 letters) is neutral.
 */
export function replyTone(text: string): AvatarTone {
  const t = text.toLowerCase().replace(/[’‘]/g, "'");
  if (t.replace(/[^a-z]/g, "").length < 3) return "neutral";
  let positive = 0;
  const rest = t.replace(NEGATED, () => { positive += 1.5; return " "; }).replace(/\bunblocked\b/g, () => { positive += 1; return " "; });
  positive += count(rest, POSITIVE);
  const negative = count(rest, NEGATIVE);
  const diff = positive - negative;
  return diff >= 1 ? "pleased" : diff <= -1 ? "concerned" : "neutral";
}

const YES = /^\W*(?:yes|yeah|yep|yup|sure|absolutely|definitely|certainly|of course|okay|ok|right|exactly|got it|will do|on it|done|good|great|mm-?hm+|mhm)\b/i;
const NO = /^\W*(?:no\b|nope|not\b|nothing\b|never\b|unfortunately|sorry|i can'?t|i couldn'?t|i'?m afraid|that'?s not|i don'?t)/i;

/** A nod for a reply that opens with agreement ("Sure", "On it"), a shake for one that opens with a no ("No blockers", "Sorry"), else nothing. */
export function replyGesture(text: string): Extract<RigCue, "nod" | "shake"> | null {
  const head = text.trimStart().slice(0, 40).replace(/[’‘]/g, "'");
  if (NO.test(head)) return "shake";
  if (YES.test(head)) return "nod";
  return null;
}
