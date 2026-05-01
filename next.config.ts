import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const nextConfig = {
  turbopack: {
    root: __dirname,
  },
} satisfies NextConfig

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

export default withNextIntl(nextConfig)
