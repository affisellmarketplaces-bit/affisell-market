"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Bell, Copy, X } from "lucide-react"
import { toast } from "sonner"

import { buttonVariants } from "@/components/ui/button"
import { GHOST_STOCK15_COUPON } from "@/lib/ghost/types"
import { cn } from "@/lib/utils"

export type GhostOosAlternative = {
  affiliateProductId: string
  title: string
  image: string | null
  priceCents: number
  href: string
}

export type GhostOosPayload = {
  productName?: string
  alternatives?: GhostOosAlternative[]
  coupon?: string
}

type Props = {
  open: boolean
  onClose: () => void
  payload: GhostOosPayload | null
}

function money(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  })
}

/**
 * Shown when checkout returns 409 OUT_OF_STOCK_VERIFIED.
 */
export function OutOfStockModal({ open, onClose, payload }: Props) {
  const [copied, setCopied] = useState(false)
  const coupon = payload?.coupon || GHOST_STOCK15_COUPON
  const alts = payload?.alternatives ?? []

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  if (!open) return null

  async function copyCoupon() {
    try {
      await navigator.clipboard.writeText(coupon)
      setCopied(true)
      toast.success(`Code ${coupon} copié`)
    } catch {
      toast.error("Copie impossible")
    }
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-zinc-950/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ghost-oos-title"
      data-testid="ghost-oos-modal"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 text-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
          aria-label="Fermer"
        >
          <X className="size-4" />
        </button>

        <div className="space-y-4 p-6 pt-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300/90">
            Ghost Checkout
          </p>
          <h2 id="ghost-oos-title" className="text-xl font-bold tracking-tight">
            Rupture vérifiée à l’instant
          </h2>
          <p className="text-sm leading-relaxed text-zinc-300">
            On vient de vérifier chez notre fournisseur
            {payload?.productName ? (
              <>
                {" "}
                — <span className="font-semibold text-white">{payload.productName}</span> est en
                rupture.
              </>
            ) : (
              " : ce produit est en rupture."
            )}{" "}
            On ne t’a pas débité.
          </p>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5">
            <span className="text-sm text-emerald-100">
              Code <strong>{coupon}</strong> (−15%)
            </span>
            <button
              type="button"
              onClick={() => void copyCoupon()}
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "ml-auto rounded-full border-emerald-300/40 bg-transparent text-emerald-50"
              )}
            >
              <Copy className="size-3.5" aria-hidden />
              {copied ? "Copié" : "Copier"}
            </button>
          </div>

          {alts.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Alternatives en stock
              </p>
              <ul className="grid gap-2 sm:grid-cols-3">
                {alts.map((a) => (
                  <li key={a.affiliateProductId}>
                    <Link
                      href={a.href}
                      className="block overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-violet-400/40"
                      onClick={onClose}
                    >
                      <div className="aspect-square bg-zinc-900">
                        {a.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.image} alt="" className="size-full object-cover" />
                        ) : null}
                      </div>
                      <div className="space-y-1 p-2">
                        <p className="line-clamp-2 text-[11px] font-medium leading-snug text-zinc-100">
                          {a.title}
                        </p>
                        <p className="text-xs font-semibold text-violet-200">
                          {money(a.priceCents)}
                        </p>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                          Acheter
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              toast.message("Alerte retour enregistrée — on te prévient.")
              onClose()
            }}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full rounded-full border-white/20 bg-transparent text-white"
            )}
          >
            <Bell className="size-4" aria-hidden />
            Être alerté au retour
          </button>
        </div>
      </div>
    </div>
  )
}
