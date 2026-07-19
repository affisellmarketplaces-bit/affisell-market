"use client"

import { motion } from "framer-motion"
import { Factory, Loader2, PackageCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { track } from "@/lib/analytics"
import {
  getSupplierKindAnalyticsProps,
  getSupplierKindLabel,
  type SupplierKind,
  type SupplierKindSetValue,
} from "@/lib/supplier-kind"

const STOCK_COUNTRIES = [
  { value: "FR", label: "France" },
  { value: "ES", label: "Espagne" },
  { value: "IT", label: "Italie" },
  { value: "DE", label: "Allemagne" },
] as const

type Props = {
  /** From GET /api/supplier-profile/me (server-loaded). */
  initialKind: SupplierKind
  initialName?: string | null
}

export function SupplierKindSelector({ initialKind, initialName }: Props) {
  const router = useRouter()
  const alreadySet = initialKind === "producer" || initialKind === "stocker"
  const [editing, setEditing] = useState(!alreadySet)
  const [selectedKind, setSelectedKind] = useState<SupplierKindSetValue | null>(
    alreadySet ? initialKind : null
  )
  const [nomEntreprise, setNomEntreprise] = useState(initialName?.trim() ?? "")
  const [paysStock, setPaysStock] = useState<string>("FR")
  const [capacite, setCapacite] = useState("")
  const [loading, setLoading] = useState(false)

  async function onContinue() {
    if (!selectedKind) return
    setLoading(true)
    try {
      const body: {
        supplierKind: SupplierKindSetValue
        nom_entreprise?: string
        pays_stock?: string
      } = { supplierKind: selectedKind }

      if (selectedKind === "producer" && nomEntreprise.trim()) {
        body.nom_entreprise = nomEntreprise.trim()
      }
      if (selectedKind === "stocker") {
        body.pays_stock = paysStock
        if (nomEntreprise.trim()) body.nom_entreprise = nomEntreprise.trim()
      }

      const res = await fetch("/api/supplier-profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        supplierKind?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Impossible d’enregistrer ton profil")
      }

      track("supplier_kind_selected", {
        ...getSupplierKindAnalyticsProps(selectedKind),
        previous_kind: initialKind,
        previous_display_kind: getSupplierKindAnalyticsProps(initialKind).display_kind,
        source: "onboarding_kind_page",
        $set: { supplier_kind: selectedKind },
      })

      toast.success(
        selectedKind === "producer"
          ? "Profil Producteur enregistré"
          : "Profil Grossiste enregistré"
      )
      router.push(
        selectedKind === "producer" ? "/pricing?kind=producer" : "/pricing?kind=stocker"
      )
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l’enregistrement")
      setLoading(false)
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-8 -top-16 h-56 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.18),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.28),transparent_70%)]"
      />

      {alreadySet && !editing ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl border border-zinc-200/70 bg-white/55 p-6 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/55"
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Tu es actuellement :</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
            {getSupplierKindLabel(initialKind)}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="button" variant="bentoAccent" onClick={() => setEditing(true)}>
              Changer
            </Button>
            <Button
              type="button"
              variant="bentoOutline"
              onClick={() =>
                router.push(
                  initialKind === "producer"
                    ? "/pricing?kind=producer"
                    : initialKind === "stocker"
                      ? "/pricing?kind=stocker"
                      : "/pricing"
                )
              }
            >
              Voir les plans →
            </Button>
          </div>
        </motion.div>
      ) : null}

      {editing ? (
        <div className="relative space-y-8">
          <div className="grid gap-4 md:grid-cols-2">
            <KindCard
              kind="producer"
              selected={selectedKind === "producer"}
              delay={0}
              icon={<Factory className="size-6" />}
              badge="MARQUE"
              badgeClassName="bg-zinc-900/90 text-white dark:bg-white/90 dark:text-zinc-950"
              title="Je suis Producteur"
              description="Je fabrique ma marque. Je veux un réseau de resellers qui poussent mes produits."
              onSelect={() => setSelectedKind("producer")}
            />
            <KindCard
              kind="stocker"
              selected={selectedKind === "stocker"}
              delay={0.1}
              icon={<PackageCheck className="size-6" />}
              badge="RECOMMANDÉ"
              badgeClassName="bg-[#7C3AED] text-white"
              title="Je suis Grossiste"
              description="J'importe et je stocke en France. Stock FR + livraison 24/48h certifiée — je prends le risque stock pour devenir fournisseur."
              onSelect={() => setSelectedKind("stocker")}
            />
          </div>

          {selectedKind ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl border border-zinc-200/70 bg-white/55 p-5 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/55"
            >
              {selectedKind === "producer" ? (
                <div className="space-y-2">
                  <Label htmlFor="nom_marque">Nom de ta marque</Label>
                  <Input
                    id="nom_marque"
                    value={nomEntreprise}
                    onChange={(e) => setNomEntreprise(e.target.value)}
                    placeholder="Ex. Atelier Nova"
                    autoComplete="organization"
                  />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="pays_stock">Où est ton stock ?</Label>
                    <select
                      id="pays_stock"
                      value={paysStock}
                      onChange={(e) => setPaysStock(e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      {STOCK_COUNTRIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacite">Capacité (optionnel)</Label>
                    <Input
                      id="capacite"
                      value={capacite}
                      onChange={(e) => setCapacite(e.target.value)}
                      placeholder="Ex. 2 000 SKU / mois"
                    />
                    <p className="text-[11px] text-zinc-500">
                      Info produit — non persistée tant que l’API n’expose pas ce champ.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {alreadySet ? (
              <Button
                type="button"
                variant="ghost"
                disabled={loading}
                onClick={() => {
                  setEditing(false)
                  setSelectedKind(
                    initialKind === "producer" || initialKind === "stocker"
                      ? initialKind
                      : null
                  )
                }}
              >
                Annuler
              </Button>
            ) : (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Tu pourras changer plus tard depuis ce même écran.
              </span>
            )}
            <Button
              type="button"
              variant="bentoAccent"
              size="lg"
              disabled={!selectedKind || loading}
              onClick={() => void onContinue()}
              className="min-w-[240px]"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                "Continuer vers Affisell Radar →"
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function KindCard({
  selected,
  delay,
  icon,
  badge,
  badgeClassName,
  title,
  description,
  onSelect,
}: {
  kind: SupplierKindSetValue
  selected: boolean
  delay: number
  icon: ReactNode
  badge: string
  badgeClassName: string
  title: string
  description: string
  onSelect: () => void
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.99 }}
      onClick={onSelect}
      aria-pressed={selected}
      className="text-left"
    >
      <Card
        className={cn(
          "h-full border bg-white/50 backdrop-blur-xl transition-colors dark:bg-zinc-950/50",
          "border-zinc-200/80 dark:border-zinc-800",
          "hover:border-[#7C3AED]",
          selected &&
            "border-violet-500 bg-violet-500/10 shadow-[0_0_30px_rgba(124,58,237,0.2)] dark:bg-violet-500/10"
        )}
      >
        <CardHeader className="gap-3">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "inline-flex size-10 items-center justify-center rounded-xl border border-zinc-200/80 bg-white/70 text-[#7C3AED] dark:border-zinc-700 dark:bg-zinc-900/70",
                selected && "border-violet-500/40"
              )}
            >
              {icon}
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                badgeClassName
              )}
            >
              {badge}
            </span>
          </div>
          <CardTitle className="text-base text-zinc-900 dark:text-white">{title}</CardTitle>
          <CardDescription className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <p
            className={cn(
              "text-xs font-medium",
              selected ? "text-[#7C3AED]" : "text-zinc-400 dark:text-zinc-500"
            )}
          >
            {selected ? "Sélectionné" : "Cliquer pour choisir"}
          </p>
        </CardContent>
      </Card>
    </motion.button>
  )
}
