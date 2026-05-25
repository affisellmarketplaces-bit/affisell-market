"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BadgePercent,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  Share2,
  Sparkles,
  Store,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { BentoCard, BentoPageHeading } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import type { SupplierAffiliateInvitationListItem } from "@/lib/supplier-affiliate-invitation-types"
import {
  buildSupplierAffiliateInviteSharePayload,
  type SupplierAffiliateInviteShareChannel,
} from "@/lib/supplier-affiliate-invitation-url"
import { cn } from "@/lib/utils"

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Lien actif",
  REGISTERED: "Affilié inscrit",
  LISTING_LIVE: "Listing en ligne",
}

export function AffiliateInvitationStudio({
  supplierDisplayName,
}: {
  supplierDisplayName: string
}) {
  const [invitations, setInvitations] = useState<SupplierAffiliateInvitationListItem[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [creating, setCreating] = useState(false)
  const [activeUrl, setActiveUrl] = useState<string | null>(null)
  const [activeToken, setActiveToken] = useState<string | null>(null)
  const [activeInvitationId, setActiveInvitationId] = useState<string | null>(null)

  const [headline, setHeadline] = useState("Rejoignez mon catalogue Affisell")
  const [personalMessage, setPersonalMessage] = useState(
    "Listez mes produits sur votre vitrine affiliée : commission attractive, logistique gérée côté fournisseur, visibilité immédiate sur le réseau Affisell."
  )
  const [commissionPct, setCommissionPct] = useState("15")
  const [categoryHint, setCategoryHint] = useState("")

  const load = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await fetch("/api/supplier/affiliate-invitations", { cache: "no-store" })
      const j = (await res.json().catch(() => ({}))) as {
        invitations?: SupplierAffiliateInvitationListItem[]
        error?: string
        schemaPending?: boolean
      }
      if (!res.ok) {
        if (j.schemaPending) {
          toast.error("Invitations affilié : migration base de données en attente sur cet environnement.")
        } else if (j.error) {
          toast.error(j.error)
        }
        return
      }
      setInvitations(j.invitations ?? [])
      const latest = j.invitations?.find((i) => i.status === "OPEN" && !i.expired) ?? j.invitations?.[0]
      if (latest && !latest.expired) {
        setActiveUrl(latest.url)
        setActiveToken(latest.token)
        setActiveInvitationId(latest.id)
        setHeadline(latest.headline)
      }
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const share = useMemo(() => {
    if (!activeUrl) return null
    return buildSupplierAffiliateInviteSharePayload({
      url: activeUrl,
      supplierName: supplierDisplayName,
      headline,
    })
  }, [activeUrl, supplierDisplayName, headline])

  async function saveInvitation() {
    setCreating(true)
    try {
      const payload = {
        headline,
        personalMessage,
        offeredCommissionPct: commissionPct.trim() || undefined,
        categoryHint: categoryHint.trim() || undefined,
      }
      const res = activeInvitationId
        ? await fetch(`/api/supplier/affiliate-invitations/${encodeURIComponent(activeInvitationId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/supplier/affiliate-invitations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
      const j = (await res.json().catch(() => ({}))) as {
        invitation?: SupplierAffiliateInvitationListItem
        error?: string
        schemaPending?: boolean
      }
      if (!res.ok) {
        toast.error(
          j.schemaPending
            ? "Migration base de données requise (table invitation affilié)."
            : (j.error ?? "Impossible d'enregistrer l'invitation.")
        )
        return
      }
      if (j.invitation) {
        setActiveUrl(j.invitation.url)
        setActiveToken(j.invitation.token)
        setActiveInvitationId(j.invitation.id)
        toast.success(activeInvitationId ? "Invitation mise à jour." : "Invitation prête à partager.")
        await load()
      }
    } catch {
      toast.error("Erreur réseau.")
    } finally {
      setCreating(false)
    }
  }

  async function copyLink() {
    if (!activeUrl) {
      toast.message("Générez d'abord un lien d'invitation.")
      return
    }
    try {
      await navigator.clipboard.writeText(share?.body ?? activeUrl)
      toast.success("Lien copié — partagez-le partout.")
    } catch {
      toast.error("Copie impossible sur cet appareil.")
    }
  }

  function openChannel(channel: SupplierAffiliateInviteShareChannel) {
    if (!share) return
    const map: Record<SupplierAffiliateInviteShareChannel, string | undefined> = {
      copy: undefined,
      whatsapp: share.whatsapp,
      email: share.email,
      linkedin: share.linkedin,
      x: share.x,
      sms: share.sms,
      native: undefined,
    }
    if (channel === "copy") {
      void copyLink()
      return
    }
    if (channel === "native" && typeof navigator !== "undefined" && navigator.share && activeUrl) {
      void navigator
        .share({ title: share.title, text: share.body, url: activeUrl })
        .catch(() => {})
      return
    }
    const href = map[channel]
    if (href) window.open(href, "_blank", "noopener,noreferrer")
  }

  const shareButtons: { id: SupplierAffiliateInviteShareChannel; label: string; icon: typeof Copy }[] = [
    { id: "copy", label: "Copier", icon: Copy },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { id: "email", label: "Email", icon: Mail },
    { id: "linkedin", label: "LinkedIn", icon: Link2 },
    { id: "x", label: "X", icon: Share2 },
    { id: "sms", label: "SMS", icon: MessageCircle },
    { id: "native", label: "Partager…", icon: Share2 },
  ]

  return (
    <div className="space-y-8">
      <BentoPageHeading
        eyebrow="Partenariats"
        title="Inviter un affilié"
        description="Un lien unique : inscription créateur, premier listing de vos SKU, notifications automatiques pour vous."
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <BentoCard className="space-y-5 border-emerald-100/80 dark:border-emerald-900/40">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            <Sparkles className="h-4 w-4" aria-hidden />
            Personnalisez votre pitch
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Titre de l&apos;invitation</span>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={120}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Message personnel</span>
            <textarea
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <BadgePercent className="h-3.5 w-3.5" aria-hidden />
                Commission proposée (%)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={commissionPct}
                onChange={(e) => setCommissionPct(e.target.value)}
                placeholder="15"
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Catégorie (optionnel)</span>
              <input
                value={categoryHint}
                onChange={(e) => setCategoryHint(e.target.value)}
                placeholder="Tech, beauté, maison…"
                maxLength={80}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={creating}
            onClick={() => void saveInvitation()}
            className={cn(
              buttonVariants(),
              "h-11 w-full gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500"
            )}
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {creating
              ? "Enregistrement…"
              : activeInvitationId
                ? "Mettre à jour le lien"
                : "Générer le lien d'invitation"}
          </button>
        </BentoCard>

        <BentoCard className="flex flex-col gap-4 bg-gradient-to-br from-zinc-50 to-emerald-50/50 dark:from-zinc-900 dark:to-emerald-950/30">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Partager sur tous vos canaux</p>
          {activeUrl ? (
            <div className="rounded-2xl border border-dashed border-emerald-300/60 bg-white/80 p-3 dark:border-emerald-800 dark:bg-zinc-950/80">
              <p className="break-all font-mono text-[11px] leading-relaxed text-emerald-900 dark:text-emerald-200">
                {activeUrl}
              </p>
              {activeToken ? (
                <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">Code {activeToken}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Générez un lien pour activer le partage.</p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {shareButtons.map((b) => (
              <button
                key={b.id}
                type="button"
                disabled={!activeUrl}
                onClick={() => openChannel(b.id)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white py-2.5 text-xs font-medium transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/50"
                )}
              >
                <b.icon className="h-3.5 w-3.5 opacity-70" aria-hidden />
                {b.label}
              </button>
            ))}
          </div>

          <ul className="mt-auto space-y-2 border-t border-zinc-200/80 pt-4 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            <li className="flex gap-2">
              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              Vous êtes notifié dès l&apos;inscription de l&apos;affilié.
            </li>
            <li className="flex gap-2">
              <Store className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              Dès le premier listing public de vos produits sur sa vitrine.
            </li>
          </ul>
        </BentoCard>
      </div>

      <BentoCard>
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Vos invitations récentes</h2>
        {loadingList ? (
          <p className="text-sm text-zinc-500">Chargement…</p>
        ) : invitations.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucune invitation pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{inv.headline}</p>
                  <p className="text-xs text-zinc-500">
                    {STATUS_LABEL[inv.status] ?? inv.status}
                    {inv.affiliateName ? ` · ${inv.affiliateName}` : ""}
                    {inv.viewCount > 0 ? ` · ${inv.viewCount} vue${inv.viewCount > 1 ? "s" : ""}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-lg")}
                    onClick={() => {
                      setActiveUrl(inv.url)
                      setActiveToken(inv.token)
                      setActiveInvitationId(inv.id)
                      setHeadline(inv.headline)
                      void navigator.clipboard.writeText(inv.url)
                      toast.success("Lien actif sélectionné")
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  {inv.status === "LISTING_LIVE" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      <Check className="h-3 w-3" aria-hidden />
                      Live
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </BentoCard>
    </div>
  )
}
