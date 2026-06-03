import Link from "next/link"
import type { ReactNode } from "react"

import { readCompanyLegal } from "@/lib/legal/company-env"
import { cn } from "@/lib/utils"

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-gray-300 transition-colors hover:text-white"
      >
        {children}
      </Link>
    </li>
  )
}

/** Legible Stripe mention (SVG wordmark was often misread as gibberish at small size). */
function StripeTrustBadge() {
  return (
    <div
      className="inline-flex items-center rounded-lg border border-gray-700 bg-gray-800/80 px-3 py-1.5"
      role="img"
      aria-label="Stripe"
    >
      <span className="text-base font-semibold tracking-tight text-[#635BFF]">Stripe</span>
    </div>
  )
}

export function Footer() {
  const company = readCompanyLegal()
  const year = new Date().getFullYear()

  return (
    <footer
      role="contentinfo"
      className="affisell-site-footer mt-auto shrink-0 border-t border-gray-800 bg-gray-900 text-gray-300"
    >
      <div className="affisell-site-footer__pad mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8 lg:pb-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <nav aria-labelledby="footer-affisell-heading">
            <h2 id="footer-affisell-heading" className="text-sm font-semibold uppercase tracking-wider text-white">
              Affisell
            </h2>
            <ul className="mt-4 space-y-2">
              <FooterLink href="/about">À propos</FooterLink>
              <FooterLink href="/how-it-works">Comment ça marche</FooterLink>
              <FooterLink href="/affiliate">Programme affilié</FooterLink>
              <FooterLink href="/supplier">Devenir fournisseur</FooterLink>
            </ul>
          </nav>

          <nav aria-labelledby="footer-legal-heading">
            <h2 id="footer-legal-heading" className="text-sm font-semibold uppercase tracking-wider text-white">
              Légal
            </h2>
            <ul className="mt-4 space-y-2">
              <FooterLink href="/cgv">CGV</FooterLink>
              <FooterLink href="/cgu">CGU</FooterLink>
              <FooterLink href="/mentions-legales">Mentions légales</FooterLink>
              <FooterLink href="/privacy">Politique de confidentialité</FooterLink>
              <FooterLink href="/returns">Retours &amp; remboursements</FooterLink>
            </ul>
          </nav>

          <nav aria-labelledby="footer-support-heading">
            <h2 id="footer-support-heading" className="text-sm font-semibold uppercase tracking-wider text-white">
              Support
            </h2>
            <ul className="mt-4 space-y-2">
              <FooterLink href="/faq">FAQ</FooterLink>
              <FooterLink href="/support">Assistant support</FooterLink>
              <FooterLink href="/shipping">Livraison</FooterLink>
              <FooterLink href="/contact">Contact</FooterLink>
              <FooterLink href="/track-order">Suivre ma commande</FooterLink>
            </ul>
          </nav>

          <div aria-labelledby="footer-payment-heading">
            <h2 id="footer-payment-heading" className="text-sm font-semibold uppercase tracking-wider text-white">
              Paiement sécurisé
            </h2>
            <div className="mt-4 space-y-3">
              <StripeTrustBadge />
              <p className="text-sm leading-relaxed text-gray-400">
                TVA collectée et reversée conformément à la réglementation applicable.
              </p>
              <p className="text-sm leading-relaxed text-gray-400">
                Paiements sécurisés par Stripe (carte bancaire, 3D Secure lorsque requis).
              </p>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "mt-10 border-t border-gray-800 pt-6 text-center text-xs text-gray-500 sm:text-left"
          )}
        >
          <p>
            © {year} Affisell — {company.name} — SIRET {company.siret} —{" "}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-white"
            >
              Règlement des litiges en ligne (UE)
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
