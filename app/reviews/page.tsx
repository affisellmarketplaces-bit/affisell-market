import Link from "next/link"

import { prisma } from "@/lib/prisma"
import { parseReviewMedia } from "@/lib/reviews/media"

export const revalidate = 120

/** TikTok-style vertical UGC reel feed (published video reviews). */
export default async function ReviewsReelsPage() {
  const rows = await prisma.review.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 24,
    select: {
      id: true,
      body: true,
      rating: true,
      media: true,
      product: { select: { id: true, name: true } },
      user: { select: { name: true } },
      author: true,
    },
  })

  const clips = rows.flatMap((r) => {
    const media = parseReviewMedia(r.media).filter((m) => m.type === "video")
    return media.map((m) => ({
      reviewId: r.id,
      url: m.url,
      productName: r.product.name,
      productId: r.product.id,
      author: r.user?.name ?? r.author ?? "Buyer",
      body: r.body.slice(0, 120),
      rating: r.rating,
    }))
  })

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-black/80 px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-bold">UGC Reels</h1>
          <Link href="/" className="text-sm text-violet-300 hover:underline">
            Home
          </Link>
        </div>
      </header>
      <div className="mx-auto flex max-w-lg flex-col snap-y snap-mandatory">
        {clips.length === 0 ? (
          <p className="px-6 py-20 text-center text-sm text-white/60">No video reviews yet.</p>
        ) : (
          clips.map((c) => (
            <article
              key={`${c.reviewId}-${c.url}`}
              className="relative aspect-[9/16] w-full snap-start overflow-hidden border-b border-white/10"
            >
              <video src={c.url} className="h-full w-full object-cover" playsInline muted loop autoPlay />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                <p className="text-sm font-semibold">{c.productName}</p>
                <p className="text-xs text-white/70">{c.author} · {c.rating}★</p>
                <p className="mt-1 line-clamp-2 text-xs text-white/80">{c.body}</p>
                <Link
                  href={`/marketplace?product=${c.productId}`}
                  className="mt-2 inline-block text-xs font-semibold text-violet-300"
                >
                  View product →
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </main>
  )
}
