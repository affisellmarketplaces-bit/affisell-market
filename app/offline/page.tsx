import Link from "next/link"
import { WifiOff } from "lucide-react"

/** Offline fallback — precached by `public/sw.js` for buyer shell routes. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
        <WifiOff className="size-7" aria-hidden />
      </span>
      <h1 className="mt-5 text-xl font-bold text-zinc-900 dark:text-zinc-50">Hors ligne</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Retrouvez vos derniers produits en cache dès que la connexion revient, ou réessayez
        maintenant.
      </p>
      <Link
        href="/"
        className="affisell-premium-cta mt-6 inline-flex rounded-[1.2rem] px-6 py-3 text-sm font-semibold text-white"
      >
        Réessayer
      </Link>
    </main>
  )
}
