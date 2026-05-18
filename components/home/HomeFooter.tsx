import Link from "next/link"

export function HomeFooter() {
  return (
    <footer className="border-t border-zinc-200/90 bg-zinc-50/80 py-10 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
        <p className="text-sm text-zinc-500">© {new Date().getFullYear()} Affisell</p>
        <nav
          className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium"
          aria-label="Espace partenaires"
        >
          <div className="text-center sm:text-left">
            <p className="text-zinc-500">Tu es fournisseur ?</p>
            <Link href="/supplier" className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
              Ouvrir un compte fournisseur
            </Link>
          </div>
          <div className="text-center sm:text-left">
            <p className="text-zinc-500">Tu es créateur ?</p>
            <Link href="/affiliate" className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
              Devenir affilié
            </Link>
          </div>
        </nav>
      </div>
    </footer>
  )
}
