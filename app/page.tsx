import Link from "next/link"

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Affisell</h1>
      <p className="text-zinc-600 dark:text-zinc-400">Affiliate dropshipping marketplace V1.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href="/signup?role=SUPPLIER"
          className="rounded-lg bg-zinc-900 px-5 py-3 text-center text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Become Supplier
        </Link>
        <Link
          href="/signup?role=AFFILIATE"
          className="rounded-lg border border-zinc-300 px-5 py-3 text-center text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Become Affiliate
        </Link>
        <Link
          href="/marketplace"
          className="rounded-lg border border-zinc-300 px-5 py-3 text-center text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Browse Marketplace
        </Link>
      </div>
      <p className="mt-8 text-sm text-zinc-500">
        <Link href="/login" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">
          Sign in
        </Link>
      </p>
    </main>
  )
}
