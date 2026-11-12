import { studioP2LandingOn } from "@/lib/studio-p2-landing"
import { studioUatContent, studioUatFeatures } from "@/lib/studio-uat-marketing"
import { SHOWCASE_SLOTS, V3_CONTENT as UAT_CONTENT, V3_FEATURES as UAT_FEATURES, V3_STATUS_WORDS, showcaseAlt } from "./v3-uat-content"
import type { V3Feature, V3Status } from "./v3-uat-content"

// PASS2 LAND-05 (NEXT_PUBLIC_STUDIO_P2_LANDING, default off): Narration and Viewers-ask are "Live" (the ruling is later than UAT's "Beta"); the sentences that said beta for them are reworded. Off: UAT's copy as written.
const STUDIO_P2_LANDING = studioP2LandingOn(process.env.NEXT_PUBLIC_STUDIO_P2_LANDING)

export const V3_FEATURES: Record<V3Feature, V3Status> = studioUatFeatures<Record<V3Feature, V3Status>>(UAT_FEATURES, STUDIO_P2_LANDING)
export const V3_CONTENT = studioUatContent(UAT_CONTENT, STUDIO_P2_LANDING)
export { SHOWCASE_SLOTS, V3_STATUS_WORDS, showcaseAlt }
export type { V3Feature, V3Status }
