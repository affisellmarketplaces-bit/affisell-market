import "server-only"

import { evaluateListingReadiness, type ReadinessInput } from "@/lib/listing-compliance/evaluate"
import {
  decideListingReadiness,
  listingNotReadyBody,
  readListingReadinessMode,
  type ListingReadinessMode,
  type ReadinessContext,
  type ReadinessDecision,
} from "@/lib/listing-compliance/mode"

export type ReadinessSource = "api_create" | "api_update" | "bulk_commit"

export type ReadinessGateArgs = {
  source: ReadinessSource
  supplierId: string
  productId?: string | null
  listingKind?: string | null
  attributes: ReadinessInput["attributes"]
  context: ReadinessContext
  /** Injectable for tests; defaults to LISTING_READINESS_MODE. */
  mode?: ListingReadinessMode
}

export type ReadinessGateOutcome = {
  decision: ReadinessDecision
  /** Non-null only when the request must be refused (enforce mode, new publication, blocking issue). */
  blockResponse: Response | null
}

/**
 * Evaluates a publication against the listing-readiness rules, logs what is wrong (so `warn` mode shows how many
 * publications WOULD be refused before anyone flips to `enforce`), and returns the 422 response when it must be refused.
 * Never throws: a bug here must not be able to take publishing down.
 */
export function applyListingReadinessGate(args: ReadinessGateArgs): ReadinessGateOutcome {
  try {
    const mode = args.mode ?? readListingReadinessMode()
    const result = evaluateListingReadiness({ listingKind: args.listingKind, attributes: args.attributes })
    const decision = decideListingReadiness(result, args.context, mode)

    if (decision.log) {
      console.log("[listing-readiness]", {
        mode,
        source: args.source,
        context: args.context,
        supplierId: args.supplierId,
        productId: args.productId ?? null,
        blocking: decision.blocking.map((i) => i.code),
        advisory: decision.issues.filter((i) => i.severity === "advisory").map((i) => i.code),
        result: decision.block ? "refused" : mode === "enforce" ? "observed_only" : "would_refuse_if_enforced",
      })
    }

    return {
      decision,
      blockResponse: decision.block ? Response.json(listingNotReadyBody(decision), { status: 422 }) : null,
    }
  } catch (e) {
    console.error("[listing-readiness] evaluation failed — publication not blocked", e)
    return {
      decision: { mode: "off", block: false, log: false, issues: [], blocking: [] },
      blockResponse: null,
    }
  }
}
