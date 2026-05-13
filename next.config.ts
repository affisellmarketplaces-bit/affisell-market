import { withSentryConfig } from "@sentry/nextjs"

const nextConfig = {
  output: "standalone" as const,
  /** Client bundles emit source maps for Sentry (Turbopack + runAfterProductionCompile upload). */
  productionBrowserSourceMaps: true,
}

const authToken = process.env.SENTRY_AUTH_TOKEN?.trim()
const org = process.env.SENTRY_ORG?.trim()
const project = process.env.SENTRY_PROJECT?.trim()
const hasUploadCredentials = Boolean(authToken && org && project)

/**
 * @sentry/nextjs v10 — there is no `hideSourceMaps` option. Maps are not served publicly when
 * `sourcemaps.deleteSourcemapsAfterUpload` is true (Sentry enables this for Turbopack by default).
 */
export default withSentryConfig(nextConfig, {
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
