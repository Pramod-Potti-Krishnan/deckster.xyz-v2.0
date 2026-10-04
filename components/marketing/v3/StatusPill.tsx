import { V3_FEATURES, V3_STATUS_WORDS, type V3Feature } from "@/lib/marketing/v3-content"

/** Public status of a feature (Live / Beta / In build / Planned), from the one config in v3-content. */
export function StatusPill({ feature, small = false }: { feature: V3Feature; small?: boolean }) {
  const status = V3_FEATURES[feature]
  return <span className={`st st--${status}${small ? " st--sm" : ""}`}>{V3_STATUS_WORDS[status]}</span>
}

/** Plain status data, for client components that can't import the content module. */
export function statusOf(feature: V3Feature) {
  const status = V3_FEATURES[feature]
  return { status, word: V3_STATUS_WORDS[status] as string }
}
