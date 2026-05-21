import type { Review, ReviewReply, ReviewVote, User, VoteType } from "@prisma/client"

import { legacyImagesToMedia, parseReviewMedia } from "@/lib/reviews/media"
import type { ReviewListItem } from "@/lib/reviews/types"

type Row = Review & {
  user: Pick<User, "id" | "name" | "image"> | null
  votes: Pick<ReviewVote, "type">[]
  reply: (ReviewReply & { user: Pick<User, "name" | "image"> }) | null
  _count?: { userReviews?: number }
}

export function displayAuthor(review: Pick<Review, "author">, user?: Pick<User, "name"> | null): string {
  if (user?.name?.trim()) return user.name.trim()
  if (review.author?.trim()) return review.author.trim()
  return "Verified buyer"
}

export function serializeReview(
  review: Row,
  opts?: { myVote?: VoteType | null; totalReviews?: number }
): ReviewListItem {
  const media = [
    ...parseReviewMedia(review.media),
    ...legacyImagesToMedia(review.images).filter(
      (m) => !parseReviewMedia(review.media).some((x) => x.url === m.url)
    ),
  ]

  return {
    id: review.id,
    rating: review.rating,
    title: review.title,
    body: review.body,
    media,
    verified: review.verified,
    helpfulCount: review.helpfulCount,
    viewCount: review.viewCount,
    sentiment: review.sentiment,
    createdAt: review.createdAt.toISOString(),
    publishedAt: review.publishedAt?.toISOString() ?? null,
    user: review.user
      ? {
          id: review.user.id,
          name: review.user.name,
          image: review.user.image,
          totalReviews: opts?.totalReviews ?? 0,
        }
      : null,
    author: review.author,
    myVote: opts?.myVote ?? review.votes[0]?.type ?? null,
    reply: review.reply
      ? {
          body: review.reply.body,
          createdAt: review.reply.createdAt.toISOString(),
          user: { name: review.reply.user.name, image: review.reply.user.image },
        }
      : null,
  }
}
