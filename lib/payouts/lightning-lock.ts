/**
 * Temporary lock on Lightning payouts (2026-11-25).
 *
 * Why: before the A3 hotfix is deployed AND verified in production, Lightning could pay a supplier
 * leg a second time. Production was neutralised by setting `lightningEnabled = false` on the only
 * supplier that had it, but the code still let the supplier (`PATCH /api/supplier/lightning-payout`,
 * trust score >= 50) or an admin (`PATCH /api/admin/suppliers/<id>/lightning`) switch it back on.
 *
 * Rule: `LIGHTNING_PAYOUTS_MODE` = `locked` (DEFAULT, also any other value) | `enabled` — EXACTLY that word: no
 * trimming, no case folding, so `Enabled`, ` enabled` or a trailing newline (`echo enabled | vercel env add`) stay
 * locked (fail closed). Read per
 * call (flip it on Vercel, no code change). While locked:
 *   - nobody can switch Lightning ON (supplier or admin, server side): 409 `lightning_locked`;
 *     switching it OFF is always allowed;
 *   - `triggerLightningPayout` pays nothing (`lightning_locked`) even if a row says `true`
 *     (raw SQL, a script, an older deployment): the order is paid by the normal
 *     `process-transfers` flow instead, like any non-Lightning order.
 * Unlock (`enabled`) only after the A3 hotfix is deployed and verified in production — founder
 * decision. Pure module (no Prisma): safe in pages and client-shared code.
 */

export const LIGHTNING_PAYOUTS_MODE_ENV = "LIGHTNING_PAYOUTS_MODE"

export const LIGHTNING_LOCKED_ERROR = "lightning_locked" as const

export const LIGHTNING_LOCKED_MESSAGE =
  "Lightning Payout est temporairement suspendu par Affisell le temps d'un correctif de sécurité des " +
  "paiements. Vos reversements continuent normalement, selon le calendrier standard."

export function isLightningLocked(env: Record<string, string | undefined> = process.env): boolean {
  return env[LIGHTNING_PAYOUTS_MODE_ENV] !== "enabled"
}

/** Decision for a request that wants to set `lightningEnabled` to `requested`. */
export function lightningToggleDecision(
  requested: boolean,
  env: Record<string, string | undefined> = process.env
): { allowed: true } | { allowed: false; error: typeof LIGHTNING_LOCKED_ERROR; message: string } {
  if (requested && isLightningLocked(env)) {
    return { allowed: false, error: LIGHTNING_LOCKED_ERROR, message: LIGHTNING_LOCKED_MESSAGE }
  }
  return { allowed: true }
}
