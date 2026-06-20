import Link from "next/link"
import { redirect } from "next/navigation"

import {
  approveWooCommerceAuthAction,
  denyWooCommerceAuthAction,
} from "@/app/wc-auth/v1/authorize/actions"
import { auth } from "@/auth"
import { parseWooCommerceAuthParams } from "@/lib/woocommerce-compat/auth-params"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string
): string {
  const value = params[key]
  if (Array.isArray(value)) return value[0]?.trim() ?? ""
  return value?.trim() ?? ""
}

export default async function WooCommerceAuthorizePage({ searchParams }: Props) {
  const raw = await searchParams
  const parsed = parseWooCommerceAuthParams(
    new URLSearchParams({
      app_name: readParam(raw, "app_name"),
      scope: readParam(raw, "scope"),
      user_id: readParam(raw, "user_id"),
      return_url: readParam(raw, "return_url"),
      callback_url: readParam(raw, "callback_url"),
    })
  )

  if (!parsed.ok) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center p-8">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Connexion impossible</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-600">
            <p>
              Paramètres WooCommerce invalides ({parsed.error}). Relancez la connexion depuis AutoDS
              avec une URL de callback HTTPS (sans port).
            </p>
            <Link href="/admin/integrations/autods" className="text-violet-600 hover:underline">
              Guide AutoDS Affisell
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  const session = await auth()
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    const callback = `/wc-auth/v1/authorize?${new URLSearchParams({
      app_name: parsed.params.app_name,
      scope: parsed.params.scope,
      user_id: parsed.params.user_id,
      return_url: parsed.params.return_url,
      callback_url: parsed.params.callback_url,
    }).toString()}`
    redirect(`/login/admin?callbackUrl=${encodeURIComponent(callback)}`)
  }

  const approve = approveWooCommerceAuthAction.bind(null, parsed.params)
  const deny = denyWooCommerceAuthAction.bind(null, parsed.params)

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center bg-zinc-50 p-8 dark:bg-zinc-950">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Autoriser {parsed.params.app_name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-zinc-600 dark:text-zinc-400">
            <strong>{parsed.params.app_name}</strong> demande l&apos;accès à la boutique Affisell via
            l&apos;API WooCommerce (scope&nbsp;: <code>{parsed.params.scope}</code>).
          </p>
          <p className="text-zinc-600 dark:text-zinc-400">
            Connecté en tant qu&apos;admin&nbsp;: {session.user.email ?? session.user.id}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
            <li>Lire le statut boutique (validation AutoDS)</li>
            <li>Recevoir les mises à jour de tracking si AutoDS les pousse via WooCommerce</li>
            <li>Les commandes Affisell continuent d&apos;être envoyées via l&apos;API AutoDS interne</li>
          </ul>
          <div className="flex flex-wrap gap-3 pt-2">
            <form action={approve}>
              <Button type="submit">Approuver</Button>
            </form>
            <form action={deny}>
              <Button type="submit" variant="outline">
                Refuser
              </Button>
            </form>
          </div>
          <p className="text-xs text-zinc-500">
            Besoin d&apos;aide&nbsp;?{" "}
            <Link href="/admin/integrations/autods" className="text-violet-600 hover:underline">
              Configuration AutoDS
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
