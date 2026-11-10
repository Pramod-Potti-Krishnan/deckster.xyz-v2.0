import { V3_CONTENT } from "@/lib/marketing/v3-uat-view"
import { v3Metadata } from "@/lib/marketing/v3-metadata"

/** NEXT_PUBLIC_STUDIO_UAT_MARKETING: the title, description and share card UAT gives each Landing page (the same v3Metadata calls its page files made). The route files pick these only with the flag on. */
const pages = V3_CONTENT.pages

export const uatMarketingMetadata = {
  home: v3Metadata({ path: "/", title: V3_CONTENT.metadata.title, description: V3_CONTENT.metadata.description }),
  about: v3Metadata({ path: "/about", title: pages.about.metadata.title, description: pages.about.metadata.description }),
  bring: v3Metadata({ path: "/bring", title: pages.bring.title, description: pages.bring.description }),
  experts: v3Metadata({ path: "/experts", title: pages.experts.title, description: pages.experts.description }),
  learn: v3Metadata({ path: "/learn", title: pages.learn.metadata.title, description: pages.learn.metadata.description }),
  present: v3Metadata({ path: "/present", title: pages.present.title, description: pages.present.description }),
  pricing: v3Metadata({ path: "/pricing", title: pages.pricing.metadata.title, description: pages.pricing.metadata.description }),
} as const
