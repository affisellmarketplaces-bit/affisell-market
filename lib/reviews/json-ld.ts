import type { ReviewListItem } from "@/lib/reviews/types"

export function buildAggregateRatingJsonLd(input: {
  productName: string
  averageRating: number
  reviewCount: number
  url?: string
}) {
  if (input.reviewCount < 1) return null
  return {
    "@type": "AggregateRating",
    ratingValue: input.averageRating.toFixed(1),
    reviewCount: input.reviewCount,
    bestRating: 5,
    worstRating: 1,
  }
}

export function buildReviewJsonLd(review: ReviewListItem, productName: string, productUrl: string) {
  const authorName = review.user?.name ?? review.author ?? "Verified buyer"
  return {
    "@type": "Review",
    "@id": `${productUrl}#review-${review.id}`,
    author: { "@type": "Person", name: authorName },
    datePublished: review.publishedAt ?? review.createdAt,
    reviewRating: {
      "@type": "Rating",
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 1,
    },
    name: review.title ?? undefined,
    reviewBody: review.body,
    itemReviewed: { "@type": "Product", name: productName },
  }
}
