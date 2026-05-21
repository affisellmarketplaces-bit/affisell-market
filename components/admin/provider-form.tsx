"use client"

import {
  FulfillmentPaymentMethod,
  SupplierChannelType,
} from "@prisma/client"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"

import { providerFormSchema, type ProviderFormValues } from "@/lib/admin/providers/schemas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const CHANNEL_OPTIONS = Object.values(SupplierChannelType)
const PAYMENT_OPTIONS = Object.values(FulfillmentPaymentMethod)

type Props = {
  mode: "create" | "edit"
  providerId?: string
  defaultValues?: Partial<ProviderFormValues>
}

export function ProviderForm({ mode, providerId, defaultValues }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      name: "",
      type: SupplierChannelType.AFFISELL_NATIVE,
      apiEndpoint: "",
      paymentMethod: FulfillmentPaymentMethod.NONE,
      credentials: { apiKey: "", apiSecret: "" },
      ...defaultValues,
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form

  async function onSubmit(values: ProviderFormValues) {
    setError(null)
    const url =
      mode === "create" ? "/api/admin/providers" : `/api/admin/providers/${providerId}`
    const method = mode === "create" ? "POST" : "PATCH"

    const body =
      mode === "create"
        ? values
        : {
            name: values.name,
            type: values.type,
            apiEndpoint: values.apiEndpoint,
            paymentMethod: values.paymentMethod,
          }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
    if (!res.ok) {
      setError(data.message ?? data.error ?? "Save failed")
      return
    }

    const id =
      mode === "create"
        ? ((data as { row?: { id: string } }).row?.id ?? null)
        : providerId

    const hasCreds =
      values.credentials?.apiKey?.trim() || values.credentials?.apiSecret?.trim()
    if (id && hasCreds) {
      const sealRes = await fetch(`/api/admin/providers/${id}/seal-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          apiKey: values.credentials?.apiKey,
          apiSecret: values.credentials?.apiSecret,
        }),
      })
      if (!sealRes.ok) {
        const sealData = (await sealRes.json().catch(() => ({}))) as { message?: string }
        setError(sealData.message ?? "Credentials could not be sealed")
        return
      }
    }

    router.push("/admin/providers")
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-8 max-w-xl space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Name
        </Label>
        <Input id="name" bento {...register("name")} />
        {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="type" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Channel type
        </Label>
        <select
          id="type"
          className="flex h-12 w-full rounded-xl border border-gray-200 bg-white/50 px-4 text-sm dark:border-zinc-700 dark:bg-zinc-950/50"
          {...register("type")}
        >
          {CHANNEL_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="apiEndpoint"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          API endpoint (optional)
        </Label>
        <Input id="apiEndpoint" bento placeholder="https://partner.example.com" {...register("apiEndpoint")} />
        {errors.apiEndpoint ? (
          <p className="text-xs text-red-600">{errors.apiEndpoint.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="paymentMethod"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Payment method
        </Label>
        <select
          id="paymentMethod"
          className="flex h-12 w-full rounded-xl border border-gray-200 bg-white/50 px-4 text-sm dark:border-zinc-700 dark:bg-zinc-950/50"
          {...register("paymentMethod")}
        >
          {PAYMENT_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <legend className="px-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Credentials (AES-256-GCM at rest)
        </legend>
        <p className="text-xs text-zinc-500">
          Never stored in plaintext. Leave blank on edit to keep existing sealed keys.
        </p>
        <div className="space-y-2">
          <Label htmlFor="apiKey" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            API key
          </Label>
          <Input id="apiKey" type="password" bento autoComplete="off" {...register("credentials.apiKey")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="apiSecret" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            API secret
          </Label>
          <Input
            id="apiSecret"
            type="password"
            bento
            autoComplete="off"
            {...register("credentials.apiSecret")}
          />
        </div>
      </fieldset>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="bentoAccent" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : mode === "create" ? "Create provider" : "Save changes"}
        </Button>
        <Link href="/admin/providers" className="text-sm text-zinc-600 underline dark:text-zinc-400">
          Cancel
        </Link>
      </div>
    </form>
  )
}
