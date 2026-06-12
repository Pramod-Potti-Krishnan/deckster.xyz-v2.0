/**
 * Twitter cards use the same 1200×630 art as the OG image. Re-exporting the
 * route (rather than relying on crawler fallback) guarantees the
 * twitter:image tag is emitted.
 */
export { alt, size, contentType } from "./opengraph-image"
export { default } from "./opengraph-image"
