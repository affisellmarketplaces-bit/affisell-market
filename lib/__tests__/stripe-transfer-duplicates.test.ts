import { describe, expect, it } from "vitest"

import { findStripeTransferDuplicates, type StripeTransferLite } from "@/lib/finance/stripe-transfer-duplicates"

/** Shapes copied from the Stripe Test account (2026-11-27 read), ids shortened. */
const t = (
  id: string,
  group: string,
  dest: string,
  amount: number,
  created: number,
  role?: string,
  extra = {},
): StripeTransferLite => ({
  id,
  amount,
  created,
  destination: dest,
  transfer_group: group,
  metadata: role === undefined ? {} : { orderId: group, role, ...extra },
})

const MAY24 = [
  // cmpjs9s0m…: four legacy `supplier` transfers in one second, then the job's `SUPPLIER` one.
  t("tr_1a", "cmpjs9", "acct_sup", 8_736, 1779635987, "supplier"),
  t("tr_1b", "cmpjs9", "acct_sup", 8_736, 1779635988, "supplier"),
  t("tr_1c", "cmpjs9", "acct_sup", 8_736, 1779635988, "supplier"),
  t("tr_1d", "cmpjs9", "acct_sup", 8_736, 1779635988, "supplier"),
  t("tr_3e", "cmpjs9", "acct_sup", 8_736, 1779649150, "SUPPLIER"),
  // cmpjp39…: two legacy transfers 195 s apart.
  t("tr_2a", "cmpjp3", "acct_sup", 8_736, 1779632978, "supplier"),
  t("tr_2b", "cmpjp3", "acct_sup", 8_736, 1779633173, "supplier"),
  // healthy orders: one transfer per leg, Lightning included
  t("tr_ok1", "cmqzij", "acct_sup", 7_606, 1785484645, "SUPPLIER"),
  t("tr_ok2", "cmqzij", "acct_aff", 9_089, 1785484652, "AFFILIATE"),
  t("tr_l1", "cmqzfc", "acct_sup", 7_606, 1782755622, "supplier", { lightning: "true" }),
  t("tr_l2", "cmqzfc", "acct_aff", 951, 1782755623, "affiliate", { lightning: "true" }),
]

describe("findStripeTransferDuplicates", () => {
  it("finds the 24/05 duplicates and nothing on healthy orders (Lightning included)", () => {
    const d = findStripeTransferDuplicates(MAY24)
    expect(d.map((x) => [x.transferGroup, x.extraCount, x.extraCents])).toEqual([
      ["cmpjs9", 4, 34_944],
      ["cmpjp3", 1, 8_736],
    ])
    expect(d[0]!.transferIds).toEqual(["tr_1a", "tr_1b", "tr_1c", "tr_1d", "tr_3e"])
    expect(d[0]!.role).toBe("SUPPLIER")
  })

  it("a fully reversed transfer does not count; a partially reversed one counts for its net", () => {
    const d = findStripeTransferDuplicates([
      t("a", "g", "acct", 1_000, 1, "SUPPLIER"),
      { ...t("b", "g", "acct", 1_000, 2, "supplier"), amount_reversed: 1_000 },
    ])
    expect(d).toEqual([])
    const p = findStripeTransferDuplicates([
      t("a", "g", "acct", 1_000, 1, "SUPPLIER"),
      { ...t("b", "g", "acct", 1_000, 2, "supplier"), amount_reversed: 400 },
    ])
    expect(p[0]).toMatchObject({ extraCount: 1, extraCents: 600 })
  })

  it("a role-less transfer to the same account is counted with the leg (fail-safe)", () => {
    expect(
      findStripeTransferDuplicates([t("a", "g", "acct", 500, 1, "SUPPLIER"), t("b", "g", "acct", 500, 2)]),
    ).toHaveLength(1)
  })

  it("supplier and reseller being the same account are two legs, not a duplicate", () => {
    expect(
      findStripeTransferDuplicates([t("a", "g", "acct", 500, 1, "SUPPLIER"), t("b", "g", "acct", 90, 2, "AFFILIATE")]),
    ).toEqual([])
  })

  it("transfers without a group or destination are ignored", () => {
    expect(
      findStripeTransferDuplicates([
        { ...t("a", "g", "acct", 1, 1, "S"), transfer_group: null },
        { ...t("b", "g", "acct", 1, 1, "S"), transfer_group: null },
      ]),
    ).toEqual([])
  })
})
