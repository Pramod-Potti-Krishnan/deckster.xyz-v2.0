/** Ported from Garud feature/companion-v2-player b3a812e (packages/core/src/voice/companion-face.ts), unchanged except where marked "Deckster:". Pure: no React, no DOM. */
/** Companion v2 wire contract. Coordinates are pack pixels; time is audio seconds. */
export const FACE_ANGLES = ["front", "left", "right"] as const;
export const FACE_MOUTHS = ["closed", "slight", "ah", "ee", "oh", "oo", "fv", "mbp", "smile"] as const;
export const FACE_EYES = ["open", "half", "closed", "look_left", "look_right", "look_up", "look_down"] as const;
export const FACE_BROWS = ["neutral", "raised", "worried", "focused", "happy"] as const;
export const FACE_EXPRESSIONS = ["happy", "laugh", "surprised", "thinking", "concerned", "sad", "proud", "curious", "sorry"] as const;
export type FaceAngle = typeof FACE_ANGLES[number];
export type FaceMouth = typeof FACE_MOUTHS[number];
export type FaceEye = typeof FACE_EYES[number];
export type FaceBrow = typeof FACE_BROWS[number];
export type FaceExpression = typeof FACE_EXPRESSIONS[number];
export interface FacePatch { x: number; y: number; w: number; h: number }
/** x/y is the head-space origin in the body canvas, rot is radians clockwise, scale is uniform. */
export interface FaceHead { x: number; y: number; scale: number; rot: number; angle: FaceAngle }
export interface FaceRecipe { brows: FaceBrow; eyes: FaceEye; mouthSet: "plain" | "smile" }
export interface CompanionFace {
  /** These keys belong only to the legacy native Face reference. */
  manifest?: never; totalBytes?: never;
  angles: FaceAngle[];
  pieces: {
    mouth: Partial<Record<FaceAngle, Record<FaceMouth, string> & Partial<Record<`smile_${FaceMouth}`, string>>>>;
    eyes: Partial<Record<FaceAngle, Record<FaceEye, string>>>;
    brows: Partial<Record<FaceAngle, Record<FaceBrow, string>>>;
  };
  /** Each image fills its matching rectangle, then the head transform maps it into the body canvas. */
  patch: Partial<Record<FaceAngle, { mouth: FacePatch; eyes: FacePatch; brows: FacePatch }>>;
  heads: Record<string, FaceHead>;
  recipes: Record<FaceExpression, FaceRecipe>;
}
export interface SpeechTimeline {
  /** Strictly increasing nonnegative seconds relative to the current audio segment. */
  cues: { t: number; mouth: FaceMouth }[];
  /** Nondecreasing audio seconds; names must exist in the playing pack when sampled. */
  gestures: { t: number; clip: string }[];
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
export const safeFaceSource = (v: unknown): v is string => typeof v === "string" && /^[a-zA-Z0-9_/-]+\.webp$/.test(v) && !v.startsWith("/") && !v.split("/").some(p => !p || p === ".." || p === ".");
/** Does not confuse the existing v1 native Face reference with a v2 face section. */
export function isCompanionFace(v: unknown): v is CompanionFace { return record(v) && own(v, "angles"); }
export function parseCompanionFace(raw: unknown, bodyFrames: readonly string[]): CompanionFace {
  const fail = (): never => { throw new Error("Invalid companion face section"); };
  if (!record(raw)) return fail();
  const f = raw as unknown as CompanionFace;
  if (!Array.isArray(f.angles) || !f.angles.length || f.angles.length > 3 || new Set(f.angles).size !== f.angles.length || f.angles.some(a => !FACE_ANGLES.includes(a)) || !record(f.pieces) || !record(f.patch) || !record(f.heads) || !record(f.recipes) || own(raw, "manifest") || own(raw, "totalBytes")) return fail();
  const complete = (v: unknown, keys: readonly string[]) => record(v) && keys.every(k => own(v, k) && safeFaceSource(v[k]));
  for (const angle of f.angles) {
    if (!complete(f.pieces.mouth?.[angle], FACE_MOUTHS) || !complete(f.pieces.eyes?.[angle], FACE_EYES) || !complete(f.pieces.brows?.[angle], FACE_BROWS)) return fail();
    const mouths = f.pieces.mouth[angle]!;
    const smiles = FACE_MOUTHS.map(m => `smile_${m}` as const);
    if (smiles.some(k => own(mouths, k)) && !complete(mouths, smiles)) return fail();
    const patches = f.patch[angle];
    for (const key of ["mouth", "eyes", "brows"] as const) {
      const p = patches?.[key];
      if (!p || ![p.x, p.y, p.w, p.h].every(finite) || p.w <= 0 || p.h <= 0 || p.w > 8192 || p.h > 8192 || Math.abs(p.x) > 8192 || Math.abs(p.y) > 8192) return fail();
    }
  }
  for (const kind of ["mouth", "eyes", "brows"] as const) {
    if (!record(f.pieces[kind]) || Object.keys(f.pieces[kind]).some(a => !f.angles.includes(a as FaceAngle))) return fail();
    const allowed: readonly string[] = kind === "mouth" ? [...FACE_MOUTHS, ...FACE_MOUTHS.map(m => `smile_${m}`)] : kind === "eyes" ? FACE_EYES : FACE_BROWS;
    for (const entries of Object.values(f.pieces[kind])) if (!record(entries) || Object.keys(entries).some(k => !allowed.includes(k)) || Object.values(entries).some(v => !safeFaceSource(v))) return fail();
  }
  if (Object.keys(f.patch).some(a => !f.angles.includes(a as FaceAngle)) || Object.keys(f.heads).length !== bodyFrames.length) return fail();
  for (const id of bodyFrames) {
    const h = own(f.heads, id) && f.heads[id];
    if (!h || ![h.x, h.y, h.scale, h.rot].every(finite) || h.scale <= 0 || h.scale > 16 || Math.abs(h.x) > 16384 || Math.abs(h.y) > 16384 || Math.abs(h.rot) > Math.PI * 2 || !f.angles.includes(h.angle)) return fail();
  }
  if (Object.keys(f.recipes).some(e => !FACE_EXPRESSIONS.includes(e as FaceExpression))) return fail();
  for (const expression of FACE_EXPRESSIONS) {
    const r = own(f.recipes, expression) && f.recipes[expression];
    if (!r || !FACE_BROWS.includes(r.brows) || !FACE_EYES.includes(r.eyes) || !["plain", "smile"].includes(r.mouthSet)) return fail();
    if (r.mouthSet === "smile" && f.angles.some(a => !complete(f.pieces.mouth[a], FACE_MOUTHS.map(m => `smile_${m}`)))) return fail();
  }
  return f;
}
export function parseSpeechTimeline(raw: unknown): SpeechTimeline {
  const fail = (): never => { throw new Error("Invalid companion speech timeline"); };
  if (!record(raw) || !Array.isArray(raw.cues) || !Array.isArray(raw.gestures) || raw.cues.length > 100000 || raw.gestures.length > 10000) return fail();
  let last = -1;
  for (const c of raw.cues) { if (!record(c) || !finite(c.t) || c.t < 0 || c.t <= last || !FACE_MOUTHS.includes(c.mouth as FaceMouth)) return fail(); last = c.t; }
  last = -1;
  for (const g of raw.gestures) { if (!record(g) || !finite(g.t) || g.t < 0 || g.t < last || typeof g.clip !== "string" || !/^[a-z][a-z0-9_]{0,79}$/.test(g.clip)) return fail(); last = g.t; }
  return raw as unknown as SpeechTimeline;
}
