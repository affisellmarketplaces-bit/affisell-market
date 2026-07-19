import { describe, expect, it } from "vitest"

import {
  RADAR_GLOBAL_PRICE_LOOKUP_KEY,
  RADAR_PRO_PRICE_LOOKUP_KEY,
} from "@/lib/stripe-radar-ensure"

describe("stripe-radar-ensure lookup keys", () => {
  it("keeps stable Affisell Radar lookup_keys for idempotent provisioning", () => {
    expect(RADAR_PRO_PRICE_LOOKUP_KEY).toBe("affisell_radar_pro_monthly")
    expect(RADAR_GLOBAL_PRICE_LOOKUP_KEY).toBe("affisell_radar_global_monthly")
  })
})
