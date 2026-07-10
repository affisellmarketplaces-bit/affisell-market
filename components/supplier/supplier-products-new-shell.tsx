"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { SupplierAddProductForm } from "@/components/supplier/supplier-add-product-form"
import { SupplierInviteContextBanner } from "@/components/supplier/supplier-invite-context-banner"
import { SupplierProductAddHub } from "@/components/supplier/supplier-product-add-hub"
import { SupplierProductWizardV2 } from "@/components/supplier/wizard-v2/supplier-product-wizard-v2"
import { BentoContainer } from "@/components/affisell/bento-ui"
import { useSafeAppRouter } from "@/hooks/use-safe-app-router"
import type { ProductWizardVersion } from "@/lib/product-wizard-v2/feature-flag"

/**
 * Single product listing flow by default (`?compose=1`).
 * Optional hub for bulk / assist entry points: `?hub=1`.
 */
export function SupplierProductsNewShell({
  ownerUserId,
  wizardVersion,
}: {
  ownerUserId: string
  wizardVersion: ProductWizardVersion
}) {
  const tForm = useTranslations("supplier.form")
  const { replace, mounted } = useSafeAppRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")?.trim() ?? ""
  const draftQs = searchParams.get("draft")?.trim() ?? ""
  const assistQs = searchParams.get("assist") === "1"
  const hubQs = searchParams.get("hub") === "1"
  const composeQs = searchParams.get("compose") === "1"
  const fromInvite = searchParams.get("fromInvite") === "1"
  const wizardQs = searchParams.get("wizard")?.trim().toLowerCase()
  const [inviteCommissionHint, setInviteCommissionHint] = useState<number | null>(null)

  const useV2 = wizardVersion === "v2" || wizardQs === "v2"

  useEffect(() => {
    if (!mounted || hubQs || editId || composeQs) return
    const qs = new URLSearchParams(searchParams.toString())
    qs.set("compose", "1")
    replace(`/dashboard/supplier/products/new?${qs.toString()}`, { scroll: false })
  }, [composeQs, editId, hubQs, mounted, replace, searchParams])

  useEffect(() => {
    void fetch("/api/supplier/invitation-context", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { invitation?: { offeredCommissionPct?: number | null } | null } | null) => {
        const pct = j?.invitation?.offeredCommissionPct
        if (typeof pct === "number" && Number.isFinite(pct)) setInviteCommissionHint(pct)
      })
      .catch(() => {})
  }, [])

  function goHub() {
    replace("/dashboard/supplier/products/new?hub=1", { scroll: false })
  }

  function startListing(assist: boolean) {
    const qs = assist ? "assist=1&compose=1" : "compose=1"
    const draft = draftQs ? `&draft=${encodeURIComponent(draftQs)}` : ""
    replace(`/dashboard/supplier/products/new?${qs}${draft}`, { scroll: false })
  }

  if (hubQs && !editId && !useV2) {
    return (
      <SupplierProductAddHub
        onStartManual={() => startListing(false)}
        onStartWithAssist={() => startListing(true)}
      />
    )
  }

  if (useV2 && !editId) {
    return (
      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-4 py-12 text-center text-sm text-zinc-500">
            {tForm("loadingEditor")}
          </div>
        }
      >
        <SupplierProductWizardV2 ownerUserId={ownerUserId} />
      </Suspense>
    )
  }

  return (
    <>
      <BentoContainer maxWidth="6xl" className="pb-0 pt-6">
        <SupplierInviteContextBanner fromInviteQuery={fromInvite} />
      </BentoContainer>
      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-4 py-12 text-center text-sm text-zinc-500">
            {tForm("loadingEditor")}
          </div>
        }
      >
        <SupplierAddProductForm
          ownerUserId={ownerUserId}
          onBackToMethods={editId ? undefined : goHub}
          assistShortcuts={Boolean(assistQs) && !editId}
          inviteCommissionHint={inviteCommissionHint}
        />
      </Suspense>
    </>
  )
}
