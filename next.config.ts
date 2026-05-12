import { withSentryConfig } from "@sentry/nextjs"

const nextConfig = {
  output: "standalone" as const,
}

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
})
