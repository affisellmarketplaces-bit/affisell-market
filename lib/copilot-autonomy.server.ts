import "server-only"

import { randomUUID } from "node:crypto"

import { Prisma } from "@prisma/client"

import { COPILOT_APPLY_ACTION, COPILOT_UNDO_ACTION } from "@/lib/copilot-audit-actions"

import {
  decideAutoApply,
  isAutoEligibleType,
  type AutoDecision,
  type AutoEligibleType,
  type AutonomyRule,
  type RecentAutoAction,
} from "@/lib/copilot-autonomy"
import { prisma } from "@/lib/prisma"
import { applyCopilotAction, loadResellerActionPlan } from "@/lib/reseller-action-plan.server"

/**
 * Storage of autonomy grants (table `ResellerAutonomyRule`, migration 20261126100000) through plain SQL: the table is
 * isolated and new, so a database that is not migrated yet simply means "no automation" (never a crash, never an
 * implicit permission). Every grant and revocation is also written to AuditLog with the exact limits.
 */
export const AUTONOMY_GRANT_ACTION = "copilot.autonomy.grant"
export const AUTONOMY_REVOKE_ACTION = "copilot.autonomy.revoke"
export const AUTO_RUN_WINDOW_MS = 7 * 86_400_000

function isMissingTable(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2021") return true
    const meta = e.meta as { code?: string } | undefined
    if (e.code === "P2010" && meta?.code === "42P01") return true
  }
  return /relation "ResellerAutonomyRule" does not exist/i.test(e instanceof Error ? e.message : String(e))
}

type RuleRow = {
  actionType: string
  maxPriceIncreaseBps: number
  maxRunsPerWeek: number
  grantedAt: Date
  revokedAt: Date | null
}

const toRule = (r: RuleRow): AutonomyRule | null =>
  isAutoEligibleType(r.actionType)
    ? {
        actionType: r.actionType,
        maxPriceIncreaseBps: r.maxPriceIncreaseBps,
        maxRunsPerWeek: r.maxRunsPerWeek,
        grantedAt: r.grantedAt.toISOString(),
        revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
      }
    : null

/** Active and revoked grants of a reseller. `available: false` = table not migrated → no automation anywhere. */
export async function listAutonomyRules(affiliateId: string): Promise<{ rules: AutonomyRule[]; available: boolean }> {
  try {
    const rows = await prisma.$queryRaw<RuleRow[]>`
      SELECT "actionType", "maxPriceIncreaseBps", "maxRunsPerWeek", "grantedAt", "revokedAt"
      FROM "ResellerAutonomyRule" WHERE "affiliateId" = ${affiliateId}
      ORDER BY "actionType"`
    return { rules: rows.flatMap((r) => toRule(r) ?? []), available: true }
  } catch (e) {
    if (!isMissingTable(e)) console.error("[copilot-autonomy] read failed", e instanceof Error ? e.message : e)
    return { rules: [], available: false }
  }
}

/** Grant (or re-grant with new limits) ONE action type. Recorded in AuditLog with the limits the reseller saw. */
export async function grantAutonomy(args: {
  affiliateId: string
  rule: Pick<AutonomyRule, "actionType" | "maxPriceIncreaseBps" | "maxRunsPerWeek">
}): Promise<{ ok: true } | { ok: false; reason: "unavailable" | "failed" }> {
  const { actionType, maxPriceIncreaseBps, maxRunsPerWeek } = args.rule
  try {
    // Grant + its audit trail in ONE transaction: a grant that could not be recorded does not exist.
    await prisma.$transaction([
      prisma.$executeRaw`
      INSERT INTO "ResellerAutonomyRule"
        ("id", "affiliateId", "actionType", "maxPriceIncreaseBps", "maxRunsPerWeek", "grantedAt", "revokedAt", "updatedAt")
      VALUES (${randomUUID()}, ${args.affiliateId}, ${actionType}, ${maxPriceIncreaseBps}, ${maxRunsPerWeek}, NOW(), NULL, NOW())
      ON CONFLICT ("affiliateId", "actionType") DO UPDATE SET
        "maxPriceIncreaseBps" = EXCLUDED."maxPriceIncreaseBps",
        "maxRunsPerWeek" = EXCLUDED."maxRunsPerWeek",
        "grantedAt" = NOW(),
        "revokedAt" = NULL,
        -- Re-granting (or changing the cap) never touches the runs already used in the current window: lowering then
        -- raising the cap must not refill the quota. "autoRunsInWindow" / "autoRunsWindowStart" are deliberately left out.
        "updatedAt" = NOW()`,
      prisma.auditLog.create({
        data: {
          action: AUTONOMY_GRANT_ACTION,
          entityType: "ResellerAutonomyRule",
          entityId: `${args.affiliateId}:${actionType}`,
          actorId: args.affiliateId,
          payload: { actionType, maxPriceIncreaseBps, maxRunsPerWeek },
        },
      }),
    ])
    return { ok: true }
  } catch (e) {
    if (isMissingTable(e)) return { ok: false, reason: "unavailable" }
    console.error("[copilot-autonomy] grant failed", e instanceof Error ? e.message : e)
    return { ok: false, reason: "failed" }
  }
}

export async function revokeAutonomy(args: {
  affiliateId: string
  actionType: AutoEligibleType
}): Promise<{ ok: true } | { ok: false; reason: "unavailable" | "failed" }> {
  try {
    await prisma.$transaction([
      prisma.$executeRaw`
      UPDATE "ResellerAutonomyRule" SET "revokedAt" = NOW(), "updatedAt" = NOW()
      WHERE "affiliateId" = ${args.affiliateId} AND "actionType" = ${args.actionType} AND "revokedAt" IS NULL`,
      prisma.auditLog.create({
        data: {
          action: AUTONOMY_REVOKE_ACTION,
          entityType: "ResellerAutonomyRule",
          entityId: `${args.affiliateId}:${args.actionType}`,
          actorId: args.affiliateId,
          payload: { actionType: args.actionType },
        },
      }),
    ])
    return { ok: true }
  } catch (e) {
    if (isMissingTable(e)) return { ok: false, reason: "unavailable" }
    console.error("[copilot-autonomy] revoke failed", e instanceof Error ? e.message : e)
    return { ok: false, reason: "failed" }
  }
}

/**
 * The copilot's OWN actions of the last 7 days that are not undone yet — what the reseller is told it can undo
 * « from the hub ». Each row is undone through the same guarded path as a click (`undoCopilotAction`: 7 days, listing
 * unchanged since, identity check to relist). Read-only, never throws.
 */
export async function listRecentAutoActions(affiliateId: string, now: Date = new Date()): Promise<RecentAutoAction[]> {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: COPILOT_APPLY_ACTION,
        actorId: affiliateId,
        createdAt: { gte: new Date(now.getTime() - AUTO_RUN_WINDOW_MS) },
        payload: { path: ["source"], equals: "auto" },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, entityId: true, payload: true, createdAt: true },
    })
    if (logs.length === 0) return []
    const undone = await prisma.auditLog.findMany({
      where: {
        action: COPILOT_UNDO_ACTION,
        actorId: affiliateId,
        createdAt: { gte: logs[logs.length - 1]!.createdAt },
      },
      select: { payload: true },
    })
    const undoneIds = new Set(undone.map((u) => (u.payload as { undoOf?: string } | null)?.undoOf).filter(Boolean))
    const open = logs.filter((l) => l.entityId && !undoneIds.has(l.id))
    const listings = await prisma.affiliateProduct.findMany({
      where: { id: { in: open.map((l) => l.entityId!) }, affiliateId },
      select: { id: true, product: { select: { name: true } } },
    })
    const names = new Map(listings.map((l) => [l.id, l.product?.name ?? ""]))
    return open.flatMap((l) => {
      const type = (l.payload as { type?: string } | null)?.type
      if (!isAutoEligibleType(type ?? null) || !names.has(l.entityId!)) return []
      return [
        {
          auditId: l.id,
          type: type as AutoEligibleType,
          listingId: l.entityId!,
          name: names.get(l.entityId!)!,
          appliedAt: l.createdAt.toISOString(),
        },
      ]
    })
  } catch (e) {
    console.warn("[copilot-autonomy] recent auto actions unavailable", e instanceof Error ? e.message : e)
    return []
  }
}

/** Kill switch: automation never runs unless COPILOT_AUTOPILOT=on (default off — merging and deploying changes nothing). */
export function isAutopilotEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.COPILOT_AUTOPILOT === "on"
}

type ReservedRow = { maxPriceIncreaseBps: number; maxRunsPerWeek: number; grantedAt: Date; autoRunsInWindow: number }

/**
 * Reserve ONE run of `type` for this reseller, atomically. A single conditional UPDATE (row-locked) checks, at the
 * moment of use, that the grant is still active and the window quota not reached, consumes the slot, and returns the
 * limits IN FORCE NOW. Two concurrent cron runs serialise on the row lock: they can never both take the last slot, a
 * grant revoked a second ago is never used, and a tightened limit applies immediately. `null` = no slot.
 */
export async function reserveAutoRun(affiliateId: string, type: AutoEligibleType): Promise<AutonomyRule | null> {
  const rows = await prisma.$queryRaw<ReservedRow[]>`
    UPDATE "ResellerAutonomyRule" SET
      "autoRunsInWindow" = CASE
        WHEN "autoRunsWindowStart" IS NULL OR "autoRunsWindowStart" <= NOW() - INTERVAL '7 days' THEN 1
        ELSE "autoRunsInWindow" + 1 END,
      "autoRunsWindowStart" = CASE
        WHEN "autoRunsWindowStart" IS NULL OR "autoRunsWindowStart" <= NOW() - INTERVAL '7 days' THEN NOW()
        ELSE "autoRunsWindowStart" END,
      "updatedAt" = NOW()
    WHERE "affiliateId" = ${affiliateId} AND "actionType" = ${type} AND "revokedAt" IS NULL
      AND ("autoRunsWindowStart" IS NULL OR "autoRunsWindowStart" <= NOW() - INTERVAL '7 days'
           OR "autoRunsInWindow" < "maxRunsPerWeek")
    RETURNING "maxPriceIncreaseBps", "maxRunsPerWeek", "grantedAt", "autoRunsInWindow"`
  const r = rows[0]
  if (!r) return null
  return {
    actionType: type,
    maxPriceIncreaseBps: r.maxPriceIncreaseBps,
    maxRunsPerWeek: r.maxRunsPerWeek,
    grantedAt: r.grantedAt.toISOString(),
    revokedAt: null,
  }
}

/** Give back a reserved slot that was not used (limit exceeded or apply refused). Never throws. */
async function releaseAutoRun(affiliateId: string, type: AutoEligibleType): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "ResellerAutonomyRule" SET "autoRunsInWindow" = GREATEST(0, "autoRunsInWindow" - 1), "updatedAt" = NOW()
    WHERE "affiliateId" = ${affiliateId} AND "actionType" = ${type}`.catch(() => undefined)
}

export type AutopilotReport = {
  affiliateId: string
  applied: Array<{ actionId: string; auditId: string }>
  skipped: Array<{ actionId: string; reason: Exclude<AutoDecision, { allowed: true }>["reason"] | "apply_failed" }>
}

/**
 * Apply, for ONE reseller, the planned actions their grants allow — each within its limits, each through the same
 * guarded path as a click (recomputed, conditional write, AuditLog `source: "auto"`, undoable 7 days), and each
 * notified to the reseller. Never throws.
 */
export async function runAutopilotForReseller(affiliateId: string, now: Date = new Date()): Promise<AutopilotReport> {
  const report: AutopilotReport = { affiliateId, applied: [], skipped: [] }
  try {
    const { rules } = await listAutonomyRules(affiliateId)
    const active = new Map(rules.filter((r) => !r.revokedAt).map((r) => [r.actionType, r]))
    if (active.size === 0) return report
    const plan = await loadResellerActionPlan(affiliateId, now)
    for (const action of plan.actions) {
      const type = action.type
      if (!isAutoEligibleType(type) || !active.has(type)) continue
      // Cheap pre-check with the rule read at the start (no slot taken for an action that cannot pass anyway).
      const pre = decideAutoApply({ action, rule: active.get(type), runsLast7Days: 0 })
      if (!pre.allowed) {
        report.skipped.push({ actionId: action.id, reason: pre.reason })
        continue
      }
      // Authoritative check at the moment of use: grant still active, quota slot taken atomically, CURRENT limits.
      const rule = await reserveAutoRun(affiliateId, type)
      if (!rule) {
        report.skipped.push({ actionId: action.id, reason: "weekly_limit" })
        continue
      }
      const decision = decideAutoApply({ action, rule, runsLast7Days: 0 })
      if (!decision.allowed) {
        await releaseAutoRun(affiliateId, type)
        report.skipped.push({ actionId: action.id, reason: decision.reason })
        continue
      }
      // The apply recomputes the plan; it writes only if it suggests EXACTLY the price checked against the limit.
      const r = await applyCopilotAction({
        affiliateId,
        actionId: action.id,
        source: "auto",
        expectedSuggestedPriceCents: type === "reprice" ? (action.suggestedPriceCents ?? null) : undefined,
      })
      if (!r.ok) {
        await releaseAutoRun(affiliateId, type)
        report.skipped.push({ actionId: action.id, reason: "apply_failed" })
        continue
      }
      report.applied.push({ actionId: action.id, auditId: r.auditId })
      await prisma.notification
        .create({
          data: {
            userId: affiliateId,
            type: "COPILOT_AUTO_ACTION",
            message:
              action.type === "reprice"
                ? `Copilote : prix de « ${action.name} » ajusté automatiquement (règle que vous avez autorisée). Annulable 7 jours depuis votre hub.`
                : `Copilote : marges de « ${action.name} » rétablies automatiquement (règle que vous avez autorisée). Annulable 7 jours depuis votre hub.`,
          },
        })
        .catch(() => undefined)
    }
  } catch (e) {
    console.error("[copilot-autonomy] autopilot failed", { affiliateId, error: e instanceof Error ? e.message : e })
  }
  console.log("[copilot-autonomy]", { affiliateId, applied: report.applied.length, skipped: report.skipped.length })
  return report
}

/** Cron entry: every reseller with at least one active grant, bounded batch. Off unless COPILOT_AUTOPILOT=on. */
export async function runAutopilot(args: { env?: Record<string, string | undefined>; limit?: number } = {}): Promise<{
  enabled: boolean
  resellers: number
  applied: number
}> {
  if (!isAutopilotEnabled(args.env)) return { enabled: false, resellers: 0, applied: 0 }
  // Keyset pagination over EVERY reseller with an active grant (pages of `limit`): nobody past the first page is ever
  // left out, and a reseller granted during the run is picked up if their id sorts after the cursor.
  const pageSize = Math.min(500, Math.max(1, args.limit ?? 200))
  let cursor = ""
  let resellers = 0
  let applied = 0
  for (;;) {
    let ids: string[]
    try {
      const rows = await prisma.$queryRaw<Array<{ affiliateId: string }>>`
        SELECT DISTINCT "affiliateId" FROM "ResellerAutonomyRule"
        WHERE "revokedAt" IS NULL AND "affiliateId" > ${cursor}
        ORDER BY "affiliateId" LIMIT ${pageSize}`
      ids = rows.map((r) => r.affiliateId)
    } catch (e) {
      if (!isMissingTable(e)) console.error("[copilot-autonomy] list failed", e instanceof Error ? e.message : e)
      break
    }
    for (const id of ids) applied += (await runAutopilotForReseller(id)).applied.length
    resellers += ids.length
    if (ids.length < pageSize) break
    cursor = ids[ids.length - 1]!
  }
  return { enabled: true, resellers, applied }
}
