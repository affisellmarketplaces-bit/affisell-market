import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function LoginSelectorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <h1 className="text-center text-3xl font-bold text-gray-900 dark:text-zinc-100">Connexion Affisell</h1>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-zinc-400">
          Choisissez votre espace professionnel. Les acheteurs se connectent depuis la boutique de leur créateur.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/login/affiliate"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-auto flex-col gap-2 py-6 text-center"
            )}
          >
            <span className="text-lg font-semibold">Je suis Créateur</span>
            <span className="text-xs font-normal opacity-90">Catalogue affilié &amp; boutique</span>
          </Link>
          <Link
            href="/login/supplier"
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "h-auto flex-col gap-2 border-emerald-200 py-6 text-center text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-100 dark:hover:bg-emerald-950/40"
            )}
          >
            <span className="text-lg font-semibold">Je suis Fournisseur</span>
            <span className="text-xs font-normal opacity-90">Produits &amp; commandes B2B</span>
          </Link>
        </div>

        <p className="mt-8 text-center text-sm text-gray-600 dark:text-zinc-400">
          Tu es acheteur ?{" "}
          <span className="font-medium text-gray-800 dark:text-zinc-200">
            Connecte-toi sur la boutique du créateur
          </span>{" "}
          (bouton « Mon compte » sur sa vitrine).
        </p>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-zinc-400">
          Pas encore de compte créateur ?{" "}
          <Link href="/signup/affiliate" className="font-medium text-violet-700 hover:underline dark:text-violet-300">
            Créer mon espace
          </Link>
        </p>
      </div>
    </div>
  )
}
