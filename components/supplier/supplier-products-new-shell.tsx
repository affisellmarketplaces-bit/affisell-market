"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { SupplierAddProductForm } from "@/components/supplier/supplier-add-product-form"
import { SupplierInviteContextBanner } from "@/components/supplier/supplier-invite-context-banner"
import { SupplierProductAddHub } from "@/components/supplier/supplier-product-add-hub"
import { BentoContainer } from "@/components/affisell/bento-ui"

/**
 * Single product listing flow by default (`?compose=1`).
 * Optional hub for bulk / assist entry points: `?hub=1`.
 */
export function SupplierProductsNewShell({ ownerUserId }: { ownerUserId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")?.trim() ?? ""
  const draftQs = searchParams.get("draft")?.trim() ?? ""
  const assistQs = searchParams.get("assist") === "1"
  const hubQs = searchParams.get("hub") === "1"
  const fromInvite = searchParams.get("fromInvite") === "1"
  const [inviteCommissionHint, setInviteCommissionHint] = useState<number | null>(null)

  useEffect(() => {
    if (!fromInvite) return
    void fetch("/api/supplier/invitation-context", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { invitation?: { offeredCommissionPct?: number | null } | null } | null) => {
        const pct = j?.invitation?.offeredCommissionPct
        if (typeof pct === "number" && Number.isFinite(pct)) setInviteCommissionHint(pct)
      })
      .catch(() => {})
  }, [fromInvite])

  function goHub() {
    router.replace("/dashboard/supplier/products/new?hub=1", { scroll: false })
  }

  function startListing(assist: boolean) {
    const qs = assist ? "assist=1&compose=1" : "compose=1"
    const draft = draftQs ? `&draft=${encodeURIComponent(draftQs)}` : ""
    router.replace(`/dashboard/supplier/products/new?${qs}${draft}`, { scroll: false })
  }

  if (hubQs && !editId) {
    return (
      <SupplierProductAddHub
        onStartManual={() => startListing(false)}
        onStartWithAssist={() => startListing(true)}
      />
    )
  }

  return (
    <>
      {fromInvite ? (
        <BentoContainer maxWidth="6xl" className="pb-0 pt-6">
          <SupplierInviteContextBanner fromInviteQuery />
        </BentoContainer>
      ) : null}
      <SupplierAddProductForm
        ownerUserId={ownerUserId}
        onBackToMethods={editId ? undefined : goHub}
        assistShortcuts={Boolean(assistQs) && !editId}
        inviteCommissionHint={inviteCommissionHint}
      />
    </>
  )
}
