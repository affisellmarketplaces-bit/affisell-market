import { ALLOWED_ROLES, type ContractModel } from "@/lib/contract-models/model"

/**
 * Version 1 of the four commercial models, DRAFTS. Path A reproduces today's settlement (supplier fee from the
 * category grid / negotiated rate, reseller fee 20 %). Every value of B and C that changes who earns what is listed in
 * `undecided`: it is a placeholder for simulation, NOT a proposal — the founder sets it. None of these is active.
 */
const NO_ADVANCE = { allowed: false, maxCentsPerLine: 0, guarantee: "none" as const }

export const DRAFT_CONTRACT_MODELS: ReadonlyArray<ContractModel> = [
  {
    id: "catalogue-standard",
    version: 1,
    status: "draft",
    path: "A_catalogue",
    label: "Catalogue — the supplier ships its own stock (today's rule)",
    roles: ALLOWED_ROLES.A_catalogue,
    parameters: {
      supplierFeeBps: null,
      supplierFixedFeeCents: 0,
      resellerFeeBps: 2_000,
      procurementServiceFeeBps: 0,
      shippingBearer: "supplier",
      returnsBearer: "supplier",
      advance: NO_ADVANCE,
    },
    undecided: [],
  },
  {
    id: "platform-purchase",
    version: 1,
    status: "draft",
    path: "B_platform_purchase",
    label: "Affisell buys and sells (platform account)",
    roles: ALLOWED_ROLES.B_platform_purchase,
    parameters: {
      supplierFeeBps: 0,
      supplierFixedFeeCents: 0,
      resellerFeeBps: 2_000,
      procurementServiceFeeBps: 0,
      shippingBearer: "affisell",
      returnsBearer: "affisell",
      advance: NO_ADVANCE,
    },
    undecided: ["resellerFeeBps", "roles.owner", "roles.contractualSupplier"],
  },
  {
    id: "delegated-purchase",
    version: 1,
    status: "draft",
    path: "C1_delegated_purchase",
    label: "The engine buys for the supplier, who pays its source",
    roles: ALLOWED_ROLES.C1_delegated_purchase,
    parameters: {
      supplierFeeBps: null,
      supplierFixedFeeCents: 0,
      resellerFeeBps: 2_000,
      procurementServiceFeeBps: 300,
      shippingBearer: "supplier",
      returnsBearer: "supplier",
      advance: NO_ADVANCE,
    },
    undecided: ["procurementServiceFeeBps"],
  },
  {
    id: "advanced-purchase",
    version: 1,
    status: "draft",
    path: "C2_advanced_purchase",
    label: "Affisell advances the source cost for the supplier",
    roles: ALLOWED_ROLES.C2_advanced_purchase,
    parameters: {
      supplierFeeBps: null,
      supplierFixedFeeCents: 0,
      resellerFeeBps: 2_000,
      procurementServiceFeeBps: 300,
      shippingBearer: "supplier",
      returnsBearer: "supplier",
      advance: { allowed: true, maxCentsPerLine: 20_000, guarantee: "deduct_from_payout" },
    },
    undecided: ["procurementServiceFeeBps", "advance", "roles.owner"],
  },
]
