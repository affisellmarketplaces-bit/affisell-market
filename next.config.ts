import type { NextConfig } from "next"

const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  output: "standalone",
} satisfies NextConfig

export default nextConfig
