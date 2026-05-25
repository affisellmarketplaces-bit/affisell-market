"use client"

import type { FormEvent } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn, useSession } from "next-auth/react"
import {
  ArrowRight,
  BadgePercent,
  Building2,
  CheckCircle2,
  Loader2,
  Package,
  Sparkles,
  Store,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import type { PublicSupplierInvitationPayload } from "@/lib/supplier-invitation-types"
import { cn } from "@/lib/utils"

type Props = {
  invite: PublicSupplierInvitationPayload
}

export function SupplierInvitationLanding({ invite }: Props) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [siret, setSiret] = useState("")
  const [loading, setLoading] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoClaimStarted = useRef(false)

  const isSupplierSession =
    status === "authenticated" && (session?.user as { role?: string } | undefined)?.role === "SUPPLIER"

  useEffect(() => {
    if (invite.expired) return
    void fetch(`/api/invite/supplier/${encodeURIComponent(invite.token)}/intent`, {
      method: "POST",
    }).catch(() => {})
  }, [invite.token, invite.expired])

  const claimInvite = useCallback(async () => {
    setClaiming(true)
    try {
      const res = await fetch(`/api/invite/supplier/${encodeURIComponent(invite.token)}/claim`, {
        method: "POST",
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(j.error === "already_linked" ? "Compte déjà lié à une autre invitation." : "Lien invalide ou expiré.")
        return
      }
      toast.success("Invitation acceptée — publiez votre premier produit.")
      router.push("/dashboard/supplier/products/new?fromInvite=1")
      router.refresh()
    } catch {
      toast.error("Erreur réseau.")
    } finally {
      setClaiming(false)
    }
  }, [invite.token, router])

  useEffect(() => {
    if (
      !isSupplierSession ||
      invite.expired ||
      invite.status !== "OPEN" ||
      autoClaimStarted.current
    ) {
      return
    }
    autoClaimStarted.current = true
    void claimInvite()
  }, [isSupplierSession, invite.expired, invite.status, claimInvite])

  async function onSignup(e: FormEvent) {
    e.preventDefault()
    if (invite.expired) {
      setError("Cette invitation a expiré.")
      return
    }
    setLoading(true)
    setError(null)
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        role: "SUPPLIER",
        name: companyName.trim() || undefined,
        siret: siret.trim() || undefined,
        inviteToken: invite.token,
      }),
    })
    const data = (await res.json()) as { error?: string }
    if (!res.ok) {
      setLoading(false)
      setError(data.error ?? "Inscription impossible.")
      return
    }
    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/dashboard/supplier/products/new?fromInvite=1",
    })
    setLoading(false)
    if (login?.error) {
      setError("Compte créé — connectez-vous avec vos identifiants.")
      return
    }
    router.push("/dashboard/supplier/products/new?fromInvite=1")
  }

  const commissionLabel =
    invite.offeredCommissionPct != null
      ? `${invite.offeredCommissionPct.toFixed(1)}%`
      : "jusqu'à 30%"

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-zinc-950 text-zinc-50">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(16,185,129,0.35), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 10%, rgba(139,92,246,0.28), transparent 50%), radial-gradient(ellipse 50% 60% at 50% 100%, rgba(6,182,212,0.15), transparent 55%)",
        }}
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 md:px-8 md:py-16 lg:flex-row lg:items-start lg:gap-14">
        <section className="flex-1 space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-200">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Invitation partenaire Affisell
          </div>

          <div className="flex items-start gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-lg ring-2 ring-emerald-500/20">
              {invite.affiliate.logoUrl ? (
                <Image src={invite.affiliate.logoUrl} alt="" fill className="object-cover" sizes="64px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-600 to-emerald-600 text-xl font-bold">
                  {invite.affiliate.name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-zinc-400">{invite.affiliate.name} vous invite</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl lg:text-[2.35rem] lg:leading-tight">
                {invite.headline}
              </h1>
              {invite.personalMessage ? (
                <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-300">{invite.personalMessage}</p>
              ) : null}
            </div>
          </div>

          <ul className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: Users,
                title: "Réseau d'affiliés",
                desc: "Des créateurs prêts à promouvoir vos SKU.",
              },
              {
                icon: BadgePercent,
                title: commissionLabel,
                desc: "Commission affilié proposée sur cette collaboration.",
              },
              {
                icon: Package,
                title: "Catalogue rapide",
                desc: "Publiez vos produits en quelques minutes.",
              },
            ].map((item) => (
              <li
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"
              >
                <item.icon className="h-5 w-5 text-emerald-400" aria-hidden />
                <p className="mt-2 font-semibold text-zinc-100">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{item.desc}</p>
              </li>
            ))}
          </ul>

          {invite.categoryHint ? (
            <p className="text-sm text-zinc-500">
              Catégorie ciblée : <span className="font-medium text-zinc-300">{invite.categoryHint}</span>
            </p>
          ) : null}

          <ol className="space-y-3 border-t border-white/10 pt-6 text-sm text-zinc-400">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
                1
              </span>
              Créez votre compte fournisseur sécurisé
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
                2
              </span>
              Ajoutez votre premier produit (prix, stock, commission)
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
                3
              </span>
              {invite.affiliate.name} et le réseau Affisell sont notifiés automatiquement
            </li>
          </ol>
        </section>

        <aside className="w-full shrink-0 lg:max-w-md">
          <div
            className={cn(
              "rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-2xl backdrop-blur-xl md:p-8",
              invite.expired && "opacity-70"
            )}
          >
            {invite.expired ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                Cette invitation a expiré. Demandez un nouveau lien à {invite.affiliate.name}.
              </p>
            ) : isSupplierSession ? (
              <div className="space-y-4 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" aria-hidden />
                <p className="font-medium text-zinc-100">Vous êtes connecté en tant que fournisseur</p>
                <button
                  type="button"
                  disabled={claiming}
                  onClick={() => void claimInvite()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Accepter l&apos;invitation
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
                <Link
                  href="/dashboard/supplier"
                  className="block text-sm text-zinc-400 hover:text-zinc-200"
                >
                  Aller au tableau de bord
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <Building2 className="h-4 w-4 text-emerald-400" aria-hidden />
                  Créer mon compte fournisseur
                </div>
                <form onSubmit={onSignup} className="space-y-4">
                  <div>
                    <label htmlFor="inv-company" className="mb-1 block text-xs font-medium text-zinc-400">
                      Entreprise
                    </label>
                    <input
                      id="inv-company"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none ring-emerald-500/0 transition focus:ring-2 focus:ring-emerald-500/40"
                      placeholder="Ma Société SAS"
                    />
                  </div>
                  <div>
                    <label htmlFor="inv-siret" className="mb-1 block text-xs font-medium text-zinc-400">
                      SIRET
                    </label>
                    <input
                      id="inv-siret"
                      required
                      inputMode="numeric"
                      value={siret}
                      onChange={(e) => setSiret(e.target.value.replace(/\D/g, "").slice(0, 14))}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40"
                      placeholder="12345678901234"
                    />
                  </div>
                  <div>
                    <label htmlFor="inv-email" className="mb-1 block text-xs font-medium text-zinc-400">
                      Email pro
                    </label>
                    <input
                      id="inv-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>
                  <div>
                    <label htmlFor="inv-password" className="mb-1 block text-xs font-medium text-zinc-400">
                      Mot de passe
                    </label>
                    <input
                      id="inv-password"
                      type="password"
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>
                  <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-100/90">
                    TVA : vous restez responsable de la collecte et du reversement. Affisell prélève 12&nbsp;% HT sur
                    produits et livraison.
                  </p>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
                    {loading ? "Création…" : "Rejoindre Affisell"}
                  </button>
                  {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}
                </form>
                <p className="mt-5 text-center text-xs text-zinc-500">
                  Déjà inscrit ?{" "}
                  <Link
                    href={`/login/supplier?callbackUrl=${encodeURIComponent(`/invite/supplier/${invite.token}`)}`}
                    className="font-medium text-emerald-400 hover:underline"
                  >
                    Se connecter
                  </Link>
                </p>
              </>
            )}
          </div>
          <p className="mt-4 text-center text-[11px] text-zinc-600">
            Propulsé par Affisell · marketplace créateurs × fournisseurs
          </p>
        </aside>
      </div>
    </div>
  )
}
