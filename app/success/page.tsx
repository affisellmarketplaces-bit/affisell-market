"use client"

import Link from "next/link"
import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

import { BentoCard, BentoContainer } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type VerifyPayload = {
  paid?: boolean
  fulfilled?: boolean
  orderId?: string | null
  orderIds?: string[]
  error?: string
}

function SuccessContent() {
  const searchParams = useSearchParams()
  const handled = useRef(false)
  const [payload, setPayload] = useState<VerifyPayload | null>(null)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const sessionId = searchParams.get("session_id")
    if (!sessionId) {
      setPayload({ error: "missing_session" })
      return
    }

    fetch(`/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`)
      .then((res) => res.json())
      .then((data: VerifyPayload) => setPayload(data))
      .catch(() => setPayload({ error: "verify_failed" }))
  }, [searchParams])

  if (!payload) {
    return (
      <BentoContainer maxWidth="4xl" className="py-16">
        <BentoCard>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Confirmation du paiement…</p>
        </BentoCard>
      </BentoContainer>
    )
  }

  if (payload.error) {
    return (
      <BentoContainer maxWidth="4xl" className="py-16">
        <BentoCard className="space-y-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Paiement reçu</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Nous n&apos;avons pas pu afficher le détail tout de suite. Consultez l&apos;e-mail de
            confirmation ou connectez-vous pour voir vos commandes.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login?callbackUrl=/marketplace/account/orders" className={cn(buttonVariants())}>
              Se connecter
            </Link>
            <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
              Accueil
            </Link>
          </div>
        </BentoCard>
      </BentoContainer>
    )
  }

  const orderCount = payload.orderIds?.length ?? (payload.orderId ? 1 : 0)

  return (
    <BentoContainer maxWidth="4xl" className="py-16">
      <BentoCard className="space-y-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-violet-600 dark:text-violet-400">
            Paiement confirmé
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
            Merci pour votre achat
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            {payload.fulfilled
              ? orderCount > 1
                ? `${orderCount} commandes ont été enregistrées. Un e-mail de confirmation vous a été envoyé.`
                : "Votre commande est enregistrée. Un e-mail de confirmation vous a été envoyé."
              : "Votre paiement est confirmé. La commande apparaîtra dans quelques instants dans votre compte."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/marketplace/account/orders"
            className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }))}
          >
            Voir mes commandes
          </Link>
          <Link
            href="/login?callbackUrl=/marketplace/account/orders"
            className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}
          >
            Se connecter
          </Link>
          <Link href="/shops/browse" className={cn(buttonVariants({ variant: "ghost", size: "bento" }))}>
            Continuer les achats
          </Link>
        </div>
      </BentoCard>
    </BentoContainer>
  )
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <BentoContainer maxWidth="4xl" className="py-16">
          <BentoCard>
            <p className="text-sm text-zinc-600">Confirmation du paiement…</p>
          </BentoCard>
        </BentoContainer>
      }
    >
      <SuccessContent />
    </Suspense>
  )
}
