import type { MetadataRoute } from 'next'

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

export default function sitemap(): MetadataRoute.Sitemap {
  const base = BASE_URL.replace(/\/+$/, '')
  return ROUTES.map((route) => ({
    url: route === '/' ? base : `${base}${route}`,
  }))
}
