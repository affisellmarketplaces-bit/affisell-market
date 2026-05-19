import Image from "next/image"
import Link from "next/link"

type Props = {
  storeName: string
  logoUrl: string | null
  description?: string | null
}

export function ShopStoreHeader({ storeName, logoUrl, description }: Props) {
  return (
    <header className="border-b border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 sm:px-6">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 rounded-xl border border-zinc-200 object-cover dark:border-zinc-700"
            unoptimized
          />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-lg font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {storeName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Boutique</p>
          <h1 className="truncate text-xl font-bold text-zinc-900 dark:text-zinc-50">{storeName}</h1>
          {description ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
          ) : null}
        </div>
        <Link
          href="/shops"
          className="shrink-0 text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          Toutes les boutiques
        </Link>
      </div>
    </header>
  )
}
