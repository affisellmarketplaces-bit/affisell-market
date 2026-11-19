/**
 * Qualification of a supplier's cost DECLARATION (founder rule 2026-11-19). Five states, never attributed
 * automatically — each change is an explicit, traced action by a person:
 *  - `unverified`         the default of every declaration (no row needed);
 *  - `document_provided`  the SUPPLIER says it supplied a supporting document (invoice, price list…) and describes it —
 *                         a claim, not a check;
 *  - `verified`           an Affisell ADMIN checked the declaration against the document;
 *  - `disputed`           an Affisell ADMIN found it does not match (reason required);
 *  - `expired`            an Affisell ADMIN marked it out of date (reason required).
 * A qualification belongs to ONE declaration version (`n` in `supplier-cost:<productId>:<n>`): a new declaration starts
 * again at `unverified`, a later qualification never upgrades an earlier figure.
 *
 * Whatever the state, a declared cost may feed INTERNAL simulations only, with its state written next to it. No contract
 * rate, financial commitment or commercial automation may rest on a declaration alone (`mayBackCommercialTerms` says
 * so in code: only `verified`, and even then it is a human decision). Pure module — no database.
 */
export const COST_QUALIFICATION_ACTION = "supplier.cost_qualification"

export const COST_QUALIFICATIONS = ["unverified", "document_provided", "verified", "disputed", "expired"] as const
export type CostQualification = (typeof COST_QUALIFICATIONS)[number]

export type QualificationActor = "supplier" | "admin"

/** Who may set which state — never the system. */
export const QUALIFICATION_SETTERS: Record<Exclude<CostQualification, "unverified">, QualificationActor> = {
  document_provided: "supplier",
  verified: "admin",
  disputed: "admin",
  expired: "admin",
}

export function qualificationEventId(productId: string, declarationN: number, k: number): string {
  return `supplier-cost-qualification:${productId}:${declarationN}:${k}`
}

/**
 * A VARIANT declaration has its own qualification events (its own action and ids, `n` = the variant declaration's number
 * on the product): a product-wide qualification never qualifies a variant's figure, and the reverse.
 */
export const VARIANT_COST_QUALIFICATION_ACTION = "supplier.cost_qualification_variant"
export function variantQualificationEventId(productId: string, declarationN: number, k: number): string {
  return `supplier-cost-vq:${productId}:${declarationN}:${k}`
}

export type QualificationEvent = {
  declarationN: number
  state: Exclude<CostQualification, "unverified">
  by: string
  role: QualificationActor
  note: string
  at: string
}

export function parseQualificationEvent(payload: unknown): QualificationEvent | null {
  const p = (payload && typeof payload === "object" ? payload : null) as Record<string, unknown> | null
  if (!p) return null
  const state = p.state
  if (typeof state !== "string" || state === "unverified" || !(COST_QUALIFICATIONS as readonly string[]).includes(state)) return null
  const role = p.role === "admin" || p.role === "supplier" ? p.role : null
  if (!role || QUALIFICATION_SETTERS[state as QualificationEvent["state"]] !== role) return null
  if (typeof p.by !== "string" || typeof p.at !== "string" || !Number.isInteger(p.declarationN)) return null
  return { declarationN: p.declarationN as number, state: state as QualificationEvent["state"], by: p.by, role, note: typeof p.note === "string" ? p.note : "", at: p.at }
}

/** The qualification of declaration `n`: its latest event, else `unverified`. Events of other versions never count. */
export function currentQualification(events: ReadonlyArray<QualificationEvent>, declarationN: number): CostQualification {
  let latest: QualificationEvent | null = null
  for (const e of events) {
    if (e.declarationN !== declarationN) continue
    if (!latest || Date.parse(e.at) >= Date.parse(latest.at)) latest = e
  }
  return latest?.state ?? "unverified"
}

export type QualificationRequest = { state: Exclude<CostQualification, "unverified">; note: string }

/** Validates a requested change for an actor. `disputed` / `expired` need a reason; a supplier only provides documents. */
export function checkQualificationRequest(
  actor: QualificationActor,
  body: unknown
): { ok: true; value: QualificationRequest } | { ok: false; error: "state_invalid" | "not_allowed_for_actor" | "note_required" } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const state = b.state
  if (typeof state !== "string" || state === "unverified" || !(COST_QUALIFICATIONS as readonly string[]).includes(state)) {
    return { ok: false, error: "state_invalid" }
  }
  const s = state as QualificationRequest["state"]
  if (QUALIFICATION_SETTERS[s] !== actor) return { ok: false, error: "not_allowed_for_actor" }
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 1000) : ""
  if (note.length < 3) return { ok: false, error: "note_required" }
  return { ok: true, value: { state: s, note } }
}

/** The warning that goes with a declared cost wherever it is used internally. */
export function qualificationWarning(q: CostQualification): string {
  switch (q) {
    case "verified":
      return "coût déclaré par le fournisseur, vérifié par Affisell"
    case "document_provided":
      return "coût déclaré par le fournisseur, justificatif annoncé mais non vérifié par Affisell"
    case "disputed":
      return "coût déclaré par le fournisseur et CONTESTÉ par Affisell : résultat non fiable"
    case "expired":
      return "coût déclaré par le fournisseur, marqué EXPIRÉ : résultat non fiable"
    default:
      return "coût déclaré par le fournisseur, non vérifié par Affisell"
  }
}

/** No contract rate, commitment or automation may rest on a declaration that Affisell has not verified. */
export function mayBackCommercialTerms(q: CostQualification): boolean {
  return q === "verified"
}
