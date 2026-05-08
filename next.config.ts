import type { NextConfig } from "next"

const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  output: "standalone",
  experimental: {
    missingSuspenseWithCSRBailout: false,
  } as any,
} satisfies NextConfig

export default nextConfig
