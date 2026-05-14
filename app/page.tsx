import Link from "next/link"
import { ArrowRight, LayoutGrid, Sparkles, Store, Users } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell, bentoGrid } from "@/components/affisell/bento-ui"
import { CategoryBlock } from "@/components/home/CategoryBlock"
import { HomeAffisellCarousels } from "@/components/home-affisell-carousels"
import { BestSellers } from "@/components/trends/BestSellers"
import { NewArrivals } from "@/components/trends/NewArrivals"
import { SalesBarometer } from "@/components/trends/SalesBarometer"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function HomePage() {
  return (
    <BentoShell>
      <BentoContainer maxWidth="7xl" className="space-y-10 md:space-y-14">
        <div className={cn(bentoGrid, "items-stretch")}>
          <BentoCard className="relative overflow-hidden xl:col-span-7">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage: `
                  radial-gradient(ellipse 70% 50% at 10% -20%, rgba(124,58,237,0.22), transparent 55%),
                  radial-gradient(ellipse 50% 40% at 95% 0%, rgba(16,185,129,0.12), transparent 50%)
                `,
              }}
              aria-hidden
            />
            <div className="relative flex h-full flex-col gap-8">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#7C3AED]/20 bg-[#7C3AED]/8 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#5b21b6]">
                <Sparkles className="size-3.5" aria-hidden />
                Affiliate marketplace
              </div>
              <BentoPageHeading
                title="Affisell"
                description="Shop partner stores, discover new products, and support creators — all in one marketplace."
                className="space-y-4"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/signup/supplier"
                  className={cn(
                    buttonVariants({ variant: "bentoSolid", size: "bento" }),
                    "inline-flex w-full justify-center sm:w-auto"
                  )}
                >
                  <Store className="size-5 shrink-0" aria-hidden />
                  Become supplier
                  <ArrowRight className="size-4 shrink-0 opacity-80" aria-hidden />
                </Link>
                <Link
                  href="/signup/affiliate"
                  className={cn(
                    buttonVariants({ variant: "bentoOutline", size: "bento" }),
                    "inline-flex w-full justify-center sm:w-auto"
                  )}
                >
                  <Users className="size-5 shrink-0" aria-hidden />
                  Become affiliate
                </Link>
                <Link
                  href="/marketplace"
                  className={cn(
                    buttonVariants({ variant: "bentoAccent", size: "bento" }),
                    "inline-flex w-full justify-center sm:w-auto"
                  )}
                >
                  <LayoutGrid className="size-5 shrink-0" aria-hidden />
                  Browse marketplace
                </Link>
              </div>
              <p className="text-sm text-gray-600">
                <Link href="/login" className="font-medium text-[#7C3AED] underline-offset-4 hover:underline">
                  Sign in
                </Link>{" "}
                to access your account.
              </p>
            </div>
          </BentoCard>

          <div className="grid gap-6 xl:col-span-5">
            <BentoCard className="flex flex-col justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">For suppliers</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">List once, sell everywhere</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  Sync catalog, manage returns, and tune your public store profile.
                </p>
              </div>
              <Link
                href="/dashboard/supplier"
                className={cn(
                  buttonVariants({ variant: "bentoOutline", size: "bento" }),
                  "inline-flex w-full justify-center"
                )}
              >
                Supplier hub
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </BentoCard>
            <BentoCard className="flex flex-col justify-between gap-4 border-[#10B981]/20 bg-gradient-to-br from-white/90 to-emerald-50/40">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800/80">For creators</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">Your affiliate store</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  Pick products, set your prices, and share your storefront with your audience.
                </p>
              </div>
              <Link
                href="/dashboard/affiliate"
                className={cn(
                  buttonVariants({ variant: "bentoSolid", size: "bento" }),
                  "inline-flex w-full justify-center"
                )}
              >
                Go to dashboard
              </Link>
            </BentoCard>
          </div>
        </div>

        <section className="space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Highlights</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">Popular on Affisell</h2>
              <p className="mt-1 max-w-xl text-sm text-gray-600">
                New arrivals, bestsellers, and a quick read on what&apos;s selling — so you can shop with confidence.
              </p>
            </div>
          </div>
          <BentoCard className="p-0 md:p-0">
            <div className="space-y-12 p-6 md:p-8">
              <div className="grid gap-8 lg:grid-cols-2">
                <CategoryBlock category="Sport" />
                <CategoryBlock category="electronics" />
              </div>
              <HomeAffisellCarousels />
              <BestSellers />
              <NewArrivals />
              <SalesBarometer />
            </div>
          </BentoCard>
        </section>
      </BentoContainer>
    </BentoShell>
  )
}
