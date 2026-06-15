import { describe, expect, it } from "vitest"

import { expansionBouncesExportPath, expansionDeliveredExportPath } from "@/lib/admin/expansion-email-export-kinds"
import {
  launchBounceAlertDigestBadge,
  shouldShowLaunchBounceAlertDigestRow,
} from "@/lib/expansion/expansion-digest-launch-bounce-badge"
import {
  buildExpansionDigestKindBounceExportLines,
  buildExpansionDigestKindDeliveredExportLines,
  scoreExpansionEmailKindStat,
  sortExpansionAdminQuickExportKinds,
  EXPANSION_ADMIN_QUICK_EXPORT_KINDS,
} from "@/lib/expansion/expansion-digest-quick-exports"

describe("shouldShowLaunchBounceAlertDigestRow", () => {
  it("includes countries with min notified and bounce activity", () => {
    expect(
      shouldShowLaunchBounceAlertDigestRow({
        notifiedCount: 12,
        retriesPending: 1,
        suppressed: 0,
      })
    ).toBe(true)
  })

  it("skips below min notified threshold", () => {
    expect(
      shouldShowLaunchBounceAlertDigestRow({
        notifiedCount: 8,
        retriesPending: 2,
        suppressed: 1,
      })
    ).toBe(false)
  })

  it("skips when no bounce activity", () => {
    expect(
      shouldShowLaunchBounceAlertDigestRow({
        notifiedCount: 20,
        retriesPending: 0,
        suppressed: 0,
      })
    ).toBe(false)
  })
})

describe("launchBounceAlertDigestBadge", () => {
  it("flags auto-paused launch notify with bounces", () => {
    expect(
      launchBounceAlertDigestBadge({
        launchBounceRatePct: 6,
        launchNotifyPaused: true,
      })
    ).toBe(" · 🔴 auto-paused")
  })

  it("flags bounce alert when not paused", () => {
    expect(
      launchBounceAlertDigestBadge({
        launchBounceRatePct: 3,
        launchNotifyPaused: false,
      })
    ).toBe(" · 📉 bounce alert")
  })
})

describe("buildExpansionDigestKindBounceExportLines", () => {
  it("lists Metabase bounce exports by email kind", () => {
    const lines = buildExpansionDigestKindBounceExportLines("https://app.test")
    expect(lines[0]).toBe("Metabase bounces export by kind:")
    expect(lines.join("\n")).toContain("bounces-export?emailKind=checkout-launch")
    expect(lines.join("\n")).toContain("checkout-graduated")
  })
})

describe("buildExpansionDigestKindDeliveredExportLines", () => {
  it("lists Metabase delivered exports by email kind", () => {
    const lines = buildExpansionDigestKindDeliveredExportLines("https://app.test")
    expect(lines[0]).toBe("Metabase delivered export by kind:")
    expect(lines.join("\n")).toContain(
      expansionDeliveredExportPath(undefined, "checkout-launch-followup")
    )
  })
})

describe("sortExpansionAdminQuickExportKinds", () => {
  it("sorts kind groups by monthly email volume", () => {
    const sorted = sortExpansionAdminQuickExportKinds(EXPANSION_ADMIN_QUICK_EXPORT_KINDS, [
      {
        emailKind: "checkout-launch",
        deliveredThisMonth: 5,
        bouncesThisMonth: 0,
        complaintsThisMonth: 0,
      },
      {
        emailKind: "checkout-launch-followup",
        deliveredThisMonth: 20,
        bouncesThisMonth: 2,
        complaintsThisMonth: 1,
      },
      {
        emailKind: "checkout-graduated",
        deliveredThisMonth: 1,
        bouncesThisMonth: 0,
        complaintsThisMonth: 0,
      },
    ])
    expect(sorted[0]?.emailKind).toBe("checkout-launch-followup")
    expect(sorted[1]?.emailKind).toBe("checkout-launch")
  })
})

describe("scoreExpansionEmailKindStat", () => {
  it("sums delivered, bounces, and complaints", () => {
    expect(
      scoreExpansionEmailKindStat({
        deliveredThisMonth: 10,
        bouncesThisMonth: 2,
        complaintsThisMonth: 1,
      })
    ).toBe(13)
  })
})

describe("expansionBouncesExportPath graduation kind", () => {
  it("builds graduation bounces export path", () => {
    expect(expansionBouncesExportPath(undefined, "checkout-graduated")).toBe(
      "/api/admin/expansion/bounces-export?emailKind=checkout-graduated"
    )
  })
})
