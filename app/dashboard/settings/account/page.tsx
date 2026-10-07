import Link from "next/link"
import { requireMerchantSession } from "@/lib/dashboard-session"
import { redirect } from "next/navigation"
import { CreditCard, Palette, ShieldCheck, Store, Truck } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { ConnectedAccountsPanel } from "@/components/connected-accounts-panel"
import { resolveSupportEmail } from "@/lib/legal/company-env"
import { MerchantAccountNavActions } from "@/components/merchant-account-nav-actions"
import { prisma } from "@/lib/prisma"

export default async function AccountSettingsPage() {
  const session = await requireMerchantSession("/dashboard/settings/account")


  const userId = session.user.id

  const [accounts, dbUser] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      select: { id: true, provider: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, email: true, name: true, image: true, role: true },
    }),
  ])

  if (!dbUser) redirect("/login")

  const backHref =
    dbUser.role === "SUPPLIER"
      ? "/dashboard/supplier"
      : dbUser.role === "AFFILIATE"
        ? "/dashboard/affiliate"
        : "/marketplace"

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8">
        <p className="text-sm text-gray-600 dark:text-zinc-300">
          <Link href={backHref} className="font-medium text-[#7C3AED] underline-offset-4 hover:underline">
            ← Back to dashboard
          </Link>
        </p>

        <BentoPageHeading
          eyebrow="Security"
          title="Account"
          description="Manage sign-in methods and linked social accounts."
        />

        <BentoCard>
          {dbUser.role === "CUSTOMER" ? (
            <p className="text-sm text-gray-600 dark:text-zinc-300">
              <Link
                href="/marketplace/account/wallet"
                className="font-medium text-[#7C3AED] underline-offset-4 hover:underline"
              >
                Store credit &amp; activity →
              </Link>
            </p>
          ) : (
            <p className="text-sm text-gray-600 dark:text-zinc-300">
              Buyer store credit is available in your{" "}
              <Link href="/marketplace/account" className="font-medium text-[#7C3AED] underline-offset-4 hover:underline">
                marketplace buyer hub
              </Link>{" "}
              when you use a separate customer login — merchant accounts stay on this dashboard.
            </p>
          )}
        </BentoCard>

        <BentoCard className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {dbUser.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- external OAuth avatars vary by host
            <img src={dbUser.image} alt="" width={56} height={56} className="h-16 w-16 rounded-full object-cover ring-2 ring-gray-100 dark:ring-zinc-700" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xl font-bold text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">
              {(dbUser.name ?? dbUser.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-300">Signed in as</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-gray-900 dark:text-white">{dbUser.name ?? "Your account"}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-zinc-300">{dbUser.email}</p>
          </div>
        </BentoCard>

        {dbUser.role === "SUPPLIER" ? (
          <BentoCard>
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">Supplier settings</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-zinc-300">
              Your store profile, payouts and shipping — managed separately from login &amp; security below.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Link
                href="/dashboard/supplier/settings/store"
                className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/60 p-4 transition hover:border-violet-300 hover:bg-violet-50/60 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-violet-500/50 dark:hover:bg-violet-950/20"
              >
                <Store className="size-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Store profile</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Name, branding, storefront</p>
                </div>
              </Link>
              <Link
                href="/dashboard/supplier/settings/payouts"
                className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/60 p-4 transition hover:border-violet-300 hover:bg-violet-50/60 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-violet-500/50 dark:hover:bg-violet-950/20"
              >
                <CreditCard className="size-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Payouts</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Payment settings &amp; trust score</p>
                </div>
              </Link>
              <Link
                href="/dashboard/supplier/settings/shipping"
                className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/60 p-4 transition hover:border-violet-300 hover:bg-violet-50/60 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-violet-500/50 dark:hover:bg-violet-950/20"
              >
                <Truck className="size-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Shipping</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Rates &amp; delivery profiles</p>
                </div>
              </Link>
              <Link
                href="/dashboard/supplier/settings/compliance"
                className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/60 p-4 transition hover:border-violet-300 hover:bg-violet-50/60 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-violet-500/50 dark:hover:bg-violet-950/20"
              >
                <ShieldCheck className="size-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Product safety</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Manufacturer &amp; EU contact (GPSR)</p>
                </div>
              </Link>
            </div>
          </BentoCard>
        ) : null}

        {dbUser.role === "AFFILIATE" ? (
          <BentoCard>
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">Reseller settings</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-zinc-300">
              Your store profile, branding and payouts — managed separately from login &amp; security below.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Link
                href="/dashboard/affiliate/settings/store"
                className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/60 p-4 transition hover:border-violet-300 hover:bg-violet-50/60 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-violet-500/50 dark:hover:bg-violet-950/20"
              >
                <Store className="size-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Store profile</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Name, banner, description</p>
                </div>
              </Link>
              <Link
                href="/dashboard/affiliate/brand-studio"
                className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/60 p-4 transition hover:border-violet-300 hover:bg-violet-50/60 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-violet-500/50 dark:hover:bg-violet-950/20"
              >
                <Palette className="size-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Brand Studio</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Theme &amp; storefront colors</p>
                </div>
              </Link>
              <Link
                href="/dashboard/affiliate/settings/payouts"
                className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/60 p-4 transition hover:border-violet-300 hover:bg-violet-50/60 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-violet-500/50 dark:hover:bg-violet-950/20"
              >
                <CreditCard className="size-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Payouts</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Stripe Connect &amp; tax info</p>
                </div>
              </Link>
            </div>
          </BentoCard>
        ) : null}

        <BentoCard className="p-0 md:p-0">
          <div className="p-6 md:p-8">
            <ConnectedAccountsPanel
              initialLinked={accounts.map((a) => ({ id: a.id, provider: a.provider }))}
              hasPassword={!!dbUser.password?.length}
            />
          </div>
        </BentoCard>

        <BentoCard>
          <p className="text-sm text-gray-600 dark:text-zinc-300">
            <Link href="/dashboard/account/gdpr" className="font-medium text-[#7C3AED] underline-offset-4 hover:underline">
              Données personnelles (RGPD) →
            </Link>
          </p>
        </BentoCard>

        {dbUser.role === "SUPPLIER" || dbUser.role === "AFFILIATE" ? (
          <BentoCard className="space-y-4 border-red-100/80 dark:border-red-950/50">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">Merchant session</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-zinc-300">
                Sign out or delete this {dbUser.role === "SUPPLIER" ? "supplier" : "affiliate"} account. Deletion is
                permanent and is blocked if you already have marketplace orders in this role.
              </p>
            </div>
            <MerchantAccountNavActions showAccountLink={false} showDeleteAccount supportEmail={resolveSupportEmail()} />
          </BentoCard>
        ) : null}
      </BentoContainer>
    </BentoShell>
  )
}
