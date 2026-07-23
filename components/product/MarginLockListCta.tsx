"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { MarginLockBadge } from "@/components/product/MarginLockBadge"
import type { MarginLockDto } from "@/lib/margin/margin-lock-types"

type Props = {
  productId: string
  salePrice: number
  catalogHref: string
  initialLock?: MarginLockDto | null
}

/** CTA: create Margin Lock then open catalog / social hub. */
export function MarginLockListCta({ productId, salePrice, catalogHref, initialLock }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const listWithLock = async () => {
    setBusy(true)
    try {
      await fetch(`/api/products/${encodeURIComponent(productId)}/margin-lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salePrice }),
      })
      router.push(catalogHref)
    } catch {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <MarginLockBadge productId={productId} salePrice={salePrice} initialLock={initialLock} />
      <button
        type="button"
        disabled={busy}
        onClick={() => void listWithLock()}
        className="inline-flex rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-60"
      >
        {busy ? "Protection…" : "🔒 Lister avec prix protégé →"}
      </button>
      <Link href={catalogHref} className="text-xs text-white/50 underline">
        Lister sans protection →
      </Link>
    </div>
  )
}
