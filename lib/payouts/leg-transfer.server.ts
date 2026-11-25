import "server-only"

import { randomUUID } from "node:crypto"

import type { Prisma, PrismaClient } from "@prisma/client"

import {
  buildLegTransferRequest,
  classifyCreateError,
  decideClaim,
  economicParamsHash,
  errorCodeOf,
  errorMessageOf,
  judgeSearch,
  legIdempotencyKey,
  normalizeEconomicParams,
  PAYOUT_LEG_CONFIRM_SAFETY_MS,
  PAYOUT_LEG_LEASE_MS,
  PAYOUT_LEG_SEARCH_MAX_PAGES,
  validateEconomicParams,
  type LegacyEvidence,
  type LegEconomicParams,
  type LegOutcome,
  type LegTransferRequest,
  type PayoutLegKind,
  type PayoutLegRail,
  type PayoutLegRole,
  type PayoutLegState,
  type SearchVerdict,
  type StripeTransferView,
} from "@/lib/payouts/leg-model"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"

/**
 * THE ONLY PLACE IN AFFISELL THAT CREATES A STRIPE TRANSFER (pinned by `payout-leg-single-entry.test.ts`).
 *
 * executeLegTransfer = claim → search → create → record, for ONE leg:
 *  1. CLAIM, in a transaction holding the leg's row lock (`SELECT … FOR UPDATE`): the row is created if missing
 *     (`INSERT … ON CONFLICT DO NOTHING`), legacy evidence is read, and `decideClaim` decides. Only a PENDING leg (or a
 *     FAILED_CONFIRMED one, under a new generation) becomes PROCESSING; its Stripe request is frozen in the row. Two
 *     workers — of the same rail or of two rails — serialise on the lock: the second sees PROCESSING and gets `busy`.
 *  2. SEARCH Stripe (`GET /v1/transfers?transfer_group=`) before every creation: a transfer of this leg found there is
 *     ADOPTED (no creation); a duplicate, a mismatch or an unidentified transfer is a doubt; an incomplete read
 *     releases the claim (nothing was created) and creates nothing.
 *  3. CREATE with the leg's stable idempotency key and its frozen request, replayed byte for byte by every rail.
 *  4. RECORD the transfer (state PAID + the caller's own records via `onPaid`) in ONE transaction, guarded by the claim
 *     token. Any error that does not PROVE nothing was created ends IN_DOUBT: no automatic creation until a
 *     reconciliation adopts the transfer or a person confirms, after a complete search, that none exists.
 *
 * Why the search: Stripe forgets an idempotency key after ~24 h. Within 24 h the key protects a replay; after 24 h the
 * transfer is long visible in the list endpoint, which the search reads. Neither alone covers both windows.
 */

export type LegDb = PrismaClient

export type LegStripe = {
  createTransfer(request: LegTransferRequest, idempotencyKey: string): Promise<{ id: string }>
  listTransfersByGroup(
    transferGroup: string,
    startingAfter?: string
  ): Promise<{ data: StripeTransferView[]; has_more: boolean }>
}

export function defaultLegStripe(): LegStripe {
  const stripe = getStripeClient()
  return {
    async createTransfer(request, idempotencyKey) {
      const t = await stripe.transfers.create(request, { idempotencyKey })
      return { id: t.id }
    },
    async listTransfersByGroup(transferGroup, startingAfter) {
      const page = await stripe.transfers.list({
        transfer_group: transferGroup,
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      })
      return {
        has_more: page.has_more,
        data: page.data.map((t) => ({
          id: t.id,
          amount: t.amount,
          currency: t.currency,
          destination: typeof t.destination === "string" ? t.destination : (t.destination?.id ?? null),
          transfer_group: t.transfer_group ?? null,
          metadata: (t.metadata ?? {}) as Record<string, string>,
          created: t.created,
        })),
      }
    },
  }
}

export type LegPaidRecord = {
  legKey: string
  stripeTransferId: string
  amountCents: number
  destination: string
  paidAt: Date
  rail: PayoutLegRail
  /** True when the transfer was found in Stripe (a lost response) instead of created by this call. */
  adopted: boolean
}

export type ExecuteLegInput = {
  legKey: string
  kind: PayoutLegKind
  role: PayoutLegRole
  rail: PayoutLegRail
  orderId: string | null
  transferGroup: string
  params: LegEconomicParams
  description?: string | null
  extraMetadata?: Record<string, string>
  /** Written in the SAME transaction that marks the leg PAID (attempt row, ledger, order flags…). */
  onPaid?: (tx: Prisma.TransactionClient, paid: LegPaidRecord) => Promise<void>
  deps?: LegDeps
}

export type LegDeps = {
  db?: LegDb
  stripe?: LegStripe
  now?: () => Date
  leaseMs?: number
  confirmSafetyMs?: number
}

type LegRow = {
  id: string
  legKey: string
  kind: string
  orderId: string | null
  role: string
  state: PayoutLegState
  generation: number
  transferGroup: string
  idempotencyKey: string | null
  amountCents: number | null
  currency: string | null
  destination: string | null
  paramsHash: string | null
  params: unknown
  stripeTransferId: string | null
  adopted: boolean
  claimToken: string | null
  claimedAt: Date | null
  inDoubtReason: string | null
  inDoubtAt: Date | null
}

async function lockLeg(tx: Prisma.TransactionClient, legKey: string): Promise<LegRow | null> {
  const rows = await tx.$queryRaw<LegRow[]>`
    SELECT "id", "legKey", "kind", "orderId", "role", "state", "generation", "transferGroup", "idempotencyKey",
           "amountCents", "currency", "destination", "paramsHash", "params", "stripeTransferId", "adopted",
           "claimToken", "claimedAt", "inDoubtReason", "inDoubtAt"
    FROM "PayoutLeg" WHERE "legKey" = ${legKey} FOR UPDATE`
  return rows[0] ?? null
}

/**
 * What the order already says about this leg OUTSIDE the registry — rows written by the rails before the registry
 * existed. A recorded transfer id is adopted; a trace of payment without a usable id is a doubt (never a creation).
 */
export async function orderLegacyEvidence(
  tx: Prisma.TransactionClient,
  orderId: string,
  role: PayoutLegRole
): Promise<LegacyEvidence> {
  if (role === "SUPPLIER" || role === "AFFILIATE") {
    const attempt = await tx.transferAttempt.findUnique({
      where: { orderId_role: { orderId, role } },
      select: { status: true, stripeTransferId: true },
    })
    if (attempt?.status === "SUCCESS") {
      return attempt.stripeTransferId?.trim()
        ? { kind: "paid", stripeTransferId: attempt.stripeTransferId.trim(), source: "transfer_attempt" }
        : { kind: "doubt", reason: "legacy_success_without_transfer_id" }
    }
    const ledger = await tx.merchantPayoutLedger.findFirst({
      where: {
        orderId,
        beneficiaryRole: role,
        entryType: "PAYOUT",
        blindDropshipOrderId: null,
        stripeTransferId: { not: null },
      },
      select: { stripeTransferId: true },
    })
    if (ledger?.stripeTransferId) {
      return { kind: "paid", stripeTransferId: ledger.stripeTransferId, source: "payout_ledger" }
    }
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { stripeTransferId: true, payoutTransferIds: true, payoutStatus: true },
    })
    if (role === "SUPPLIER" && order?.stripeTransferId?.trim()) {
      return { kind: "doubt", reason: "legacy_order_transfer_reference" }
    }
    if (Array.isArray(order?.payoutTransferIds) && order.payoutTransferIds.length > 0) {
      return { kind: "doubt", reason: "legacy_payout_transfer_ids" }
    }
    if (order?.payoutStatus === "PAID") {
      return { kind: "doubt", reason: "legacy_order_marked_paid" }
    }
    return { kind: "none" }
  }
  if (role === "LEGION_SPONSOR") {
    const ledger = await tx.merchantPayoutLedger.findFirst({
      where: { orderId, entryType: "LEGION_OVERRIDE", stripeTransferId: { not: null } },
      select: { stripeTransferId: true },
    })
    if (ledger?.stripeTransferId) {
      return { kind: "paid", stripeTransferId: ledger.stripeTransferId, source: "payout_ledger" }
    }
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { legionPayoutStatus: true } })
    if (order?.legionPayoutStatus === "paid_24h") {
      return { kind: "doubt", reason: "legacy_legion_paid_without_ledger" }
    }
    return { kind: "none" }
  }
  return { kind: "none" }
}

type ClaimResult =
  | { done: LegOutcome }
  | { claimed: true; request: LegTransferRequest; idempotencyKey: string; generation: number; claimToken: string }

async function searchLeg(
  stripe: LegStripe,
  leg: { legKey: string; kind: PayoutLegKind; role: PayoutLegRole; orderId: string | null; transferGroup: string },
  expected: { amountCents: number; destination: string; currency: string }
): Promise<SearchVerdict> {
  const transfers: StripeTransferView[] = []
  let after: string | undefined
  let complete = false
  for (let page = 0; page < PAYOUT_LEG_SEARCH_MAX_PAGES; page += 1) {
    const res = await stripe.listTransfersByGroup(leg.transferGroup, after)
    transfers.push(...res.data)
    if (!res.has_more || res.data.length === 0) {
      complete = !res.has_more
      break
    }
    after = res.data[res.data.length - 1].id
  }
  return judgeSearch({ leg, expected, complete, transfers })
}

function logLeg(event: string, fields: Record<string, unknown>) {
  console.log("[payout-leg]", { event, ...fields })
}

/** Moves a PROCESSING leg we still hold to another state. Never throws: returns whether the claim was still ours. */
async function moveClaimed(
  db: LegDb,
  legKey: string,
  claimToken: string,
  data: Prisma.PayoutLegUpdateManyMutationInput
): Promise<boolean> {
  try {
    const res = await db.payoutLeg.updateMany({
      where: { legKey, state: "PROCESSING", claimToken },
      data,
    })
    return res.count === 1
  } catch (err) {
    logLeg("state_write_failed", { legKey, error: errorMessageOf(err) })
    return false
  }
}

export async function executeLegTransfer(input: ExecuteLegInput): Promise<LegOutcome> {
  const db = input.deps?.db ?? (prisma as unknown as LegDb)
  const now = input.deps?.now ?? (() => new Date())
  const leaseMs = input.deps?.leaseMs ?? PAYOUT_LEG_LEASE_MS

  const params = normalizeEconomicParams(input.params)
  const invalid = validateEconomicParams(params)
  if (invalid) return { outcome: "invalid_params", reason: invalid }
  const paramsHash = economicParamsHash(params)
  const claimToken = randomUUID()

  // ---- 1. claim ------------------------------------------------------------------------------------------------
  let claim: ClaimResult
  try {
    claim = await db.$transaction(async (tx) => {
      await tx.payoutLeg.createMany({
        data: [
          {
            legKey: input.legKey,
            kind: input.kind,
            orderId: input.orderId,
            role: input.role,
            state: "PENDING",
            transferGroup: input.transferGroup,
          },
        ],
        skipDuplicates: true,
      })
      const leg = await lockLeg(tx, input.legKey)
      if (!leg) throw new Error("payout_leg_row_missing_after_insert")
      if (leg.kind !== input.kind || leg.role !== input.role || leg.transferGroup !== input.transferGroup
        || (leg.orderId ?? null) !== (input.orderId ?? null)) {
        // Two callers disagree about what this leg IS: a programming error, never a payment.
        throw new Error("payout_leg_identity_mismatch")
      }

      const evidence: LegacyEvidence =
        leg.state !== "PAID" && input.kind === "order" && input.orderId
          ? await orderLegacyEvidence(tx, input.orderId, input.role)
          : { kind: "none" }

      const decision = decideClaim({
        leg: {
          state: leg.state,
          generation: leg.generation,
          paramsHash: leg.paramsHash,
          claimedAt: leg.claimedAt,
          stripeTransferId: leg.stripeTransferId,
        },
        evidence,
        paramsHash,
        now: now(),
        leaseMs,
      })

      switch (decision.action) {
        case "already_paid":
          return {
            done: {
              outcome: "already_paid",
              stripeTransferId: decision.stripeTransferId,
              amountCents: leg.amountCents,
              destination: leg.destination,
              adopted: leg.adopted,
            },
          } satisfies ClaimResult
        case "adopt_legacy": {
          await tx.payoutLeg.update({
            where: { legKey: input.legKey },
            data: {
              state: "PAID",
              stripeTransferId: decision.stripeTransferId,
              paidAt: now(),
              adopted: true,
              paidRail: "reconciliation",
              resolutionNote: `adopted from legacy evidence: ${decision.source}`,
            },
          })
          logLeg("adopted_legacy", { legKey: input.legKey, source: decision.source })
          // amount / destination unknown to the registry: the caller must NOT write new money records from them.
          return {
            done: {
              outcome: "already_paid",
              stripeTransferId: decision.stripeTransferId,
              amountCents: null,
              destination: null,
              adopted: true,
            },
          } satisfies ClaimResult
        }
        case "mark_in_doubt":
          await tx.payoutLeg.update({
            where: { legKey: input.legKey },
            data: { state: "IN_DOUBT", inDoubtReason: decision.reason, inDoubtAt: now() },
          })
          logLeg("in_doubt", { legKey: input.legKey, reason: decision.reason })
          return { done: { outcome: "in_doubt", reason: decision.reason } } satisfies ClaimResult
        case "in_doubt":
          return { done: { outcome: "in_doubt", reason: leg.inDoubtReason ?? "in_doubt" } } satisfies ClaimResult
        case "busy":
          return { done: { outcome: "busy" } } satisfies ClaimResult
        case "params_changed":
          await tx.payoutLeg.update({
            where: { legKey: input.legKey },
            data: { lastErrorCode: "params_changed", lastErrorMessage: `refused rail=${input.rail}` },
          })
          logLeg("params_changed", { legKey: input.legKey, rail: input.rail })
          return { done: { outcome: "params_changed" } } satisfies ClaimResult
        case "claim": {
          const generation = decision.generation
          const request: LegTransferRequest = decision.freezeParams
            ? buildLegTransferRequest({
                legKey: input.legKey,
                kind: input.kind,
                role: input.role,
                rail: input.rail,
                orderId: input.orderId,
                generation,
                transferGroup: input.transferGroup,
                params,
                description: input.description,
                extraMetadata: input.extraMetadata,
              })
            : (leg.params as LegTransferRequest)
          const idempotencyKey = decision.freezeParams
            ? legIdempotencyKey(input.legKey, generation)
            : (leg.idempotencyKey ?? legIdempotencyKey(input.legKey, generation))
          await tx.payoutLeg.update({
            where: { legKey: input.legKey },
            data: {
              state: "PROCESSING",
              generation,
              rail: input.rail,
              claimToken,
              claimedAt: now(),
              attemptCount: { increment: 1 },
              ...(decision.freezeParams
                ? {
                    params: request as unknown as Prisma.InputJsonValue,
                    paramsHash,
                    idempotencyKey,
                    amountCents: params.amountCents,
                    currency: params.currency,
                    destination: params.destination,
                  }
                : {}),
            },
          })
          return { claimed: true, request, idempotencyKey, generation, claimToken } satisfies ClaimResult
        }
      }
    })
  } catch (err) {
    // Nothing reached Stripe in this phase.
    logLeg("registry_unavailable", { legKey: input.legKey, error: errorMessageOf(err) })
    return { outcome: "registry_unavailable", reason: errorMessageOf(err).slice(0, 200) }
  }
  if ("done" in claim) return claim.done

  const { request, idempotencyKey, generation } = claim
  const stripe = input.deps?.stripe ?? defaultLegStripe()
  const expected = { amountCents: request.amount, destination: request.destination, currency: request.currency }

  const finalizePaid = async (stripeTransferId: string, adopted: boolean): Promise<LegOutcome> => {
    const paidAt = now()
    try {
      const ok = await db.$transaction(async (tx) => {
        const moved = await tx.payoutLeg.updateMany({
          where: { legKey: input.legKey, state: "PROCESSING", claimToken },
          data: {
            state: "PAID",
            stripeTransferId,
            paidAt,
            paidRail: adopted ? "reconciliation" : input.rail,
            adopted,
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        })
        if (moved.count !== 1) return false
        if (input.onPaid) {
          await input.onPaid(tx, {
            legKey: input.legKey,
            stripeTransferId,
            amountCents: request.amount,
            destination: request.destination,
            paidAt,
            rail: input.rail,
            adopted,
          })
        }
        return true
      })
      if (!ok) {
        logLeg("claim_lost_after_transfer", { legKey: input.legKey, stripeTransferId })
        return { outcome: "in_doubt", reason: "claim_lost_after_transfer" }
      }
      logLeg(adopted ? "adopted_from_stripe" : "paid", { legKey: input.legKey, stripeTransferId, generation })
      return {
        outcome: "paid",
        stripeTransferId,
        amountCents: request.amount,
        destination: request.destination,
        generation,
      }
    } catch (err) {
      // The transfer exists but could not be recorded: never let it be created again.
      await moveClaimed(db, input.legKey, claimToken, {
        state: "IN_DOUBT",
        inDoubtReason: "record_failed_after_transfer",
        inDoubtAt: now(),
        lastErrorCode: "record_failed",
        lastErrorMessage: `transfer ${stripeTransferId} exists; record failed: ${errorMessageOf(err)}`.slice(0, 1000),
      })
      logLeg("record_failed", { legKey: input.legKey, stripeTransferId, error: errorMessageOf(err) })
      return { outcome: "in_doubt", reason: "record_failed_after_transfer" }
    }
  }

  // ---- 2. search -----------------------------------------------------------------------------------------------
  let verdict: SearchVerdict
  try {
    verdict = await searchLeg(
      stripe,
      {
        legKey: input.legKey,
        kind: input.kind,
        role: input.role,
        orderId: input.orderId,
        transferGroup: input.transferGroup,
      },
      expected
    )
  } catch (err) {
    verdict = { verdict: "incomplete", reason: `stripe_search_failed:${errorCodeOf(err)}` }
  }

  if (verdict.verdict === "incomplete") {
    // Nothing was created by this call: release the claim; the next run searches again.
    await moveClaimed(db, input.legKey, claimToken, {
      state: "PENDING",
      lastErrorCode: "search_incomplete",
      lastErrorMessage: verdict.reason,
    })
    return { outcome: "retry_later", reason: verdict.reason }
  }
  if (verdict.verdict === "in_doubt") {
    await moveClaimed(db, input.legKey, claimToken, {
      state: "IN_DOUBT",
      inDoubtReason: verdict.reason,
      inDoubtAt: now(),
    })
    logLeg("in_doubt", { legKey: input.legKey, reason: verdict.reason })
    return { outcome: "in_doubt", reason: verdict.reason }
  }
  if (verdict.verdict === "adopt") {
    return finalizePaid(verdict.transfer.id, true)
  }

  // ---- 3. create -----------------------------------------------------------------------------------------------
  let transferId: string
  try {
    const created = await stripe.createTransfer(request, idempotencyKey)
    transferId = created.id
  } catch (err) {
    const cls = classifyCreateError(err)
    const code = errorCodeOf(err)
    const message = errorMessageOf(err)
    if (cls === "failed_confirmed") {
      await moveClaimed(db, input.legKey, claimToken, {
        state: "FAILED_CONFIRMED",
        lastErrorCode: code,
        lastErrorMessage: message,
      })
      logLeg("failed_confirmed", { legKey: input.legKey, code })
      return { outcome: "failed_confirmed", errorCode: code, errorMessage: message }
    }
    if (cls === "not_processed") {
      await moveClaimed(db, input.legKey, claimToken, {
        state: "PENDING",
        lastErrorCode: code,
        lastErrorMessage: message,
      })
      return { outcome: "retry_later", reason: code }
    }
    await moveClaimed(db, input.legKey, claimToken, {
      state: "IN_DOUBT",
      inDoubtReason: `create_outcome_unknown:${code}`.slice(0, 200),
      inDoubtAt: now(),
      lastErrorCode: code,
      lastErrorMessage: message,
    })
    logLeg("in_doubt", { legKey: input.legKey, reason: "create_outcome_unknown", code })
    return { outcome: "in_doubt", reason: `create_outcome_unknown:${code}` }
  }

  // ---- 4. record -----------------------------------------------------------------------------------------------
  return finalizePaid(transferId, false)
}

// =====================================================================================================================
// Controlled recovery (admin)

export type ReconcileResult =
  | { result: "adopted"; stripeTransferId: string }
  | { result: "already_paid"; stripeTransferId: string }
  | { result: "not_found"; mayConfirmNotPaidAfter: Date | null }
  | { result: "in_doubt"; reason: string }
  | { result: "incomplete"; reason: string }
  | { result: "busy" }
  | { result: "nothing_to_reconcile"; reason: string }

/**
 * Looks for the leg's transfer in Stripe and ADOPTS it (state PAID) when exactly one consistent transfer exists. Never
 * creates anything. The caller's own records (attempt, ledger) catch up on the next run of their rail (`already_paid`).
 */
export async function reconcileLeg(
  legKey: string,
  opts: { actor: string; deps?: LegDeps }
): Promise<ReconcileResult> {
  const db = opts.deps?.db ?? (prisma as unknown as LegDb)
  const stripe = opts.deps?.stripe ?? defaultLegStripe()
  const now = opts.deps?.now ?? (() => new Date())
  const leaseMs = opts.deps?.leaseMs ?? PAYOUT_LEG_LEASE_MS
  const safetyMs = opts.deps?.confirmSafetyMs ?? PAYOUT_LEG_CONFIRM_SAFETY_MS

  const leg = await db.payoutLeg.findUnique({ where: { legKey } })
  if (!leg) return { result: "nothing_to_reconcile", reason: "unknown_leg" }
  if (leg.state === "PAID") return { result: "already_paid", stripeTransferId: leg.stripeTransferId ?? "" }
  if (leg.state === "PROCESSING" && leg.claimedAt && now().getTime() - leg.claimedAt.getTime() < leaseMs) {
    return { result: "busy" }
  }
  if (!leg.amountCents || !leg.destination || !leg.currency) {
    return { result: "nothing_to_reconcile", reason: "leg_never_claimed" }
  }

  let verdict: SearchVerdict
  try {
    verdict = await searchLeg(
      stripe,
      {
        legKey,
        kind: leg.kind as PayoutLegKind,
        role: leg.role as PayoutLegRole,
        orderId: leg.orderId,
        transferGroup: leg.transferGroup,
      },
      { amountCents: leg.amountCents, destination: leg.destination, currency: leg.currency }
    )
  } catch (err) {
    return { result: "incomplete", reason: `stripe_search_failed:${errorCodeOf(err)}` }
  }
  if (verdict.verdict === "incomplete") return { result: "incomplete", reason: verdict.reason }
  if (verdict.verdict === "in_doubt") return { result: "in_doubt", reason: verdict.reason }
  if (verdict.verdict === "none_found") {
    const last = leg.claimedAt ?? leg.inDoubtAt
    return { result: "not_found", mayConfirmNotPaidAfter: last ? new Date(last.getTime() + safetyMs) : null }
  }

  const transferId = verdict.transfer.id
  const adopted = await db.$transaction(async (tx) => {
    const current = await lockLeg(tx, legKey)
    if (!current || current.state === "PAID") return false
    if (current.state === "PROCESSING" && current.claimedAt && now().getTime() - current.claimedAt.getTime() < leaseMs) {
      return false
    }
    await tx.payoutLeg.update({
      where: { legKey },
      data: {
        state: "PAID",
        stripeTransferId: transferId,
        paidAt: now(),
        paidRail: "reconciliation",
        adopted: true,
        resolvedBy: opts.actor,
        resolutionNote: "adopted after Stripe search",
      },
    })
    await tx.auditLog.create({
      data: {
        id: `payout-leg-adopt:${legKey}`,
        action: "payout_leg.adopted",
        entityType: "PayoutLeg",
        entityId: legKey,
        actorId: null,
        payload: { actor: opts.actor, stripeTransferId: transferId, previousState: current.state },
      },
    })
    return true
  })
  if (!adopted) return { result: "busy" }
  logLeg("adopted_by_reconciliation", { legKey, stripeTransferId: transferId, actor: opts.actor })
  return { result: "adopted", stripeTransferId: transferId }
}

export type ConfirmNotPaidResult =
  | { result: "confirmed" }
  | { result: "refused"; reason: string }

/**
 * The ONLY way out of IN_DOUBT towards a new payment: a named person, after the safety delay, and only if a COMPLETE
 * Stripe search finds no transfer of this leg and no unidentified transfer in its group. The next attempt then opens a
 * new generation (new idempotency key) and searches Stripe again before creating anything.
 */
export async function confirmLegNotPaid(
  legKey: string,
  opts: { actor: string; note: string; deps?: LegDeps }
): Promise<ConfirmNotPaidResult> {
  const db = opts.deps?.db ?? (prisma as unknown as LegDb)
  const stripe = opts.deps?.stripe ?? defaultLegStripe()
  const now = opts.deps?.now ?? (() => new Date())
  const safetyMs = opts.deps?.confirmSafetyMs ?? PAYOUT_LEG_CONFIRM_SAFETY_MS
  const note = opts.note.trim()
  if (!opts.actor.trim()) return { result: "refused", reason: "actor_required" }
  if (note.length < 10) return { result: "refused", reason: "note_required" }

  const leg = await db.payoutLeg.findUnique({ where: { legKey } })
  if (!leg) return { result: "refused", reason: "unknown_leg" }
  if (leg.state !== "IN_DOUBT") return { result: "refused", reason: `state_${leg.state.toLowerCase()}` }
  const last = Math.max(leg.claimedAt?.getTime() ?? 0, leg.inDoubtAt?.getTime() ?? 0)
  if (now().getTime() - last < safetyMs) return { result: "refused", reason: "too_soon" }

  if (leg.amountCents && leg.destination && leg.currency) {
    let verdict: SearchVerdict
    try {
      verdict = await searchLeg(
        stripe,
        {
          legKey,
          kind: leg.kind as PayoutLegKind,
          role: leg.role as PayoutLegRole,
          orderId: leg.orderId,
          transferGroup: leg.transferGroup,
        },
        { amountCents: leg.amountCents, destination: leg.destination, currency: leg.currency }
      )
    } catch (err) {
      return { result: "refused", reason: `stripe_search_failed:${errorCodeOf(err)}` }
    }
    if (verdict.verdict !== "none_found") return { result: "refused", reason: `search_${verdict.verdict}` }
  } else {
    // A leg that never froze a request was never sent: only the group must be free of unidentified transfers.
    let page: { data: StripeTransferView[]; has_more: boolean }
    try {
      page = await stripe.listTransfersByGroup(leg.transferGroup)
    } catch (err) {
      return { result: "refused", reason: `stripe_search_failed:${errorCodeOf(err)}` }
    }
    if (page.has_more) return { result: "refused", reason: "search_incomplete" }
    const verdict = judgeSearch({
      leg: {
        legKey,
        kind: leg.kind as PayoutLegKind,
        role: leg.role as PayoutLegRole,
        orderId: leg.orderId,
      },
      expected: { amountCents: -1, destination: "", currency: "" },
      complete: true,
      transfers: page.data,
    })
    if (verdict.verdict !== "none_found") return { result: "refused", reason: `search_${verdict.verdict}` }
  }

  const done = await db.$transaction(async (tx) => {
    const current = await lockLeg(tx, legKey)
    if (!current || current.state !== "IN_DOUBT") return false
    await tx.payoutLeg.update({
      where: { legKey },
      data: { state: "FAILED_CONFIRMED", resolvedBy: opts.actor, resolutionNote: note.slice(0, 2000) },
    })
    await tx.auditLog.create({
      data: {
        id: `payout-leg-confirm:${legKey}:g${current.generation}`,
        action: "payout_leg.confirmed_not_paid",
        entityType: "PayoutLeg",
        entityId: legKey,
        actorId: null,
        payload: { actor: opts.actor, note: note.slice(0, 2000), inDoubtReason: current.inDoubtReason },
      },
    })
    return true
  })
  if (!done) return { result: "refused", reason: "state_changed" }
  logLeg("confirmed_not_paid", { legKey, actor: opts.actor })
  return { result: "confirmed" }
}
