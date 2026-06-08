import Link from "next/link"
import { notFound } from "next/navigation"
import { Sparkles, ExternalLink, ShieldCheck } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { isDigitalListingKind } from "@/lib/digital-delivery/types"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ token: string }> }

export default async function DigitalAccessPassPage({ params }: Props) {
  const { token } = await params
  const trimmed = token?.trim()
  if (!trimmed || trimmed.length < 16) notFound()

  const order = await prisma.order.findFirst({
    where: { digitalAccessToken: trimmed },
    select: {
      id: true,
      digitalAccessUrl: true,
      digitalAccessInstructions: true,
      digitalDeliveredAt: true,
      listingKindSnapshot: true,
      product: { select: { name: true, images: true } },
    },
  })

  if (!order?.digitalDeliveredAt || !order.digitalAccessUrl) notFound()
  if (!isDigitalListingKind(order.listingKindSnapshot)) notFound()

  const cover = order.product.images[0] ?? null

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#07070d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(124,58,237,0.35),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(6,182,212,0.12),transparent_45%)]" />

      <div className="relative mx-auto flex max-w-lg flex-col px-4 py-12 sm:py-16">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.35em] text-violet-400">
          Affisell Digital Pass
        </p>
        <h1 className="mt-4 text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Accès instantané
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-zinc-400">
          Votre formation est débloquée. Ce passe est personnel — ne le partagez pas publiquement.
        </p>

        <div className="mt-10 overflow-hidden rounded-3xl border border-violet-500/30 bg-gradient-to-b from-violet-950/80 to-zinc-950/90 p-6 shadow-[0_0_100px_-30px_rgba(124,58,237,0.8)] backdrop-blur-xl">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              className="mx-auto h-28 w-28 rounded-2xl object-cover ring-2 ring-violet-400/30"
            />
          ) : null}
          <h2 className="mt-5 text-center text-xl font-semibold text-violet-50">{order.product.name}</h2>
          <p className="mt-1 text-center text-xs text-zinc-500">Commande {order.id.slice(0, 8)}…</p>

          <Link
            href={order.digitalAccessUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 text-center text-sm font-semibold text-white shadow-lg shadow-violet-900/50 transition hover:from-violet-500 hover:to-indigo-500"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Ouvrir ma formation
            <ExternalLink className="h-4 w-4 opacity-80" aria-hidden />
          </Link>

          {order.digitalAccessInstructions ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Instructions
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                {order.digitalAccessInstructions}
              </p>
            </div>
          ) : null}

          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
            Livré instantanément · {new Date(order.digitalDeliveredAt).toLocaleString()}
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-zinc-600">
          <Link href="/marketplace/account/orders" className="text-violet-400 hover:underline">
            Mes commandes
          </Link>
        </p>
      </div>
    </main>
  )
}
