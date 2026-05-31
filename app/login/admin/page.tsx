import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AdminAuthActions } from "@/components/admin/admin-auth-actions"
import { PortalSignInForm } from "@/components/auth/portal-sign-in-form"
import { auth } from "@/auth"
import { sanitizeInternalCallbackUrl } from "@/lib/auth-login-portal"
import { resolvePostLoginRedirect } from "@/lib/login-redirect"

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const sp = await searchParams
  const callbackUrl = sanitizeInternalCallbackUrl(sp.callbackUrl) ?? "/admin/auto-fulfill"
  const session = await auth()
  const role = session?.user?.role

  if (session?.user?.id && role === "ADMIN") {
    redirect(resolvePostLoginRedirect("ADMIN", callbackUrl))
  }

  const user = session?.user
    ? { email: session.user.email ?? null, name: session.user.name ?? null }
    : null

  return (
    <div className="relative min-h-screen">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm font-bold text-violet-700 dark:text-violet-300">Affisell Admin</p>
        <AdminAuthActions user={user} />
      </header>
      <Suspense
        fallback={
          <div className="flex min-h-[80vh] items-center justify-center text-sm text-zinc-500">
            Chargement…
          </div>
        }
      >
        <PortalSignInForm
        portal={null}
        title="Connexion Affisell Admin"
        subtitle="Accès plateforme : auto-fulfill, commandes, fournisseurs API."
        defaultCallback="/admin/auto-fulfill"
        signupHref="/login"
        signupLabel="Retour"
        showSocialSignIn={false}
        />
      </Suspense>
    </div>
  )
}
