import { withSentryConfig } from "@sentry/nextjs"
import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

import { buildEmbedSecurityHeaders, buildSecurityHeaders } from "@/lib/security-headers"

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const nextConfig: NextConfig = {
  /** Dev HMR + hydration on merchant subdomains (e.g. slug.shops.localhost:3001). */
  allowedDevOrigins: ["*.shops.localhost", "127.0.0.1", "localhost"],
  async headers() {
    return [
      {
        source: "/embed/:path*",
        headers: [...buildEmbedSecurityHeaders()],
      },
      {
        source: "/:path*",
        headers: [...buildSecurityHeaders()],
      },
    ]
  },
  async redirects() {
    return [
      { source: "/terms", destination: "/cgu", permanent: true },
      { source: "/legal/cookies-policy", destination: "/cookies", permanent: true },
      { source: "/legal/privacy-policy", destination: "/privacy", permanent: true },
      { source: "/legal/terms-of-service", destination: "/cgu", permanent: true },
      { source: "/cga", destination: "/conditions-fournisseur", permanent: true },
      { source: "/cgs", destination: "/conditions-affilie", permanent: true },
      { source: "/legal/terms-supplier", destination: "/conditions-fournisseur", permanent: true },
      { source: "/legal/terms-affiliate", destination: "/conditions-affilie", permanent: true },
      { source: "/accessibility", destination: "/accessibilite", permanent: true },
    ]
  },
  output: "standalone" as const,
  /** Source maps only when Sentry upload is configured — smaller client payloads otherwise. */
  productionBrowserSourceMaps: Boolean(
    process.env.SENTRY_AUTH_TOKEN?.trim() &&
      process.env.SENTRY_ORG?.trim() &&
      process.env.SENTRY_PROJECT?.trim()
  ),
  /** Keep WASM/ONNX browser stacks out of serverless traces (photo-studio is client-only). */
  outputFileTracingExcludes: {
    "*": [
      "node_modules/onnxruntime-web/**",
      "node_modules/@imgly/background-removal/**",
    ],
  },
  /** Runtime `fs.readFileSync` for `/legal/[slug]` markdown sources (standalone / Vercel). */
  outputFileTracingIncludes: {
    "/legal/[slug]": ["./legal/**/*.md"],
  },
  serverExternalPackages: ["@imgly/background-removal", "onnxruntime-web"],
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      if (Array.isArray(config.externals)) {
        config.externals.push("@imgly/background-removal", "onnxruntime-web")
      }
    }
    return config
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 3600,
    remotePatterns: [
      { protocol: "https", hostname: "m.media-amazon.com", pathname: "/**" },
      { protocol: "https", hostname: "images-na.ssl-images-amazon.com", pathname: "/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com", pathname: "/**" },
      { protocol: "https", hostname: "**.amazonaws.com", pathname: "/**" },
      { protocol: "https", hostname: "**.cloudfront.net", pathname: "/**" },
      { protocol: "https", hostname: "cdn.shopify.com", pathname: "/**" },
      { protocol: "https", hostname: "**.myshopify.com", pathname: "/**" },
      { protocol: "https", hostname: "**.supabase.co", pathname: "/**" },
      { protocol: "https", hostname: "api.qrserver.com", pathname: "/**" },
    ],
  },
}

const authToken = process.env.SENTRY_AUTH_TOKEN?.trim()
const org = process.env.SENTRY_ORG?.trim()
const project = process.env.SENTRY_PROJECT?.trim()
const hasUploadCredentials = Boolean(authToken && org && project)

/**
 * @sentry/nextjs v10 — there is no `hideSourceMaps` option. Maps are not served publicly when
 * `sourcemaps.deleteSourcemapsAfterUpload` is true (Sentry enables this for Turbopack by default).
 *
 * `release.setCommits` / `deploy` must be literal `false`: @sentry/bundler-plugin-core otherwise
 * auto-fills setCommits on Vercel (VERCEL_GIT_*), which spams errors in build logs when the repo
 * is not linked in Sentry. Next’s exported types omit `false`; the bundler accepts it.
 */
export default withSentryConfig(withNextIntl(nextConfig), {
  ...(hasUploadCredentials
    ? {
        authToken,
        org,
        project,
        silent: false,
        /** Verbose Sentry bundler logs (upload paths, CLI, etc.) */
        debug: true,
        widenClientFileUpload: true,
        sourcemaps: {
          deleteSourcemapsAfterUpload: true,
        },
        release: {
          setCommits: false,
          deploy: false,
        } as unknown as import("@sentry/nextjs").SentryBuildOptions["release"],
      }
    : {
        silent: false,
        sourcemaps: { disable: true },
        webpack: {
          unstable_sentryWebpackPluginOptions: { disable: true },
        },
      }),
  errorHandler(err: Error) {
    console.warn(
      "[@sentry/nextjs] Build-time Sentry step failed (deployment continues):",
      err.message,
    )
  },
})
