import { withSentryConfig } from "@sentry/nextjs"
import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const nextConfig: NextConfig = {
  output: "standalone" as const,
  /** Client bundles emit source maps for Sentry (Turbopack + runAfterProductionCompile upload). */
  productionBrowserSourceMaps: true,
  /** Keep WASM/ONNX browser stacks out of serverless traces (photo-studio is client-only). */
  outputFileTracingExcludes: {
    "*": [
      "node_modules/onnxruntime-web/**",
      "node_modules/@imgly/background-removal/**",
    ],
  },
  serverExternalPackages: ["@imgly/background-removal", "onnxruntime-web"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      if (Array.isArray(config.externals)) {
        config.externals.push("@imgly/background-removal", "onnxruntime-web")
      }
    }
    return config
  },
  images: {
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
