export type ReviewMediaItem = {
  type: "image" | "video"
  url: string
  blurhash?: string
  width?: number
  height?: number
  duration?: number
  muxPlaybackId?: string
}

export type ReviewSort = "top" | "recent" | "rating_desc" | "with_media"

export type ReviewListItem = {
  id: string
  rating: number
  title: string | null
  body: string
  media: ReviewMediaItem[]
  verified: boolean
  helpfulCount: number
  viewCount: number
  sentiment: string | null
  createdAt: string
  publishedAt: string | null
  user: {
    id: string
    name: string | null
    image: string | null
    totalReviews: number
  } | null
  author: string | null
  myVote: "HELPFUL" | "UNHELPFUL" | null
  reply: {
    body: string
    createdAt: string
    user: { name: string | null; image: string | null }
  } | null
}

export type ReviewsListResponse = {
  items: ReviewListItem[]
  nextCursor: string | null
  total: number
  summary: {
    averageRating: number
    reviewCount: number
    ugcCount: number
    distribution: Record<number, number>
    aiSummary: string | null
  }
}
