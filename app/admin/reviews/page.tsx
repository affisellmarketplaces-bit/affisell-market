import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AdminReviewsClient } from "@/app/admin/reviews/admin-reviews-client"

export const dynamic = "force-dynamic"

export default async function AdminReviewsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/reviews")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Review moderation</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Trust Engine — AI-flagged and pending buyer reviews.
        </p>
        <AdminReviewsClient />
      </div>
    </main>
  )
}
