"use client"

import Image from "next/image"
import Link from "next/link"
import { Heart, Share2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { primaryProductImage } from "@/lib/product-images"
import { formatStoreDateTime } from "@/lib/market-config"

export type StoreFeedPost = {
  id: string
  content: string
  images: string[]
  likes: number
  createdAt: string
  productId: string | null
  product: { id: string; name: string; images: string[] } | null
}

type Props = {
  storeSlug: string
  posts: StoreFeedPost[]
}

export function StoreFeed({ storeSlug, posts }: Props) {
  const router = useRouter()

  async function like(id: string) {
    const res = await fetch(`/api/community/post/${encodeURIComponent(id)}/like`, { method: "POST" })
    if (res.ok) router.refresh()
  }

  async function sharePost(post: StoreFeedPost) {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/store/${encodeURIComponent(storeSlug)}#post-${post.id}`
        : ""
    const title = post.content.slice(0, 80)
    try {
      if (navigator.share) await navigator.share({ title, url })
      else await navigator.clipboard.writeText(url)
    } catch {
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        /* ignore */
      }
    }
  }

  if (posts.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
        No community posts yet. New products from this supplier appear here automatically.
      </p>
    )
  }

  return (
    <ul className="space-y-6">
      {posts.map((p) => (
        <li
          key={p.id}
          id={`post-${p.id}`}
          className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <p className="whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-100">{p.content}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {formatStoreDateTime(p.createdAt)}
            </p>
          </div>

          {p.images.length > 0 ? (
            <div className="grid gap-2 p-3 sm:grid-cols-2">
              {p.images.slice(0, 6).map((url, i) => (
                <div key={`${url}-${i}`} className="relative aspect-video overflow-hidden rounded-xl bg-zinc-50 dark:bg-zinc-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(ev) => {
                      ev.currentTarget.src = "/placeholder.png"
                    }}
                  />
                </div>
              ))}
            </div>
          ) : null}

          {p.product ? (
            <div className="flex flex-wrap gap-4 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <Image
                  src={primaryProductImage(p.product.images) || "/placeholder.png"}
                  alt=""
                  fill
                  className="object-contain p-1"
                  sizes="56px"
                  unoptimized={(primaryProductImage(p.product.images) || "").startsWith("http")}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Featured product</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{p.product.name}</p>
                <Link href="/marketplace" className="mt-1 text-xs font-medium text-teal-700 underline">
                  Browse on marketplace →
                </Link>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-zinc-100 px-4 py-2 dark:border-zinc-800">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              onClick={() => void like(p.id)}
            >
              <Heart className="h-4 w-4 text-red-500" /> Like · {p.likes}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              onClick={() => void sharePost(p)}
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
