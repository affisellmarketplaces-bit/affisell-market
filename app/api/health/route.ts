import { NextResponse } from "next/server"

import { isLocalhostUrl } from "@/lib/site-url"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Lightweight probe for UptimeRobot / Vercel (no Prisma).
 * Always returns JSON (never throws) so uptime ≠ env misconfig.
 * Production: flags NEXT_PUBLIC_APP_URL if unset / localhost.
 */
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || null
  const vercelEnv = process.env.VERCEL_ENV || "local"
  const isProd =
    vercelEnv === "production" ||
    (process.env.NODE_ENV === "production" && process.env.VERCEL === "1")

  const urlOk = Boolean(appUrl) && !isLocalhostUrl(appUrl)
  const appUrlMisconfigured = isProd && !urlOk

  if (appUrlMisconfigured) {
    console.log("[health]", {
      result: "misconfigured_app_url",
      url: appUrl ?? "(unset)",
      vercel: vercelEnv,
    })
  }

  return NextResponse.json(
    {
      status: appUrlMisconfigured ? "degraded" : "ok",
      timestamp: new Date().toISOString(),
      url: appUrl,
      urlOk,
      env: process.env.NODE_ENV,
      vercel: vercelEnv,
      ...(appUrlMisconfigured
        ? {
            error:
              "NEXT_PUBLIC_APP_URL must be the public origin in production (e.g. https://affisell.com)",
          }
        : {}),
    },
    // App process is up → 200 for UptimeRobot. Env misconfig is surfaced in body.
    { status: 200 }
  )
}
