/**
 * Mutates the demo affiliate's Radar plan for tests that need the paid view.
 *
 * Runs in the Playwright test-runner process, which is separate from the webServer
 * subprocess (see playwright.config.ts) — it does NOT inherit that subprocess's env swap,
 * so this explicitly forces the same DATABASE_URL_STAGING connection itself. It refuses to
 * run (never mutates anything) if staging isn't configured, rather than risk writing to the
 * production-facing database.
 *
 * Uses `@prisma/client` directly (not `lib/prisma.ts`, the app's aliased wrapper) — Playwright's
 * CJS transform for `.ts` test files can't resolve this project's `@/` path aliases or the
 * wrapper's transitive ESM-only deps. A plain `PrismaClient` pointed at an explicit URL sidesteps
 * all of that.
 */
import { resolve } from "node:path"

import { PrismaClient } from "@prisma/client"
import { config as loadDotenv } from "dotenv"

import { DEMO_LAB_EMAIL_BY_PERSONA } from "../../lib/demo/demo-accounts-shared"
import type { RadarPlanId } from "../../lib/radar/plans"

let stagingUrl: string | null = null

function resolveStagingUrl(): string | null {
  if (stagingUrl !== null) return stagingUrl || null

  for (const name of [".env", ".env.local"]) {
    loadDotenv({ path: resolve(process.cwd(), name), override: name === ".env.local" })
  }

  stagingUrl = process.env.DATABASE_URL_STAGING?.trim() ?? ""
  return stagingUrl || null
}

export function radarPlanE2EConfigured(): boolean {
  return resolveStagingUrl() !== null
}

/**
 * Sets the demo affiliate's `radarPlan`, runs `fn`, then restores the original value —
 * even if `fn` throws. Throws if DATABASE_URL_STAGING isn't configured; callers should
 * gate on {@link radarPlanE2EConfigured} first (e.g. via `test.skip`).
 */
export async function withDemoAffiliateRadarPlan<T>(
  plan: RadarPlanId,
  fn: () => Promise<T>
): Promise<T> {
  const url = resolveStagingUrl()
  if (!url) {
    throw new Error("DATABASE_URL_STAGING not configured — refusing to mutate the radar plan")
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } })
  try {
    const user = await prisma.user.findUnique({
      where: { email: DEMO_LAB_EMAIL_BY_PERSONA.affiliate },
      select: { id: true, radarPlan: true },
    })
    if (!user) {
      throw new Error(`Demo affiliate (${DEMO_LAB_EMAIL_BY_PERSONA.affiliate}) not found on staging DB`)
    }

    const original = user.radarPlan
    await prisma.user.update({ where: { id: user.id }, data: { radarPlan: plan } })
    try {
      return await fn()
    } finally {
      await prisma.user.update({ where: { id: user.id }, data: { radarPlan: original } })
    }
  } finally {
    await prisma.$disconnect()
  }
}
