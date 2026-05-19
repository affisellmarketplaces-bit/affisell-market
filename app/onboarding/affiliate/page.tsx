import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default async function AffiliateOnboardingPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login/affiliate")
  }
  if (session.user.role !== "AFFILIATE") {
    redirect("/login")
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Bienvenue, créateur</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        Votre espace est prêt. Explorez le catalogue affilié et ajoutez vos premiers produits à votre boutique.
      </p>
      <Link href="/marketplace" className={cn(buttonVariants({ size: "lg" }), "mt-8")}>
        Accéder au marketplace →
      </Link>
    </div>
  )
}
