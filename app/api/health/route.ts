import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Lightweight probe for Vercel / uptime checks (no Prisma). */
export async function GET() {
  const hasDb = Boolean(process.env.DATABASE_URL?.trim())
  const hasAuth = Boolean(
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
  )

  return NextResponse.json({
    ok: hasDb && hasAuth,
    checks: { databaseUrl: hasDb, authSecret: hasAuth },
    runtime: process.env.VERCEL ? "vercel" : "node",
  })
}
