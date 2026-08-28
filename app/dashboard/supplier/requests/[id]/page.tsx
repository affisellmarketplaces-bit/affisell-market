import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"

import { SupplierTrustSelfCard } from "@/components/logistics/SupplierTrustSelfCard"
import { SupplierQuoteForm } from "@/components/requests/SupplierQuoteForm"
import { requireSupplierSession } from "@/lib/dashboard-session"
import { formatProductRequestRelativeTime } from "@/lib/product-request-i18n"
import {
  formatProductRequestCountries,
  parseProductRequestProvenance,
  productRequestProvenanceChipLabel,
  resolveProductRequestCountries,
  serializeProductQuote,
} from "@/lib/product-request-types"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type PageProps = { params: Promise<{ id: string }> }

export default async function SupplierRequestDetailPage({ params }: PageProps) {
  const session = await requireSupplierSession("/dashboard/supplier/requests")
  const { id } = await params
  const [t, tCat, tStatus, tDetail, tProv, locale] = await Promise.all([
    getTranslations("productRequests"),
    getTranslations("productRequests.categories"),
    getTranslations("productRequests.status"),
    getTranslations("productRequests.supplier.detail"),
    getTranslations("productRequests.provenance"),
    getLocale(),
  ])

  const request = await prisma.productRequest.findUnique({ where: { id } })
  if (!request) notFound()

  const countries = resolveProductRequestCountries(request)
  const provenance = parseProductRequestProvenance(request.sourceProvenance)

  const myQuote = await prisma.productQuote.findUnique({
    where: {
      requestId_supplierId: {
        requestId: id,
        supplierId: session.user.id,
      },
    },
  })

  const statusKey =
    request.status === "open" || request.status === "fulfilled" ? request.status : "closed"

  return (
    <main className="min-h-[calc(100dvh-3.75rem)] bg-zinc-50/80 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <SupplierTrustSelfCard supplierId={session.user.id} />
        <div>
          <Link
            href="/dashboard/supplier/requests"
            className="text-xs font-semibold text-zinc-500 hover:underline"
          >
            {tDetail("backLink")}
          </Link>
          <h1 className="mt-2 text-xl font-bold text-zinc-900">{request.title}</h1>
          <p className="mt-1 text-xs text-zinc-500">
            {formatProductRequestCountries(countries)} · {tCat(request.category)} ·{" "}
            {productRequestProvenanceChipLabel(provenance)} {tProv(provenance)} ·{" "}
            {request.quantity} {t("common.pieces")} ·{" "}
            {formatProductRequestRelativeTime(request.createdAt, locale)} · {tStatus(statusKey)}
            {request.quotesCount > 0
              ? ` · ${t("common.quotesCount", { count: request.quotesCount })}`
              : ""}
          </p>
        </div>

        {request.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={request.imageUrl}
            alt=""
            className="h-48 w-full rounded-xl object-cover"
          />
        ) : null}

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-sm text-zinc-700 whitespace-pre-wrap">
            {request.description || t("common.noDescription")}
          </p>
          <dl className="mt-4 grid gap-2 text-xs text-zinc-700 sm:grid-cols-2">
            <div className="flex justify-between gap-2">
              <dt>{t("common.targetPrice")}</dt>
              <dd className="font-semibold">
                {request.targetPrice != null
                  ? `${request.targetPrice}€`
                  : t("common.dash")}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>{t("common.provenanceLabel")}</dt>
              <dd className="font-semibold">
                {productRequestProvenanceChipLabel(provenance)} {tProv(provenance)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>{t("common.resellerLabel")}</dt>
              <dd className="truncate font-semibold">{request.resellerEmail}</dd>
            </div>
          </dl>
        </div>

        {request.status === "open" || myQuote ? (
          <SupplierQuoteForm
            requestId={request.id}
            requestCountries={countries}
            existingQuote={myQuote ? serializeProductQuote(myQuote) : null}
          />
        ) : (
          <p className="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-600">
            {tDetail("closed", { status: tStatus(statusKey) })}
          </p>
        )}
      </div>
    </main>
  )
}
