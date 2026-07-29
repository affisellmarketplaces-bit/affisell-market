import Link from "next/link"

import { AFFISELL_LEGAL_IDENTITY } from "@/lib/legal/auto-entreprise-identity"
import { readCompanyLegal } from "@/lib/legal/company-env"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/legal/mentions-legales", label: "Mentions légales" },
  { href: "/legal/cgv", label: "CGV" },
  { href: "/legal/cgu", label: "CGU" },
  { href: "/legal/confidentialite", label: "Confidentialité" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/retractation", label: "Rétractation" },
] as const

type Props = {
  className?: string
  year?: number
}

/** Barre légale compacte — SIRET auto-entreprise + liens FR. */
export function LegalFooter({ className, year = new Date().getFullYear() }: Props) {
  const c = readCompanyLegal()

  return (
    <div className={cn("space-y-3 text-sm text-white/45", className)}>
      <nav aria-label="Documents légaux" className="flex flex-wrap gap-x-5 gap-y-2">
        {LINKS.map((item) => (
          <Link key={item.href} href={item.href} className="footer-gradient-link">
            {item.label}
          </Link>
        ))}
      </nav>
      <p>
        © {year} {c.legalName || AFFISELL_LEGAL_IDENTITY.legalName} — {c.name} — SIRET {c.siret} —{" "}
        {c.vatRegime || AFFISELL_LEGAL_IDENTITY.vatRegimeFr}
      </p>
    </div>
  )
}

export const LEGAL_FOOTER_LINKS = LINKS
