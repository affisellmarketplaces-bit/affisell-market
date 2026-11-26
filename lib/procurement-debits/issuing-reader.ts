/**
 * The ONLY Stripe access of the Issuing import: one GET, `GET /v1/issuing/transactions` (list, newest first, filtered
 * by `created[gte]`, paginated by `starting_after`). Frozen object, no other method — it can not create, refund,
 * transfer or change anything. It does not use the app's Stripe client (`lib/stripe.ts`), so no write method of the
 * SDK is even reachable from here.
 *
 * Minimal permission: a RESTRICTED key (`rk_test_` / `rk_live_`) with « Issuing → Transactions : Read » only
 * (`issuing_transaction_read` — the permission `report:fee-reconciliation --issuing` already names). A full secret key
 * (`sk_…`) is refused: it can write. A live key is refused outside production by the same rule as the rest of the app
 * (`assertStripeKeyAllowed`). No key is read here: the caller passes it (variable to create: `STRIPE_ISSUING_READ_KEY`,
 * founder decision — none exists today). Pure apart from the injected `fetch`.
 *
 * API VERSION: the app's Stripe client (`lib/stripe.ts`) sets no `apiVersion`, so it speaks the version pinned by the
 * installed `stripe` package — 22.1.1 (package-lock) pins `2026-04-22.dahlia` (stripe-node release notes). A raw
 * `fetch` without `Stripe-Version` would get the ACCOUNT's default version instead, which may differ: the reader sends
 * the same pinned version, so what it reads is what the app's own code would read. The Issuing transaction shape it
 * relies on (`type` capture | refund, negative capture amount, positive refund, negative refund = reversal) is the one
 * documented for that version line. `issuing-reader.test.ts` fails when the installed `stripe` version changes, so the
 * pin is re-checked on every SDK bump.
 *
 * TEST KEYS ONLY in this phase (founder rule 2026-11-19: no production key): an `rk_live_` key is refused whatever the
 * environment, until a later decision changes `ISSUING_LIVE_KEYS_ALLOWED`.
 */
export const ISSUING_READER_API_VERSION = "2026-04-22.dahlia"
export const ISSUING_READER_SDK_VERSION = "22.1.1"
export const ISSUING_LIVE_KEYS_ALLOWED = false
import { assertStripeKeyAllowed } from "@/lib/stripe-key-guard"

export type IssuingPage = { ok: true; data: unknown[]; hasMore: boolean } | { ok: false; reason: "no_access" | "http_error" | "unreadable" | "network" }

export type IssuingReader = Readonly<{
  listTransactions(args: { createdGte: number; startingAfter?: string }): Promise<IssuingPage>
}>

export class IssuingKeyRefusedError extends Error {
  constructor(public readonly why: "missing" | "not_restricted" | "live_not_allowed") {
    super(
      why === "missing" ? "issuing_read_key_missing" : why === "not_restricted" ? "issuing_read_key_must_be_restricted" : "issuing_live_key_not_allowed_in_this_phase"
    )
  }
}

export function issuingKeyMode(key: string): "live" | "test" {
  return key.startsWith("rk_live_") ? "live" : "test"
}

export function createIssuingReader(key: string | undefined | null, deps: { fetch: typeof fetch; env?: Record<string, string | undefined> }): IssuingReader {
  const k = (key ?? "").trim()
  if (!k) throw new IssuingKeyRefusedError("missing")
  if (!/^rk_(test|live)_[A-Za-z0-9]+$/.test(k)) throw new IssuingKeyRefusedError("not_restricted")
  if (k.startsWith("rk_live_") && !ISSUING_LIVE_KEYS_ALLOWED) throw new IssuingKeyRefusedError("live_not_allowed")
  assertStripeKeyAllowed(k, deps.env ?? process.env)
  const doFetch = deps.fetch
  return Object.freeze({
    async listTransactions(args: { createdGte: number; startingAfter?: string }): Promise<IssuingPage> {
      const q = new URLSearchParams({ limit: "100", "created[gte]": String(Math.max(0, Math.floor(args.createdGte))) })
      if (args.startingAfter) {
        if (!/^ipi_[A-Za-z0-9]+$/.test(args.startingAfter)) return { ok: false, reason: "unreadable" }
        q.set("starting_after", args.startingAfter)
      }
      let res: Response
      try {
        res = await doFetch(`https://api.stripe.com/v1/issuing/transactions?${q.toString()}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${k}`, "Stripe-Version": ISSUING_READER_API_VERSION },
          signal: AbortSignal.timeout(15_000),
        })
      } catch {
        return { ok: false, reason: "network" }
      }
      if (res.status === 401 || res.status === 403) return { ok: false, reason: "no_access" }
      if (!res.ok) return { ok: false, reason: "http_error" }
      let body: unknown
      try {
        body = await res.json()
      } catch {
        return { ok: false, reason: "unreadable" }
      }
      const b = body as { object?: unknown; data?: unknown; has_more?: unknown }
      if (b?.object !== "list" || !Array.isArray(b.data) || typeof b.has_more !== "boolean") return { ok: false, reason: "unreadable" }
      return { ok: true, data: b.data, hasMore: b.has_more }
    },
  })
}
