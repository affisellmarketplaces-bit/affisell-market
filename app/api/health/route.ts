import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isLocalhostAppUrl(url: string | undefined): boolean {
  const raw = url?.trim() ?? ""
  if (!raw) return true
  try {
    const host = new URL(raw).hostname.toLowerCase()
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1"
  } catch {
    return /localhost|127\.0\.0\.1/i.test(raw)
  }
}

/**
 * Lightweight probe for UptimeRobot / Vercel (no Prisma).
 * Production: NEXT_PUBLIC_APP_URL must not point at localhost.
 */
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const vercelEnv = process.env.VERCEL_ENV || "local"
  const isProd =
    vercelEnv === "production" ||
    (process.env.NODE_ENV === "production" && process.env.VERCEL === "1")

  if (isProd && isLocalhostAppUrl(appUrl)) {
    console.log("[health]", {
      result: "misconfigured_app_url",
      url: appUrl ?? "(unset)",
      vercel: vercelEnv,
    })
    throw new Error(
      "NEXT_PUBLIC_APP_URL must not be localhost in production (UptimeRobot / checkout base URL)"
    )
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    url: appUrl,
    env: process.env.NODE_ENV,
    vercel: vercelEnv,
  })
}
