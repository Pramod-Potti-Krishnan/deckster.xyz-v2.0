import type { MetadataRoute } from 'next'
import { notFound } from 'next/navigation'

// Same base-URL derivation as lib/publish/serialize.ts (getPublicAppUrl).
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://deckster.xyz'

const ROUTES = [
  '/',
  '/bring',
  '/present',
  '/experts',
  '/pricing',
  '/about',
  '/learn',
  '/docs',
  '/help',
  '/legal/privacy',
  '/legal/terms',
  '/legal/security',
  '/legal/cookies',
]

// NEXT_PUBLIC_STUDIO_UAT_MARKETING (default off): robots.txt names /sitemap.xml, which is a 404 on this branch without the flag; with it on the sitemap is UAT's. Off: still a 404.
export default function sitemap(): MetadataRoute.Sitemap {
  if (process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING !== "true") notFound()
  const base = BASE_URL.replace(/\/+$/, '')
  return ROUTES.map((route) => ({
    url: route === '/' ? base : `${base}${route}`,
  }))
}
