"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Truck } from "lucide-react"
import { useSession } from "next-auth/react"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

export const LIGHTNING_CARRIERS = [
  "Colissimo",
  "Chronopost",
  "Mondial Relay",
  "DHL",
  "Autre",
] as const

const markShippedFormSchema = z.object({
  trackingNumber: z.string().trim().min(1, "Numéro de suivi requis").max(120),
  trackingCarrier: z.enum(LIGHTNING_CARRIERS),
})

type MarkShippedFormValues = z.infer<typeof markShippedFormSchema>

export type SupplierOrderActionsOrder = {
  id: string
  fulfillmentStatus: string
  payoutStatus: string
  supplier: { userId: string }
}

type Props = {
  order: SupplierOrderActionsOrder
  className?: string
  onShipped?: () => void
}

type MarkShippedApiResponse = {
  success?: boolean
  payoutTriggered?: boolean
  error?: string
}

export function OrderActions({ order, className, onShipped }: Props) {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)

  const form = useForm<MarkShippedFormValues>({
    resolver: zodResolver(markShippedFormSchema),
    defaultValues: {
      trackingNumber: "",
      trackingCarrier: "Colissimo",
    },
  })

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form

  const isOwner = session?.user?.id === order.supplier.userId
  const canShow = status !== "loading" && isOwner && order.fulfillmentStatus !== "SHIPPED"
  const payoutPaid = order.payoutStatus === "PAID"

  if (!canShow) return null

  async function onSubmit(values: MarkShippedFormValues) {
    try {
      const res = await fetch(`/api/orders/${order.id}/mark-shipped`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      })
      const data = (await res.json().catch(() => ({}))) as MarkShippedApiResponse
      if (!res.ok || !data.success) {
        toast.error(data.error ?? "Impossible de marquer comme expédié")
        return
      }

      toast.success(
        data.payoutTriggered
          ? "Expédié. Lightning Payout déclenché"
          : "Expédié. Payout à J+2"
      )
      setOpen(false)
      reset()
      onShipped?.()
    } catch {
      toast.error("Erreur réseau")
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        className={cn("w-full gap-2", className)}
        disabled={payoutPaid || isSubmitting}
        onClick={() => setOpen(true)}
      >
        <Truck className="size-4" aria-hidden />
        Marquer expédié
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[min(88dvh,520px)] overflow-y-auto rounded-t-2xl p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Marquer expédié</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Commande <span className="font-mono text-xs">{order.id.slice(0, 10)}…</span>
          </p>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor={`tracking-carrier-${order.id}`}>Transporteur</Label>
              <Controller
                control={control}
                name="trackingCarrier"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                    <SelectTrigger id={`tracking-carrier-${order.id}`} className="w-full">
                      <SelectValue placeholder="Choisir un transporteur" />
                    </SelectTrigger>
                    <SelectContent>
                      {LIGHTNING_CARRIERS.map((carrier) => (
                        <SelectItem key={carrier} value={carrier}>
                          {carrier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.trackingCarrier ? (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.trackingCarrier.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`tracking-number-${order.id}`}>Numéro de suivi</Label>
              <Input
                id={`tracking-number-${order.id}`}
                autoComplete="off"
                placeholder="Ex. 1Z999AA10123456784"
                disabled={isSubmitting}
                {...register("trackingNumber")}
              />
              {errors.trackingNumber ? (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.trackingNumber.message}</p>
              ) : null}
            </div>

            <Button type="submit" className="w-full gap-2" disabled={isSubmitting || payoutPaid}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Confirmer l&apos;expédition
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
