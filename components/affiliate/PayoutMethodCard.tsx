"use client"

import type { PayoutMethodStatus, PayoutMethodType } from "@prisma/client"
import { motion } from "framer-motion"
import { Building2, CheckCircle2, Clock, Star, Trash2, type LucideIcon } from "lucide-react"

export type AffiliatePayoutMethodCardModel = {
  id: string
  type: PayoutMethodType
  country: string
  isDefault: boolean
  status: PayoutMethodStatus
  last4: string | null
}

type TypeConfig = {
  label: string
  color: string
  icon: LucideIcon
}

const TYPE_CONFIG: Record<PayoutMethodType, TypeConfig> = {
  BANK: { label: "Virement bancaire", color: "bg-blue-500", icon: Building2 },
  PAYPAL: { label: "PayPal", color: "bg-[#003087]", icon: Building2 },
  WISE: { label: "Wise", color: "bg-[#00B9FF]", icon: Building2 },
  PAYONEER: { label: "Payoneer", color: "bg-[#FF4800]", icon: Building2 },
  MOBILE_MONEY_WAVE: { label: "Wave", color: "bg-[#1DC7FF]", icon: Building2 },
  MOBILE_MONEY_ORANGE: { label: "Orange Money", color: "bg-[#FF7900]", icon: Building2 },
  MOBILE_MONEY_MTN: { label: "MTN MoMo", color: "bg-[#FFCC00]", icon: Building2 },
}

type Props = {
  method: AffiliatePayoutMethodCardModel
  onSetDefault: (id: string) => void
  onDelete: (id: string) => void
  busyId?: string | null
}

export function PayoutMethodCard({ method, onSetDefault, onDelete, busyId }: Props) {
  const config = TYPE_CONFIG[method.type]
  const Icon = config.icon
  const isBusy = busyId === method.id

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative rounded-2xl border border-white/30 bg-white/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-zinc-950/70 ${
        method.isDefault ? "ring-2 ring-violet-500/30" : ""
      }`}
    >
      {method.isDefault ? (
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10" />
      ) : null}
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white ${config.color}`}
          >
            <Icon className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-50">
              {config.label}
              {method.isDefault ? (
                <Star className="h-4 w-4 fill-violet-500 text-violet-500" aria-hidden />
              ) : null}
            </div>
            <div className="text-sm text-gray-500 dark:text-zinc-400">
              {method.country} • {method.last4 ?? "****"}
            </div>
          </div>
        </div>
        {method.status === "VERIFIED" ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" aria-hidden />
            Vérifié
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <Clock className="h-3 w-3" aria-hidden />
            En attente
          </span>
        )}
      </div>
      <div className="relative mt-4 flex flex-wrap gap-2">
        {!method.isDefault ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onSetDefault(method.id)}
            className="rounded-full bg-gray-900 px-3 py-1.5 text-xs text-white hover:bg-black disabled:opacity-60 dark:bg-violet-600 dark:hover:bg-violet-700"
          >
            Définir par défaut
          </button>
        ) : null}
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onDelete(method.id)}
          className="flex items-center gap-1 rounded-full border bg-white px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          <Trash2 className="h-3 w-3" aria-hidden />
          Supprimer
        </button>
      </div>
    </motion.div>
  )
}
