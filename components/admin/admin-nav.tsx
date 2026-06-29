"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { AdminAuthActions } from "@/components/admin/admin-auth-actions"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/admin/expansion", label: "Expansion" },
  { href: "/admin/terminal", label: "Terminal" },
  { href: "/admin/sentinel", label: "Sentinel" },
  { href: "/admin/kyc", label: "KYC" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/returns", label: "Retours" },
  { href: "/admin/auto-fulfill", label: "Auto-Fulfill" },
  { href: "/admin/products/new", label: "Produit AE" },
  { href: "/admin/orders", label: "Commandes" },
  { href: "/admin/providers", label: "Fournisseurs API" },
  { href: "/admin/supply-lab", label: "Supply Lab" },
  { href: "/admin/agents", label: "Agents" },
  { href: "/admin/stripe-health", label: "Stripe" },
  { href: "/admin/suppliers/lightning", label: "Lightning" },
  { href: "/admin/queues", label: "Queues" },
  { href: "/admin/splits", label: "Splits" },
  { href: "/admin/reviews", label: "Avis" },
  { href: "/crm", label: "CRM" },
  { href: "/admin/rgpd-registre", label: "RGPD" },
  { href: "/admin/terms-logs", label: "Consentements" },
] as const

export function AdminNav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-3">
        <Link href="/admin/terminal" className="text-sm font-bold text-violet-700 dark:text-violet-300">
          Affisell Admin
        </Link>
        <nav className="flex flex-1 flex-wrap gap-1">
          {LINKS.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== "/admin/auto-fulfill" &&
                link.href !== "/admin/sentinel" &&
                link.href !== "/admin/terminal" &&
                link.href !== "/admin/kyc" &&
                link.href !== "/admin/support" &&
                link.href !== "/admin/returns" &&
                pathname.startsWith(`${link.href}/`)) ||
              (link.href === "/admin/expansion" && pathname.startsWith("/admin/expansion")) ||
              (link.href === "/admin/terminal" && pathname.startsWith("/admin/terminal")) ||
              (link.href === "/admin/sentinel" && pathname.startsWith("/admin/sentinel")) ||
              (link.href === "/admin/kyc" && pathname.startsWith("/admin/kyc")) ||
              (link.href === "/admin/support" && pathname.startsWith("/admin/support")) ||
              (link.href === "/admin/returns" && pathname.startsWith("/admin/returns")) ||
              (link.href === "/admin/auto-fulfill" &&
                (pathname.startsWith("/admin/products") || pathname === "/admin/auto-fulfill")) ||
              (link.href === "/crm" && pathname.startsWith("/crm")) ||
              (link.href === "/admin/rgpd-registre" && pathname.startsWith("/admin/rgpd-registre")) ||
              (link.href === "/admin/terms-logs" && pathname.startsWith("/admin/terms-logs"))
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-violet-100 text-violet-900 dark:bg-violet-950/80 dark:text-violet-100"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Site public
          </Link>
          <AdminAuthActions />
        </div>
      </div>
    </header>
  )
}
