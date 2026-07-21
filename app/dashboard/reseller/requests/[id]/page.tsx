import Link from "next/link"
import { notFound } from "next/navigation"

import { ResellerQuotesComparator } from "@/components/requests/ResellerQuotesComparator"
import { requireAffiliateSession } from "@/lib/dashboard-session"
import { formatRequestRelativeFr, serializeProductQuote } from "@/lib/product-request-types"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type PageProps = { params: Promise<{ id: string }> }

export default async function ResellerRequestDetailPage({ params }: PageProps) {
  const session = await requireAffiliateSession("/dashboard/reseller/requests")
  const { id } = await params

  const request = await prisma.productRequest.findFirst({
    where: { id, resellerId: session.user.id },
  })
  if (!request) notFound()

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

  return (
    <main className="min-h-[calc(100dvh-3.75rem)] bg-zinc-50/80 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/dashboard/reseller/requests"
              className="text-xs font-semibold text-zinc-500 hover:underline"
            >
              ← Mes demandes
            </Link>
            <h1 className="mt-2 text-xl font-bold text-zinc-900">{request.title}</h1>
            <p className="mt-1 text-xs text-zinc-500">
              {request.country} · {request.category} · {request.quantity} pcs ·{" "}
              {formatRequestRelativeFr(request.createdAt)}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
              request.status === "open"
                ? "bg-emerald-50 text-emerald-700"
                : request.status === "fulfilled"
                  ? "bg-violet-50 text-violet-700"
                  : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {request.status}
          </span>
        </div>

        {request.description ? (
          <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 whitespace-pre-wrap">
            {request.description}
          </p>
        ) : null}

        <ResellerQuotesComparator
          requestId={request.id}
          requestStatus={request.status}
          requestCountry={request.country}
          quotes={quotes.map(serializeProductQuote)}
          winningListingId={listing?.id ?? null}
          alreadyReviewedQuoteId={existingReview?.quoteId ?? null}
        />
      </div>
    </main>
  )
}
