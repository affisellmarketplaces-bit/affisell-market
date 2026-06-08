import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarClock, CalendarPlus, MapPin, ShieldCheck } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { BookingPassQrImage } from "@/components/booking/booking-pass-qr-image"
import { buildBookingPassAbsoluteUrl, generateBookingPassQrDataUrl } from "@/lib/booking/pass-qr"
import { parseBookingSnapshot } from "@/lib/booking/snapshot"
import { isBookableListingKind, isExperienceListingKind } from "@/lib/booking/types"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ token: string }> }

export default async function BookingPassPage({ params }: Props) {
  const { token } = await params
  const trimmed = token?.trim()
  if (!trimmed || trimmed.length < 16) notFound()

  const order = await prisma.order.findFirst({
    where: { bookingToken: trimmed },
    select: {
      id: true,
      bookingSnapshot: true,
      bookingConfirmedAt: true,
      bookingCancelledAt: true,
      listingKindSnapshot: true,
      buyerLocale: true,
      quantity: true,
      product: { select: { name: true, images: true } },
    },
  })

  if (!order?.bookingConfirmedAt || order.bookingCancelledAt) notFound()
  if (!isBookableListingKind(order.listingKindSnapshot)) notFound()

  const snapshot = parseBookingSnapshot(order.bookingSnapshot)
  if (!snapshot) notFound()

  const locale = resolveEmailLocale(order.buyerLocale)
  const t = await getTranslations({ locale, namespace: "BookingPass" })
  const title = isExperienceListingKind(order.listingKindSnapshot)
    ? t("titleExperience")
    : t("titleService")

  const cover = order.product.images[0] ?? null
  const startsAt = new Date(snapshot.startsAt)
  const endsAt = new Date(snapshot.endsAt)
  const passUrl = buildBookingPassAbsoluteUrl(trimmed)
  const qrDataUrl = await generateBookingPassQrDataUrl(passUrl)
  const dateLocale = locale === "fr" ? "fr-FR" : locale === "de" ? "de-DE" : "en-GB"

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#050810] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(6,182,212,0.28),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_85%,rgba(124,58,237,0.14),transparent_45%)]" />

      <div className="relative mx-auto flex max-w-lg flex-col px-4 py-12 sm:py-16">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-400">
          {t("badge")}
        </p>
        <h1 className="mt-4 text-center text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-zinc-400">
          {t("subtitle")}
        </p>

        <div className="mt-10 overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-cyan-950/80 to-zinc-950/90 p-6 shadow-[0_0_100px_-30px_rgba(6,182,212,0.7)] backdrop-blur-xl">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              className="mx-auto h-28 w-28 rounded-2xl object-cover ring-2 ring-cyan-400/30"
            />
          ) : null}
          <h2 className="mt-5 text-center text-xl font-semibold text-cyan-50">{order.product.name}</h2>
          {snapshot.label ? (
            <p className="mt-1 text-center text-sm text-zinc-400">{snapshot.label}</p>
          ) : null}
          <p className="mt-1 text-center text-xs text-zinc-500">
            {t("orderRef", { id: order.id.slice(0, 8), qty: order.quantity })}
          </p>

          <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm">
            <p className="flex items-center gap-2 text-zinc-200">
              <CalendarClock className="h-4 w-4 text-cyan-400" aria-hidden />
              {Number.isFinite(startsAt.getTime())
                ? startsAt.toLocaleString(dateLocale)
                : snapshot.startsAt}
              {Number.isFinite(endsAt.getTime())
                ? ` → ${endsAt.toLocaleTimeString(dateLocale)}`
                : null}
            </p>
            {snapshot.venueLabel ? (
              <p className="flex items-center gap-2 text-zinc-300">
                <MapPin className="h-4 w-4 text-emerald-400" aria-hidden />
                {snapshot.venueLabel}
              </p>
            ) : null}
            {snapshot.seatLabels.length > 0 ? (
              <p className="flex items-center gap-2 text-zinc-300">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  {t("seatsLabel")}
                </span>
                {snapshot.seatLabels.join(" · ")}
              </p>
            ) : null}
          </div>

          <BookingPassQrImage
            dataUrl={qrDataUrl}
            tokenPreview={`${trimmed.slice(0, 8).toUpperCase()}…`}
            qrAlt={t("qrAlt")}
          />

          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
            {t("confirmedAt", {
              date: new Date(order.bookingConfirmedAt).toLocaleString(dateLocale),
            })}
          </p>

          <a
            href={`/api/booking/pass/${encodeURIComponent(trimmed)}/ical`}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden />
            {t("addToCalendar")}
          </a>
        </div>

        <p className="mt-8 text-center text-xs text-zinc-600">
          <Link href="/marketplace/account/orders" className="text-cyan-400 hover:underline">
            {t("myOrders")}
          </Link>
        </p>
      </div>
    </main>
  )
}
