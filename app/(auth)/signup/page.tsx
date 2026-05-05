import Link from "next/link"
import { ArrowRight, Briefcase, Check, DollarSign, Globe, Package, Shield, ShieldCheck, Store } from "lucide-react"

export default function SignupChooser() {
  const affiliateBenefits = ["70% commissions", "No inventory", "Worldwide payouts (PayPal, Wise, Bank)", "Marketing tools"]
  const supplierBenefits = ["Access to affiliates", "Zero upfront cost", "Global shipping network", "Analytics dashboard"]

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-6xl">
        <div className="text-center">
          <p className="inline-flex items-center rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700 shadow-sm">
            Affisell Marketplace
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            Join 10,000+ sellers and affiliates in 150+ countries
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-600 sm:text-lg">
            The global marketplace where suppliers and creators scale together — with local payouts, multi-currency,
            and worldwide fulfillment.
          </p>
          <p className="mt-3 text-sm font-medium text-zinc-500">English • USD • Worldwide shipping</p>
        </div>

        <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-zinc-800">
              <DollarSign className="h-4 w-4 text-violet-600" />
              $2.4M+ paid out
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-zinc-800">
              <Globe className="h-4 w-4 text-violet-600" />
              150+ countries
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-zinc-800">
              <Shield className="h-4 w-4 text-violet-600" />
              24/7 support
            </p>
          </div>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
          <Link href="/signup/affiliate" className="group">
            <article className="relative flex h-full flex-col rounded-3xl border border-violet-300/80 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-violet-300/50 sm:p-10">
              <span className="absolute right-6 top-6 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 px-3 py-1 text-xs font-semibold text-white">
                Most popular
              </span>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <Briefcase className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-zinc-900">Join as an Affiliate</h2>
              <p className="mt-2 text-zinc-600">Promote top products and turn your audience into recurring revenue.</p>
              <ul className="mt-6 space-y-3 text-sm text-zinc-700">
                {affiliateBenefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>
              <span className="mt-8 inline-flex w-fit items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition group-hover:from-violet-700 group-hover:to-pink-600">
                Get started — free
                <ArrowRight className="h-4 w-4" />
              </span>
              <p className="mt-2 text-xs text-zinc-500">Available in 150+ countries</p>
            </article>
          </Link>

          <Link href="/signup/supplier" className="group">
            <article className="flex h-full flex-col rounded-3xl border border-pink-200/80 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-pink-200/70 sm:p-10">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-100 text-pink-700">
                <div className="flex items-center gap-1">
                  <Store className="h-4 w-4" />
                  <Package className="h-4 w-4" />
                </div>
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-zinc-900">Join as a Supplier</h2>
              <p className="mt-2 text-zinc-600">List once, reach more buyers through a high-performing affiliate network.</p>
              <ul className="mt-6 space-y-3 text-sm text-zinc-700">
                {supplierBenefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-pink-100 text-pink-700">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>
              <span className="mt-8 inline-flex w-fit items-center gap-2 rounded-xl border border-pink-300 bg-white px-5 py-2.5 text-sm font-semibold text-pink-700 transition group-hover:border-pink-400 group-hover:bg-pink-50">
                Start selling — free
                <ArrowRight className="h-4 w-4" />
              </span>
              <p className="mt-2 text-xs text-zinc-500">Available in 150+ countries</p>
            </article>
          </Link>
        </div>

        <div className="mx-auto mt-10 max-w-5xl rounded-2xl border border-zinc-200 bg-white/80 px-6 py-5 backdrop-blur">
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex items-center gap-2 text-zinc-700">
              <ShieldCheck className="h-5 w-5 text-violet-600" />
              <p className="text-sm font-medium">Trusted by brands worldwide</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <span className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-zinc-400">Shopify</span>
              <span className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-zinc-400">Stripe</span>
              <span className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-zinc-400">PayPal</span>
              <span className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-zinc-400">Wise</span>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-zinc-600">
          Already have an account or cashback wallet?{" "}
          <Link href="/auth/signin" className="font-medium text-violet-700 hover:text-violet-800">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
