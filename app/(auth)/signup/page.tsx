import Link from "next/link"
import { ArrowRight, Briefcase, Check, DollarSign, Globe, Package, Shield, ShieldCheck, Store } from "lucide-react"

export default function SignupChooser() {
  const affiliateBenefits = [
    "Up to 100% commission",
    "No inventory",
    "Stripe Connect payouts (EU+)",
    "Marketing tools",
  ]
  const supplierBenefits = [
    "Access to affiliates",
    "Zero upfront cost",
    "EU & international shipping zones",
    "Analytics dashboard",
  ]

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-violet-50/40 px-3 py-6 sm:px-6 sm:py-10 md:px-10 md:py-12">
      <div className="mx-auto w-full max-w-6xl rounded-[2.25rem] border border-zinc-200/70 bg-white/75 p-5 shadow-[0_25px_80px_-20px_rgba(0,0,0,0.12)] ring-1 ring-white/80 backdrop-blur-md sm:rounded-[2.75rem] sm:p-8 md:rounded-[3.25rem] md:p-10 lg:rounded-[3.5rem]">
        <div className="text-center">
          <p className="inline-flex items-center rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700 shadow-sm">
            Affisell · Pan-EU
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            Join suppliers and creators across Europe
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-600 sm:text-lg">
            The creator-first marketplace — one checkout in 32 countries, prices in EUR, VAT calculated at
            payment via Stripe.
          </p>
          <p className="mt-3 text-sm font-medium text-zinc-500">
            27 EU markets · Stripe Connect payouts where supported
          </p>
        </div>

        <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-[1.35rem] border border-zinc-200/90 bg-white px-4 py-3.5 shadow-sm sm:rounded-[1.65rem] sm:py-4 md:rounded-[1.85rem]">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-zinc-800">
              <Globe className="h-4 w-4 text-violet-600" />
              32 countries
            </p>
            <p className="mt-0.5 text-center text-xs text-zinc-500">EU checkout today</p>
          </div>
          <div className="rounded-[1.35rem] border border-zinc-200/90 bg-white px-4 py-3.5 shadow-sm sm:rounded-[1.65rem] sm:py-4 md:rounded-[1.85rem]">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-zinc-800">
              <DollarSign className="h-4 w-4 text-violet-600" />
              EUR · VAT
            </p>
            <p className="mt-0.5 text-center text-xs text-zinc-500">Stripe Tax at checkout</p>
          </div>
          <div className="rounded-[1.35rem] border border-zinc-200/90 bg-white px-4 py-3.5 shadow-sm sm:rounded-[1.65rem] sm:py-4 md:rounded-[1.85rem]">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-zinc-800">
              <Shield className="h-4 w-4 text-violet-600" />
              24/7 support
            </p>
          </div>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-2">
          <Link href="/signup/affiliate" className="group">
            <article className="relative flex h-full flex-col rounded-[1.85rem] border border-violet-300/80 bg-white p-8 shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-violet-300/45 sm:rounded-[2.15rem] sm:p-10 md:rounded-[2.5rem]">
              <span className="absolute right-5 top-5 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 px-3 py-1 text-xs font-semibold text-white sm:right-6 sm:top-6">
                Most popular
              </span>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-violet-100 text-violet-700 sm:h-14 sm:w-14 sm:rounded-[1.35rem]">
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
              <span className="mt-8 inline-flex w-fit items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition sm:rounded-[1.15rem] sm:px-6 sm:py-3 group-hover:from-violet-700 group-hover:to-pink-600">
                Get started — free
                <ArrowRight className="h-4 w-4" />
              </span>
              <p className="mt-2 text-xs text-zinc-500">Checkout in 32 European countries</p>
            </article>
          </Link>

          <Link href="/signup/supplier" className="group">
            <article className="flex h-full flex-col rounded-[1.85rem] border border-pink-200/80 bg-white p-8 shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-pink-200/60 sm:rounded-[2.15rem] sm:p-10 md:rounded-[2.5rem]">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-pink-100 text-pink-700 sm:h-14 sm:w-14 sm:rounded-[1.35rem]">
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
              <span className="mt-8 inline-flex w-fit items-center gap-2 rounded-2xl border border-pink-300 bg-white px-5 py-2.5 text-sm font-semibold text-pink-700 shadow-sm transition sm:rounded-[1.15rem] sm:px-6 sm:py-3 group-hover:border-pink-400 group-hover:bg-pink-50">
                Start selling — free
                <ArrowRight className="h-4 w-4" />
              </span>
              <p className="mt-2 text-xs text-zinc-500">Checkout in 32 European countries</p>
            </article>
          </Link>
        </div>

        <div className="mx-auto mt-10 max-w-5xl rounded-[1.35rem] border border-zinc-200/90 bg-white/90 px-6 py-5 shadow-sm backdrop-blur-sm sm:rounded-[1.65rem] sm:px-8 sm:py-6 md:rounded-[1.85rem]">
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex items-center gap-2 text-zinc-700">
              <ShieldCheck className="h-5 w-5 text-violet-600" />
              <p className="text-sm font-medium">Built for European commerce · Stripe secured</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <span className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-zinc-400 sm:rounded-2xl">
                Shopify
              </span>
              <span className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-zinc-400 sm:rounded-2xl">
                Stripe
              </span>
              <span className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-zinc-400 sm:rounded-2xl">
                PayPal
              </span>
              <span className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-zinc-400 sm:rounded-2xl">
                Wise
              </span>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-zinc-600">
          Already have an account or cashback wallet?{" "}
          <Link href="/login" className="font-medium text-violet-700 hover:text-violet-800">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
