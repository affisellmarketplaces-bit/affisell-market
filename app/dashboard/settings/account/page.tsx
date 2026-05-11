import Link from "next/link"
import { redirect } from "next/navigation"

import { ConnectedAccountsPanel } from "@/components/connected-accounts-panel"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export default async function AccountSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/settings/account")

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

  if (!dbUser) redirect("/auth/signin")

  const backHref =
    dbUser.role === "SUPPLIER"
      ? "/dashboard/supplier"
      : dbUser.role === "AFFILIATE"
        ? "/dashboard/affiliate"
        : "/marketplace"

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:px-8">
      <p className="mb-4 text-sm">
        <Link href={backHref} className="font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
          ← Back to dashboard
        </Link>
      </p>

      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Account</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Manage sign-in methods and linked social accounts.</p>

      <p className="mt-4 text-sm">
        <Link
          href="/dashboard/wallet"
          className="font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
        >
          Store credit &amp; activity →
        </Link>
      </p>

      <div className="mt-8 flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        {dbUser.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- external OAuth avatars vary by host
          <img src={dbUser.image} alt="" width={56} height={56} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {(dbUser.name ?? dbUser.email ?? "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-medium text-zinc-900 dark:text-zinc-100">{dbUser.name ?? "Your account"}</p>
          <p className="text-sm text-zinc-500">{dbUser.email}</p>
        </div>
      </div>

      <div className="mt-8">
        <ConnectedAccountsPanel
          initialLinked={accounts.map((a) => ({ id: a.id, provider: a.provider }))}
          hasPassword={!!dbUser.password?.length}
        />
      </div>
    </main>
  )
}
