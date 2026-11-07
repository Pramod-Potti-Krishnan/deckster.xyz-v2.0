export const MOMENTS = ["congrats", "thanks", "greeting", "goodbye", "question", "instruction", "bad_news", "frustration", "idea", "small_talk"] as const;
export type Moment = (typeof MOMENTS)[number];

/** Wing gestures the drawn bird can make (one-shot, layered over the face rig). */
export const WING_GESTURES = ["wave", "celebrate", "think", "shrug", "point", "salute", "open", "comfort", "none"] as const;
export type WingGesture = (typeof WING_GESTURES)[number];

/** The gesture a moment calls for when nothing else says otherwise. */
export const MOMENT_GESTURE: Record<Moment, WingGesture> = {
  congrats: "celebrate", thanks: "open", greeting: "wave", goodbye: "wave", question: "think", instruction: "salute",
  bad_news: "comfort", frustration: "comfort", idea: "point", small_talk: "open",
};

