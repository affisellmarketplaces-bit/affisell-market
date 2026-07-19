"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Radar } from "lucide-react"

import { NavPill } from "@/components/navigation/nav-pill"
import { parseSupplierKind, type SupplierKind } from "@/lib/supplier-kind"

type Variant = "supplier" | "affiliate"

type Props = {
  variant: Variant
}

function supplierRadarLabel(kind: SupplierKind): { label: string; shortLabel: string } {
  if (kind === "stocker") return { label: "Radar - Attaque", shortLabel: "Attaque" }
  if (kind === "producer") return { label: "Radar - Défense", shortLabel: "Défense" }
  return { label: "Radar - Débloquer", shortLabel: "Radar" }
}

/**
 * Discovery nav entry — 2nd after Dashboard. Safe if kind/API missing.
 */
export function RadarNavPill({ variant }: Props) {
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
        label="Radar Produits Chauds"
        shortLabel="Radar"
        icon={Radar}
        active={onRadar}
        showNewBadge
      />
    )
  }

  const { label, shortLabel } = supplierRadarLabel(kind)
  return (
    <NavPill
      href="/radar"
      label={label}
      shortLabel={shortLabel}
      icon={Radar}
      active={onRadar}
      showNewBadge
    />
  )
}
