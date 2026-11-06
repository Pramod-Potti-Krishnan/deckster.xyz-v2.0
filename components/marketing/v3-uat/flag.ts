import { studioUatMarketingOn } from "@/lib/studio-uat-marketing"

/** NEXT_PUBLIC_STUDIO_UAT_MARKETING (default off), read once at build time. */
export const studioUatMarketing = { on: studioUatMarketingOn(process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING) }
