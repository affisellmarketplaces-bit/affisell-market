import { Suspense } from "react"

import { PortalSignInForm } from "@/components/auth/portal-sign-in-form"

export default function AffiliateLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Chargement…</div>}>
      <PortalSignInForm
        portal="AFFILIATE"
        title="Espace Créateur"
        subtitle="Accède à ton dashboard créateur et à ton catalogue affilié"
        defaultCallback="/dashboard/affiliate"
        signupHref="/signup/affiliate"
        signupLabel="Créer mon espace créateur"
      />
    </Suspense>
  )
}
