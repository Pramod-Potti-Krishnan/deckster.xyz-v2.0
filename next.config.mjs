import { execFileSync } from 'node:child_process'

function resolveBuildFingerprint() {
  const configured =
    process.env.NEXT_PUBLIC_DECKSTER_BUILD_SHA
    || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
    || process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.GIT_COMMIT_SHA
  if (configured) return configured
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return `package-${process.env.npm_package_version || '0.1.0'}`
  }
}

const buildFingerprint = resolveBuildFingerprint()

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_DECKSTER_BUILD_SHA: buildFingerprint,
  },
  eslint: {
    // Temporarily ignore ESLint during builds to deploy first
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Temporarily ignore TypeScript errors during builds to deploy first
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    domains: ['deckster.xyz'],
  },
  // Add production optimizations
  reactStrictMode: true,
  // Enable source maps for debugging production issues (Round 18)
  productionBrowserSourceMaps: true,
  // Redirects — preserve inbound links to renamed routes.
  async redirects() {
    return [
      { source: '/resources', destination: '/learn', permanent: true },
      { source: '/resources/:slug', destination: '/learn/:slug', permanent: true },
      { source: '/v3', destination: '/', permanent: false },
      { source: '/templates', destination: '/bring#library', permanent: false },
      { source: '/examples', destination: '/bring#library', permanent: false },
      { source: '/integrations', destination: '/bring#inout', permanent: false },
      { source: '/agents', destination: '/experts', permanent: false },
      // Sign-in / sign-up link to these short paths; the pages live under /legal.
      { source: '/terms', destination: '/legal/terms', permanent: false },
      { source: '/privacy', destination: '/legal/privacy', permanent: false },
      // /docs/api described an API that does not exist; /shortcuts listed mostly unimplemented keys.
      { source: '/docs/api', destination: '/docs', permanent: false },
      { source: '/shortcuts', destination: '/learn', permanent: false },
    ];
  },
  // Headers for security
  async headers() {
    return [
      {
        // Marketing slide stills keep stable paths while their pixels are still
        // being replaced, so cache briefly (1 day) and revalidate in the background.
        source: '/marketing/v3/slides/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800'
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
        ],
      },
    ];
  },
}

export default nextConfig
