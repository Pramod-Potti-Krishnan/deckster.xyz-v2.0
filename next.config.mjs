import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

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

// PL-19: a Vercel PREVIEW build shows one fixed mark on every page ("Preview build: not the UAT product"), so a PR preview is never taken for the UAT product.
// Decided HERE, at build time, from Vercel's own system variable VERCEL_ENV ("production" | "preview" | "development"), which Vercel sets on the builds it runs
// (a Git-integration PR preview is "preview"; the UAT and production deploys run `vercel build --prod`, so they are "production"): no project setting, no
// variable on any Vercel target, nothing copied to the preview target. Anything other than exactly "preview" (including unset) adds NOTHING to this config,
// so a production-target build compiles exactly what it did before. On preview the root layout's toaster import is swapped for a wrapper that adds the mark.
const isVercelPreviewBuild = process.env.VERCEL_ENV === 'preview'
const previewToasterFile = fileURLToPath(new URL('./components/preview-build/preview-toaster.tsx', import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_DECKSTER_BUILD_SHA: buildFingerprint,
  },
  ...(isVercelPreviewBuild
    ? {
        webpack(config, { webpack }) {
          config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^@\/components\/ui\/toaster$/, previewToasterFile))
          return config
        },
      }
    : {}),
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
    ];
  },
  // Headers for security
  async headers() {
    return [
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
