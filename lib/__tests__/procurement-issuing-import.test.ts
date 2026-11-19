import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it, vi } from "vitest"

import { nextImportStart, parseIssuingTransaction, planIssuingImport, type IssuingTransaction } from "@/lib/procurement-debits/issuing-import"
import { createIssuingReader, IssuingKeyRefusedError } from "@/lib/procurement-debits/issuing-reader"

const raw = (o: Record<string, unknown> = {}) => ({
  object: "issuing.transaction",
  id: "ipi_c1",
  type: "capture",
  amount: -1200,
  currency: "eur",
  merchant_amount: -1300,
  merchant_currency: "usd",
  authorization: "iauth_a1",
  card: "ic_k1",
  balance_transaction: "txn_b1",
  created: 1_763_500_000,
  livemode: false,
  ...o,
})
const tx = (o: Record<string, unknown> = {}): IssuingTransaction => {
  const p = parseIssuingTransaction(raw(o))
  if (!p.ok) throw new Error(p.reason)
  return p.value
}
const plan = (txs: IssuingTransaction[], cardOrders: Array<[string, string[]]> = [], existing: Parameters<typeof planIssuingImport>[0]["existing"] = []) =>
  planIssuingImport({ transactions: txs, existing, cardOrders: new Map(cardOrders), livemode: false })

describe("reading an Issuing transaction — strictly", () => {
  it("keeps ids only, never card data, and refuses anything unexpected", () => {
    const expanded = parseIssuingTransaction(raw({ card: { id: "ic_k1", number: "4242424242424242", cvc: "123" } }))
    expect(expanded).toMatchObject({ ok: true, value: { card: "ic_k1" } })
    expect(JSON.stringify(expanded)).not.toContain("4242")
    expect(parseIssuingTransaction(raw({ object: "issuing.authorization" }))).toEqual({ ok: false, reason: "objet_inattendu" })
    expect(parseIssuingTransaction(raw({ type: "dispute" }))).toEqual({ ok: false, reason: "type_inconnu" })
    expect(parseIssuingTransaction(raw({ amount: "12" }))).toEqual({ ok: false, reason: "montant_illisible" })
    expect(parseIssuingTransaction(raw({ balance_transaction: "bogus" }))).toEqual({ ok: false, reason: "reference_illisible" })
    expect(parseIssuingTransaction(raw({ authorization: null, balance_transaction: null })).ok).toBe(true)
  })
})

describe("planning — what becomes a movement", () => {
  it("capture (negative) = debit: original = merchant amount, settled = what the EUR balance took", () => {
    const p = plan([tx()], [["ic_k1", ["o1"]]])
    expect(p.record[0]).toMatchObject({ reference: "ipi_c1", kind: "debit", amountCents: 1300, currency: "USD", settledAmountCents: 1200, balanceTransactionId: "txn_b1", autoAllocateOrderId: "o1", reviewReason: null })
  })
  it("a positive capture, a zero amount and the other mode are not imported", () => {
    const p = plan([tx({ id: "ipi_p", amount: 50 }), tx({ id: "ipi_z", amount: 0 }), tx({ id: "ipi_l", livemode: true })])
    expect(p.record).toHaveLength(0)
    expect(p.skipped.map((s) => s.reason).sort()).toEqual(["capture_de_montant_positif", "mode_test_live_different", "montant_nul"])
  })
  it("partial / multi / force captures are each their own debit", () => {
    const p = plan([tx({ id: "ipi_a", amount: -500 }), tx({ id: "ipi_b", amount: -700, created: 1_763_500_100 }), tx({ id: "ipi_f", authorization: null, amount: -100 })], [["ic_k1", ["o1"]]])
    expect(p.record.map((r) => [r.reference, r.settledAmountCents])).toEqual([["ipi_a", 500], ["ipi_f", 100], ["ipi_b", 700]])
  })
  it("a balance in another currency keeps the settled euros unknown and the movement apart", () => {
    const p = plan([tx({ currency: "usd", merchant_currency: "usd" })], [["ic_k1", ["o1"]]])
    expect(p.record[0]).toMatchObject({ settledAmountCents: null, autoAllocateOrderId: null })
    expect(p.record[0]!.reviewReason).toMatch(/montant réglé en euros inconnu/)
  })
  it("a euro merchant figure different from the euro debit is a contradiction kept for review", () => {
    const p = plan([tx({ merchant_currency: "eur", merchant_amount: -1250 })], [["ic_k1", ["o1"]]])
    expect(p.record[0]).toMatchObject({ amountCents: 1200, currency: "EUR", settledAmountCents: 1200, autoAllocateOrderId: null })
    expect(p.record[0]!.reviewReason).toMatch(/différent/)
  })
})

describe("refunds — tied only when certain", () => {
  it("same authorization or the single purchase of the single-use card → tied to it, allocated to its order", () => {
    const viaAuth = plan([tx(), tx({ id: "ipi_c2", authorization: "iauth_a2" }), tx({ id: "ipi_r", type: "refund", amount: 300, merchant_amount: 300, authorization: "iauth_a2" })], [["ic_k1", ["o1"]]])
    expect(viaAuth.record.find((r) => r.reference === "ipi_r")).toMatchObject({ kind: "refund", parent: { reference: "ipi_c2" }, reviewReason: null, autoAllocateOrderId: "o1" })
    const single = plan([tx(), tx({ id: "ipi_r", type: "refund", amount: 300, merchant_amount: 300, authorization: null })], [["ic_k1", ["o1"]]])
    expect(single.record.find((r) => r.reference === "ipi_r")).toMatchObject({ parent: { reference: "ipi_c1" }, note: "rattaché au seul achat de la carte à usage unique" })
  })
  it("several purchases and no matching authorization → recorded APART, never guessed", () => {
    const p = plan([tx(), tx({ id: "ipi_c2", authorization: "iauth_a2" }), tx({ id: "ipi_r", type: "refund", amount: 300, merchant_amount: 300, authorization: "iauth_other" })], [["ic_k1", ["o1"]]])
    const r = p.record.find((x) => x.reference === "ipi_r")!
    expect(r).toMatchObject({ parent: null, autoAllocateOrderId: null })
    expect(r.reviewReason).toMatch(/rattachement incertain/)
  })
  it("a refund on a card with no known purchase is kept apart", () => {
    const p = plan([tx({ id: "ipi_r", type: "refund", amount: 300, merchant_amount: 300 })])
    expect(p.record[0]!.reviewReason).toBe("aucun achat connu sur cette carte")
  })
  it("a negative refund is a refund reversal, tied the same way", () => {
    const p = plan([tx(), tx({ id: "ipi_v", type: "refund", amount: -100, merchant_amount: -100, authorization: "iauth_a1" })], [["ic_k1", ["o1"]]])
    expect(p.record.find((r) => r.reference === "ipi_v")).toMatchObject({ kind: "refund_reversal", settledAmountCents: 100, parent: { reference: "ipi_c1" } })
  })
  it("a refund of a capture recorded in an earlier run uses that row", () => {
    const p = plan([tx({ id: "ipi_r", type: "refund", amount: 300, merchant_amount: 300 })], [["ic_k1", ["o1"]]], [
      { id: "db1", sourceReference: "ipi_c1", kind: "debit", amountCents: 1300, settledAmountCents: 1200, issuingCardId: "ic_k1", issuingAuthorizationId: "iauth_a1" },
    ])
    expect(p.record[0]).toMatchObject({ parent: { existingId: "db1" } })
  })
})

describe("allocation only from Affisell's own card → order record", () => {
  it("a card tied to no order or to several orders: recorded, not allocated, reason said", () => {
    expect(plan([tx()]).notAllocated).toEqual([{ reference: "ipi_c1", reason: "carte_sans_commande" }])
    expect(plan([tx()], [["ic_k1", ["o1", "o2"]]]).notAllocated).toEqual([{ reference: "ipi_c1", reason: "carte_liee_a_plusieurs_commandes" }])
  })
})

describe("idempotence and resumption", () => {
  const existing = [{ id: "db1", sourceReference: "ipi_c1", kind: "debit" as const, amountCents: 1300, settledAmountCents: 1200, issuingCardId: "ic_k1", issuingAuthorizationId: "iauth_a1" }]
  it("an already recorded transaction is skipped; different figures at Stripe are flagged, never rewritten", () => {
    expect(plan([tx()], [], existing)).toMatchObject({ alreadyRecorded: ["ipi_c1"], record: [] })
    expect(plan([tx({ amount: -1100 })], [], existing).changedAtSource).toEqual([{ reference: "ipi_c1", reason: "montants_differents_de_l_enregistrement" }])
  })
  it("a transaction listed twice in one read is planned once", () => {
    expect(plan([tx(), tx()]).record).toHaveLength(1)
  })
  it("the next window overlaps the checkpoint by two days", () => {
    expect(nextImportStart(1_000_000, 5)).toBe(1_000_000 - 2 * 86_400)
    expect(nextImportStart(null, 5)).toBe(5)
  })
})

describe("the reader — one GET, restricted key only", () => {
  const ok = () => new Response(JSON.stringify({ object: "list", data: [raw()], has_more: false }), { status: 200 })
  it("refuses a missing key, a full secret key, and a live key outside production", () => {
    const f = vi.fn()
    expect(() => createIssuingReader("", { fetch: f })).toThrow(IssuingKeyRefusedError)
    expect(() => createIssuingReader("sk_test_abc", { fetch: f })).toThrow("issuing_read_key_must_be_restricted")
    expect(() => createIssuingReader("rk_live_abc", { fetch: f, env: { VERCEL_ENV: "preview" } })).toThrow()
    expect(f).not.toHaveBeenCalled()
  })
  it("only ever sends GET /v1/issuing/transactions, and exposes nothing else", async () => {
    const f = vi.fn(async () => ok())
    const reader = createIssuingReader("rk_test_abc", { fetch: f as unknown as typeof fetch, env: {} })
    expect(Object.keys(reader)).toEqual(["listTransactions"])
    expect(Object.isFrozen(reader)).toBe(true)
    const page = await reader.listTransactions({ createdGte: 100, startingAfter: "ipi_x" })
    expect(page).toMatchObject({ ok: true, hasMore: false })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://api.stripe.com/v1/issuing/transactions?limit=100&created%5Bgte%5D=100&starting_after=ipi_x")
    expect(init.method).toBe("GET")
    expect(init.body).toBeUndefined()
  })
  it("maps access and reading failures without throwing", async () => {
    const reader = (r: Response | Error) =>
      createIssuingReader("rk_test_abc", { fetch: (async () => { if (r instanceof Error) throw r; return r }) as unknown as typeof fetch, env: {} })
    expect(await reader(new Response("", { status: 403 })).listTransactions({ createdGte: 0 })).toEqual({ ok: false, reason: "no_access" })
    expect(await reader(new Response("{}", { status: 200 })).listTransactions({ createdGte: 0 })).toEqual({ ok: false, reason: "unreadable" })
    expect(await reader(new Error("down")).listTransactions({ createdGte: 0 })).toEqual({ ok: false, reason: "network" })
    expect(await reader(new Response("", { status: 200 })).listTransactions({ createdGte: 0, startingAfter: "../x" })).toEqual({ ok: false, reason: "unreadable" })
  })
})

describe("isolation", () => {
  it("the import never reaches the app's Stripe client or any money path, and is wired to nothing", () => {
    for (const f of ["issuing-import.ts", "issuing-import.server.ts", "issuing-reader.ts"]) {
      const src = readFileSync(path.resolve(__dirname, `../procurement-debits/${f}`), "utf8")
      expect(src).not.toMatch(/from "@\/lib\/(stripe"|stripe\.ts|transfers|marketplace-checkout|fulfillment)/)
      expect(src).not.toMatch(/refunds\.create|transfers\.create|payouts\.create|method: "POST"/)
    }
    const root = path.resolve(__dirname, "../..")
    const users = execSync(`grep -rl "issuing-import.server" app lib --include=*.ts --include=*.tsx || true`, { cwd: root }).toString().trim().split("\n").filter(Boolean)
    expect(users.filter((u) => !u.includes("__tests__"))).toEqual([])
  })
})
