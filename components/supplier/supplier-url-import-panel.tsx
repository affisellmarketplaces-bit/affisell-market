"use client"

import { useCallback, useState } from "react"
import { ChevronDown, Link2, Loader2 } from "lucide-react"
import { toast } from "sonner"

import AgentSelector from "@/components/AgentSelector"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CategoryAttrRow } from "@/components/supplier/category-attribute-fields"
import {
  buildUrlImportFormPatch,
  GENERIC_BRAND_LABEL,
  type UrlImportFormPatch,
} from "@/lib/url-import-apply"
import { cn } from "@/lib/utils"

export type UrlImportApplyPayload = UrlImportFormPatch

type Props = {
  categoryAttrs: CategoryAttrRow[]
  commissionPct: string
  onApply: (payload: UrlImportApplyPayload) => void
}

export function SupplierUrlImportPanel({ categoryAttrs, commissionPct, onApply }: Props) {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [aiRewrite, setAiRewrite] = useState(false)
  const [markup, setMarkup] = useState("2.5")
  const [lastMeta, setLastMeta] = useState<{ platform: string; method: string } | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showAgents, setShowAgents] = useState(false)
  // Agent d'achat Chine choisi (Anovabuy par défaut, source 1688).
  const [chinaAgent, setChinaAgent] = useState<{ id: string; name: string }>({
    id: "anovabuy",
    name: "Anovabuy",
  })
  const [chinaPlatform, setChinaPlatform] = useState("1688")
  const [ordering, setOrdering] = useState(false)

  const openAgentCheckout = useCallback(async () => {
    const u = url.trim()
    if (!u) {
      toast.error("Collez l’URL du produit.")
      return
    }
    if (!/^https?:\/\//i.test(u)) {
      toast.error("L’URL doit commencer par http:// ou https://")
      return
    }
    setOrdering(true)
    try {
      const res = await fetch("/api/supplier/china-buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sourceUrl: u,
          agentId: chinaAgent.id,
          platform: chinaPlatform,
          quantity: 1,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        status?: string
        redirectUrl?: string | null
        externalRef?: string | null
        message?: string | null
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Routage agent impossible")

      if (data.status === "STUB" && data.redirectUrl) {
        window.open(data.redirectUrl, "_blank", "noopener,noreferrer")
        toast.success(
          data.message ?? `Ouvre ${chinaAgent.name} pour finaliser la commande manuellement.`
        )
        return
      }
      if (data.status === "API_OK") {
        toast.success(
          `Commande routée via API — réf. ${data.externalRef ?? "confirmée"}`
        )
        return
      }
      toast.info("Route enregistrée — suivi dans Supply Hub.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Commande agent impossible")
    } finally {
      setOrdering(false)
    }
  }, [url, chinaAgent.id, chinaAgent.name, chinaPlatform])

  const runImport = useCallback(async () => {
    const u = url.trim()
    if (!u) {
      toast.error("Collez l’URL du produit.")
      return
    }
    if (!/^https?:\/\//i.test(u)) {
      toast.error("L’URL doit commencer par http:// ou https://")
      return
    }
    setLoading(true)
    setLastMeta(null)
    try {
      const mkNum = Number(markup.replace(",", "."))
      const mk = Number.isFinite(mkNum) && mkNum > 0 ? mkNum : 2.5
      const res = await fetch("/api/import-china", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url: u,
          agent: chinaAgent.id,
          platform: chinaPlatform,
          options: {
            aiRewrite,
            markup: mk,
          },
        }),
      })
      const data = (await res.json()) as {
        products?: unknown[]
        error?: string
        platform?: string
        method?: string
        warnings?: string[]
        buyingAgent?: { id: string; name: string; fee: string }
        chinaRoute?: {
          status?: string
          redirectUrl?: string | null
          message?: string | null
          externalRef?: string | null
        }
      }
      if (!res.ok) throw new Error(data.error ?? "Import impossible")

      const raw = Array.isArray(data.products) ? data.products[0] : null
      const p = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
      if (!p) throw new Error("Aucune donnée produit reçue")

      const title = typeof p.title === "string" ? p.title.trim() : ""
      if (!title) throw new Error("Impossible de lire le titre sur cette page.")

      const patch = buildUrlImportFormPatch(p, {
        markup: mk,
        categoryAttrs: categoryAttrs.map((a) => ({ key: a.key, label: a.label })),
        commissionPct,
      })

      onApply({
        ...patch,
        sourceUrl: u,
        chinaBuyingAgentId: chinaAgent.id,
        chinaPlatform,
      })

      setLastMeta({
        platform: String(data.platform ?? "unknown"),
        method: String(data.method ?? ""),
      })

      const bits: string[] = []
      if (patch.images.length) bits.push(`${patch.images.length} image(s)`)
      if (patch.illustrationVideos.length) bits.push(`${patch.illustrationVideos.length} vidéo(s)`)
      if (patch.variants.mode !== "none") bits.push("variantes")
      if (patch.brand === GENERIC_BRAND_LABEL) bits.push("marque : Generic")
      else if (patch.brand) bits.push(`marque : ${patch.brand}`)

      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        toast.warning(data.warnings.join(" "))
      }

      toast.success(
        bits.length
          ? `Fiche préremplie (${bits.join(", ")}) — vérifiez catégorie et prix.`
          : "Fiche préremplie — vérifiez catégorie et prix."
      )

      if (data.chinaRoute?.status === "STUB" && data.chinaRoute.redirectUrl) {
        toast.message(`Commander via ${chinaAgent.name}`, {
          description:
            data.chinaRoute.message ??
            "Le produit est prêt — ouvrez l’agent pour acheter manuellement.",
          action: {
            label: "Ouvrir",
            onClick: () => window.open(data.chinaRoute!.redirectUrl!, "_blank", "noopener,noreferrer"),
          },
        })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import impossible")
    } finally {
      setLoading(false)
    }
  }, [url, aiRewrite, markup, categoryAttrs, commissionPct, onApply, chinaAgent.id, chinaPlatform])

  return (
    <Card className="border-zinc-200 bg-zinc-50/90 p-5 dark:border-zinc-700 dark:bg-zinc-900/50">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-zinc-950">
          <Link2 className="h-5 w-5 text-zinc-800 dark:text-zinc-100" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Import depuis URL</h2>
            <Badge
              variant="secondary"
              className="border border-sky-200 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100"
            >
              Enrichi
            </Badge>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Titre, description, images, vidéos, prix, livraison, marque (Generic si inconnue), tailles et couleurs
            quand disponibles. Compatible 1688, Taobao, Tmall, JD.com, Weidian, Pinduoduo, Xianyu et usines directes.
          </p>

          <button
            type="button"
            onClick={() => setShowAgents((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
          >
            <ChevronDown className={cn("h-4 w-4 transition", showAgents && "rotate-180")} aria-hidden />
            Agent d&apos;achat Chine : <strong>{chinaAgent.name}</strong> · {chinaPlatform}
          </button>

          {showAgents ? (
            <AgentSelector
              onSelect={(agent: { id: string; name: string }, platform: string) => {
                setChinaAgent({ id: agent.id, name: agent.name })
                setChinaPlatform(platform)
              }}
            />
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Label htmlFor="url-import-field" className="sr-only">
                URL produit
              </Label>
              <Input
                id="url-import-field"
                type="url"
                placeholder="https://detail.1688.com/offer/… , Amazon, Shopify…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                className="mt-0"
              />
            </div>
            <Button type="button" disabled={loading} onClick={() => void runImport()} className="shrink-0">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Import…
                </>
              ) : (
                "Importer dans la fiche"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading || ordering || !url.trim()}
              onClick={() => void openAgentCheckout()}
              className="shrink-0 border-blue-300 text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-200 dark:hover:bg-blue-950"
            >
              {ordering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Ouverture…
                </>
              ) : (
                `Commander via ${chinaAgent.name}`
              )}
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline dark:text-violet-300"
          >
            <ChevronDown className={cn("h-4 w-4 transition", showAdvanced && "rotate-180")} aria-hidden />
            Options avancées
          </button>

          {showAdvanced ? (
            <div className="grid gap-3 rounded-lg border border-zinc-200 bg-white/80 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950/60 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={aiRewrite}
                  onChange={(e) => setAiRewrite(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                Reformuler la description (Groq)
              </label>
              <div>
                <Label htmlFor="url-markup">Marge sur prix source</Label>
                <Input
                  id="url-markup"
                  type="number"
                  min={1}
                  step={0.1}
                  className="mt-1"
                  value={markup}
                  onChange={(e) => setMarkup(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {lastMeta ? (
            <div className="flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <span className="rounded-md bg-white px-2 py-1 dark:bg-zinc-900">
                Plateforme : <strong className="text-zinc-900 dark:text-zinc-100">{lastMeta.platform}</strong>
              </span>
              {lastMeta.method ? (
                <span className="rounded-md bg-white px-2 py-1 dark:bg-zinc-900">
                  Méthode : {lastMeta.method}
                </span>
              ) : null}
              <span className="rounded-md bg-white px-2 py-1 dark:bg-zinc-900">
                Agent : <strong className="text-zinc-900 dark:text-zinc-100">{chinaAgent.name}</strong>
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
