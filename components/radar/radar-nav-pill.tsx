"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Radar } from "lucide-react"
import { useTranslations } from "next-intl"

import { NavPill } from "@/components/navigation/nav-pill"
import { parseSupplierKind, type SupplierKind } from "@/lib/supplier-kind"

type Variant = "supplier" | "affiliate"

type Props = {
  variant: Variant
}

function supplierRadarKeys(kind: SupplierKind): { label: string; shortLabel: string } {
  if (kind === "stocker") return { label: "navWholesale", shortLabel: "navWholesaleShort" }
  if (kind === "producer") return { label: "navDefense", shortLabel: "navDefenseShort" }
  return { label: "navUnlock", shortLabel: "navUnlockShort" }
}

/**
 * Discovery nav entry — 2nd after Dashboard. Safe if kind/API missing.
 */
export function RadarNavPill({ variant }: Props) {
  const t = useTranslations("radarShell")
  const pathname = usePathname() ?? ""
  const onRadar = pathname === "/radar" || pathname.startsWith("/radar/")
  const [kind, setKind] = useState<SupplierKind>("unset")

  useEffect(() => {
    if (variant !== "supplier") return
    let cancelled = false
    void fetch("/api/supplier-profile/me", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return
        const data = (await res.json()) as { supplierKind?: unknown }
        if (!cancelled) setKind(parseSupplierKind(data.supplierKind))
      })
      .catch(() => {
        /* never crash nav */
      })
    return () => {
      cancelled = true
    }
  }, [variant])

  if (variant === "affiliate") {
    return (
      <NavPill
        href="/radar"
        label={t("navHot")}
        shortLabel={t("navUnlockShort")}
        icon={Radar}
        active={onRadar}
        showNewBadge
      />
    )
  }

  const keys = supplierRadarKeys(kind)
  return (
    <NavPill
      href="/radar"
      label={t(keys.label)}
      shortLabel={t(keys.shortLabel)}
      icon={Radar}
      active={onRadar}
      showNewBadge
    />
  )
}
