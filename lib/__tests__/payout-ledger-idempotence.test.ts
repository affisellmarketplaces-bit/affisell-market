/**
 * Unit rules of the payout ledger insert (no database): what "nothing inserted" may mean, and what is never hidden.
 * The real-PostgreSQL proof (transaction kept usable, other writes kept, concurrency) is payout-ledger-idempotence-db.
 */
import { describe, expect, it, vi } from "vitest"

import {
  insertPayoutLedgerRow,
  payoutLedgerDifferences,
  PayoutLedgerConflictError,
  recordMerchantPayoutEntry,
  type PayoutLedgerRow,
} from "@/lib/payout-ledger"

const row: PayoutLedgerRow = {
  orderId: "o1",
  blindDropshipOrderId: null,
  userId: "u1",
  beneficiaryRole: "SUPPLIER",
  entryType: "PAYOUT",
  amountCents: 1234,
  idempotencyKey: "stripe:tr:tr_1",
  stripeTransferId: "tr_1",
  payoutRail: "connect",
  note: "n",
}

function fakeTx(opts: { count: number; byKey?: Partial<PayoutLedgerRow> | null; byTransfer?: { id: string } | null; createError?: Error }) {
  const createMany = vi.fn(async () => {
    if (opts.createError) throw opts.createError
    return { count: opts.count }
  })
  const findUnique = vi.fn(async ({ where }: { where: Record<string, string> }) =>
    "idempotencyKey" in where ? (opts.byKey ?? null) : (opts.byTransfer ?? null)
  )
  return { tx: { merchantPayoutLedger: { createMany, findUnique } } as never, createMany, findUnique }
}

describe("payout ledger insert — never a caught unique violation", () => {
  it("inserts with ON CONFLICT DO NOTHING (createMany + skipDuplicates), never a plain create", async () => {
    const { tx, createMany, findUnique } = fakeTx({ count: 1 })
    expect(await insertPayoutLedgerRow(tx, row)).toBe(true)
    expect(createMany).toHaveBeenCalledWith({ data: [row], skipDuplicates: true })
    expect(findUnique).not.toHaveBeenCalled()
  })

  it("nothing inserted + the SAME entry under the key = a replay (false)", async () => {
    const { tx } = fakeTx({ count: 0, byKey: { ...row, note: "another note", payoutRail: "lightning" } })
    expect(await insertPayoutLedgerRow(tx, row)).toBe(false)
  })

  it("nothing inserted + a DIFFERENT entry under the key = conflict, names the fields only", async () => {
    const { tx } = fakeTx({ count: 0, byKey: { ...row, amountCents: 999, userId: "u2" } })
    const err = await insertPayoutLedgerRow(tx, row).catch((e) => e)
    expect(err).toBeInstanceOf(PayoutLedgerConflictError)
    expect(err.reason).toBe("idempotency_key_mismatch")
    expect(err.differingFields).toEqual(["userId", "amountCents"])
    expect(String(err.message)).not.toContain("999")
  })

  it("nothing inserted + the transfer held by ANOTHER key = conflict (one transfer, two entries)", async () => {
    const { tx } = fakeTx({ count: 0, byKey: null, byTransfer: { id: "x" } })
    await expect(insertPayoutLedgerRow(tx, row)).rejects.toMatchObject({ reason: "stripe_transfer_taken" })
  })

  it("nothing inserted and nothing explains it = conflict, never a silent false", async () => {
    const { tx } = fakeTx({ count: 0, byKey: null, byTransfer: null })
    await expect(insertPayoutLedgerRow(tx, row)).rejects.toMatchObject({ reason: "unexplained_conflict" })
  })

  it("any other database error goes through untouched", async () => {
    const fk = Object.assign(new Error("Foreign key constraint violated"), { code: "P2003" })
    const { tx } = fakeTx({ count: 0, createError: fk })
    await expect(insertPayoutLedgerRow(tx, row)).rejects.toBe(fk)
  })

  it("identity = order, blind order, beneficiary, role, kind, amount, transfer (null and undefined equal)", () => {
    expect(payoutLedgerDifferences(row, { ...row })).toEqual([])
    expect(payoutLedgerDifferences({ ...row, stripeTransferId: null }, { ...row, stripeTransferId: undefined as never })).toEqual([])
    expect(payoutLedgerDifferences(row, { ...row, entryType: "CLAWBACK" })).toEqual(["entryType"])
  })

  it("recordMerchantPayoutEntry keeps its guards and its rail default", async () => {
    const { tx, createMany } = fakeTx({ count: 1 })
    expect(await recordMerchantPayoutEntry(tx, { userId: "u", beneficiaryRole: "SUPPLIER", amountCents: 0, idempotencyKey: "k", note: "n", orderId: "o" })).toBe(false)
    expect(await recordMerchantPayoutEntry(tx, { userId: "u", beneficiaryRole: "SUPPLIER", amountCents: 5, idempotencyKey: "k", note: "n" })).toBe(false)
    expect(createMany).not.toHaveBeenCalled()
    await recordMerchantPayoutEntry(tx, { userId: "u", beneficiaryRole: "SUPPLIER", amountCents: 5, idempotencyKey: "k", note: "n", orderId: "o", stripeTransferId: " tr_9 " })
    expect(createMany).toHaveBeenLastCalledWith({
      data: [expect.objectContaining({ stripeTransferId: "tr_9", payoutRail: "connect", entryType: "PAYOUT", blindDropshipOrderId: null })],
      skipDuplicates: true,
    })
  })
})

describe("no writer of the ledger catches a unique violation inside a transaction", () => {
  it("the three writers go through the shared insert", async () => {
    const { readFileSync } = await import("node:fs")
    const files = ["lib/payout-ledger.ts", "lib/payout-settlement.ts", "lib/legion/pay-referral-override.ts", "lib/blind-dropship-payout.ts"]
    for (const f of files) {
      const src = readFileSync(f, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")
      expect(src, f).not.toMatch(/merchantPayoutLedger\.create\(/)
      expect(src, f).not.toMatch(/===\s*"P2002"/)
    }
  })
})
