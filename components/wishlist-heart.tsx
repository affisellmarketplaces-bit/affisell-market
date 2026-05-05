"use client"

import { useEffect, useState } from "react"

type Props = {
  productId: string
  className?: string
}

export function WishlistHeart({ productId, className }: Props) {
  const [wished, setWished] = useState(false)
  const [dropPercent, setDropPercent] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const res = await fetch(`/api/wishlist?productId=${encodeURIComponent(productId)}`)
        if (!res.ok) return
        const data = (await res.json()) as { wished?: boolean; dropPercent?: number }
        if (!active) return
        setWished(Boolean(data.wished))
        setDropPercent(Number(data.dropPercent ?? 0))
      } catch {
        // ignore
      }
    })()
    return () => {
      active = false
    }
  }, [productId])

  async function toggle() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch("/api/wishlist/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      })
      if (res.status === 401) {
        window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`
        return
      }
      if (!res.ok) return
      const data = (await res.json()) as { wished?: boolean }
      setWished(Boolean(data.wished))
      if (!data.wished) setDropPercent(0)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        aria-label={wished ? "Retirer de la wishlist" : "Ajouter à la wishlist"}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void toggle()
        }}
        disabled={busy}
        className={
          wished
            ? "rounded-full bg-rose-500/95 px-2 py-1 text-xs font-bold text-white shadow"
            : "rounded-full bg-black/55 px-2 py-1 text-xs font-bold text-white shadow"
        }
      >
        {wished ? "♥" : "♡"}
      </button>
      {wished && dropPercent > 0 ? (
        <p className="mt-1 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          🔔 -{dropPercent}% depuis hier
        </p>
      ) : null}
    </div>
  )
}
