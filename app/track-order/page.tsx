import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { StoreTrackOrder } from "@/components/storefront/store-track-order"
import { buttonVariants } from "@/components/ui/button"
import {
  loginCustomerPath,
  MARKETPLACE_BUYER_ORDERS_PATH,
  signupCustomerPath,
} from "@/lib/login-redirect"
import { loadAffiliateShopStore } from "@/lib/shop-storefront-data"
import { getAffiliateStoreHostSlug } from "@/lib/storefront-buyer-host.server"
import { cn } from "@/lib/utils"

const ORDERS_CALLBACK = MARKETPLACE_BUYER_ORDERS_PATH

/** Reseller store behind this host (null on the platform, or if the store can no longer be loaded). */
async function loadStoreForHost() {
  const slug = await getAffiliateStoreHostSlug()
  if (!slug) return null
  const store = await loadAffiliateShopStore(slug).catch(() => null)
  return store ? { slug, store } : null
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.trackOrder")
  const host = await loadStoreForHost()
  if (host) {
    return {
      title: t("store.metaTitle", { store: host.store.name }),
      description: t("store.metaDescription", { store: host.store.name }),
    }
  }
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

export default async function TrackOrderPage() {
  const host = await loadStoreForHost()
  if (host) {
    return (
      <StoreTrackOrder
        storeSlug={host.slug}
        storeName={host.store.name}
        accent={host.store.theme.accent}
      />
    )
  }

  const t = await getTranslations("pages.trackOrder")
  const loginHref = loginCustomerPath(ORDERS_CALLBACK)
  const signupHref = signupCustomerPath(ORDERS_CALLBACK)

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="py-12">
        <BentoPageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        <BentoCard className="mt-8 space-y-4 p-6">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            <li>{t("stepLogin")}</li>
            <li>{t("stepOrders")}</li>
            <li>{t("stepEmail")}</li>
          </ol>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={loginHref}
              className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }))}
            >
              {t("signIn")}
            </Link>
            <Link href={signupHref} className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
              {t("createAccount")}
            </Link>
            <Link
              href={ORDERS_CALLBACK}
              className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}
            >
              {t("myOrders")}
            </Link>
            <Link href="/contact" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
              {t("contactSupport")}
            </Link>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("proNote")}{" "}
            <Link href="/login" className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
              {t("proLogin")}
            </Link>
          </p>
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}
