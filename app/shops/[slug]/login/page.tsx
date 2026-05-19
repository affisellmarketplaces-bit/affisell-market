import { Suspense } from "react"

import { PortalSignInForm } from "@/components/auth/portal-sign-in-form"
import { loadAffiliateShopStore } from "@/lib/shop-storefront-data"

export default async function ShopBuyerLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const store = await loadAffiliateShopStore(slug).catch(() => null)
  const storeName = store?.name ?? slug

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Chargement…</div>}>
      <PortalSignInForm
        portal={null}
        title={`Mon compte ${storeName}`}
        subtitle="Connectez-vous pour suivre vos commandes auprès de ce créateur."
        defaultCallback={`/shops/${slug}/account`}
        signupHref="/signup/customer"
        signupLabel="Créer un compte acheteur"
        showSocialSignIn
      />
    </Suspense>
  )
}
