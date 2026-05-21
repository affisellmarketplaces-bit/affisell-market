import { redirect } from "next/navigation"

import { ProviderForm } from "@/components/admin/provider-form"
import { auth } from "@/auth"
import {
  FulfillmentPaymentMethod,
  SupplierChannelType,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export default async function AdminEditProviderPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/providers")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const { id } = await params
  const row = await prisma.fulfillmentProvider.findUnique({ where: { id } })
  if (!row) redirect("/admin/providers")

  const apiConfig =
    row.apiConfig && typeof row.apiConfig === "object" && !Array.isArray(row.apiConfig)
      ? (row.apiConfig as Record<string, unknown>)
      : {}
  const apiEndpoint =
    typeof apiConfig.apiEndpoint === "string"
      ? apiConfig.apiEndpoint
      : typeof apiConfig.endpoint === "string"
        ? apiConfig.endpoint
        : ""

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Edit {row.name}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Slug: <code className="text-xs">{row.slug}</code>
          {row.credentialsEncrypted ? " · credentials sealed" : " · no credentials yet"}
        </p>
        <ProviderForm
          mode="edit"
          providerId={row.id}
          defaultValues={{
            name: row.name,
            type: row.channelType as SupplierChannelType,
            apiEndpoint,
            paymentMethod: row.paymentMethod as FulfillmentPaymentMethod,
            credentials: { apiKey: "", apiSecret: "" },
          }}
        />
      </div>
    </main>
  )
}
