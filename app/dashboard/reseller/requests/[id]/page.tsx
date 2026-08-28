import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"

import { ResellerQuotesComparator } from "@/components/requests/ResellerQuotesComparator"
import { requireAffiliateSession } from "@/lib/dashboard-session"
import { formatProductRequestRelativeTime } from "@/lib/product-request-i18n"
import {
  formatProductRequestCountries,
  parseProductRequestComplianceRequirements,
  productRequestProvenanceDisplay,
  resolveProductRequestCountries,
  serializeProductQuote,
} from "@/lib/product-request-types"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type PageProps = { params: Promise<{ id: string }> }

export default async function ResellerRequestDetailPage({ params }: PageProps) {
  const session = await requireAffiliateSession("/dashboard/reseller/requests")
  const { id } = await params
  const [t, tCat, tStatus, tDetail, tProv, tCompliance, locale] = await Promise.all([
    getTranslations("productRequests"),
    getTranslations("productRequests.categories"),
    getTranslations("productRequests.status"),
    getTranslations("productRequests.reseller.detail"),
    getTranslations("productRequests.provenance"),
    getTranslations("productRequests.compliance"),
    getLocale(),
  ])

  const request = await prisma.productRequest.findFirst({
    where: { id, resellerId: session.user.id },
  })
  if (!request) notFound()

  const countries = resolveProductRequestCountries(request)
  const provenanceLabel = productRequestProvenanceDisplay(request, (key) => tProv(key))
  const complianceIds = parseProductRequestComplianceRequirements(
    request.complianceRequirements
  )

  const quotes = await prisma.productQuote.findMany({
    where: { requestId: id },
    orderBy: { price: "asc" },
  })

  const acceptedQuote = quotes.find((q) => q.status === "accepted")
  const existingReview = acceptedQuote
    ? await prisma.deliveryReview.findUnique({
        where: {
          resellerId_quoteId: {
            resellerId: session.user.id,
            quoteId: acceptedQuote.id,
          },
        },
        select: { id: true, quoteId: true },
      })
    : null

  const tag = `request:${id}`
  const listing = await prisma.affiliateProduct.findFirst({
    where: {
      affiliateId: session.user.id,
      customDescription: { contains: tag },
    },
    select: { id: true },
  })

  const statusKey =
    request.status === "open" || request.status === "fulfilled" ? request.status : "closed"

  return (
    <main className="min-h-[calc(100dvh-3.75rem)] bg-zinc-50/80 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/dashboard/reseller/requests"
              className="text-xs font-semibold text-zinc-500 hover:underline"
            >
              {tDetail("backLink")}
            </Link>
            <h1 className="mt-2 text-xl font-bold text-zinc-900">{request.title}</h1>
            <p className="mt-1 text-xs text-zinc-500">
              {formatProductRequestCountries(countries)} · {tCat(request.category)} ·{" "}
              {provenanceLabel} · {request.quantity} {t("common.pieces")} ·{" "}
              {formatProductRequestRelativeTime(request.createdAt, locale)}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
              statusKey === "open"
                ? "bg-emerald-50 text-emerald-700"
                : statusKey === "fulfilled"
                  ? "bg-violet-50 text-violet-700"
                  : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {tStatus(statusKey)}
          </span>
        </div>

        {request.description ? (
          <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 whitespace-pre-wrap">
            {request.description}
          </p>
        ) : null}

        {complianceIds.length > 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 px-4 py-3">
            <p className="text-xs font-semibold text-emerald-950">{t("common.complianceLabel")}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {complianceIds.map((id) => (
                <li
                  key={id}
                  className="rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-emerald-900"
                >
                  {tCompliance(`${id}.title`)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <ResellerQuotesComparator
          requestId={request.id}
          requestStatus={request.status}
          requestCountries={countries}
          quotes={quotes.map(serializeProductQuote)}
          winningListingId={listing?.id ?? null}
          alreadyReviewedQuoteId={existingReview?.quoteId ?? null}
        />
      </div>
    </main>
  )
}
