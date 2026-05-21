import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Sparkles } from "lucide-react"

import { auth } from "@/auth"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

type Props = { searchParams?: Promise<{ welcome?: string }> | { welcome?: string } }

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const t = await getTranslations("success")
  const session = await auth()
  const sp = searchParams instanceof Promise ? await searchParams : searchParams
  const welcome = sp?.welcome === "1"

  if (session?.user?.id && session.user.role === "CUSTOMER") {
    redirect(welcome ? "/marketplace/account/wallet?welcome=1" : "/marketplace/account/wallet")
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
        <Sparkles className="h-7 w-7" aria-hidden />
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{t("purchaseTitle")}</h1>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{t("purchaseBody")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/#explorer" className={cn(buttonVariants({ variant: "bentoAccent", size: "bento" }))}>
          {t("continueShopping")}
        </Link>
        <Link href="/cart" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
          {t("myCart")}
        </Link>
      </div>
    </main>
  )
}
