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

function StripeMark() {
  return (
    <svg
      className="h-7 w-auto text-gray-300"
      viewBox="0 0 60 25"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Stripe"
    >
      <path
        fill="currentColor"
        d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.15 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.75 2.72-7.7 6.48-7.7 3.92 0 5.98 2.97 5.98 7.38 0 .4-.04 1.12-.1 1.78zm-5.92-5.62c-1.03 0-2.17.73-2.17 2.58h4.25c0-1.85-1.07-2.58-2.08-2.58zM40.95 20.3c-1.44 0-2.32-.8-2.9-1.68l-.23 1.48h-3.76V.64h4.1v9.98c.6-1.12 1.48-1.85 2.76-1.85 2.38 0 3.72 2.02 3.72 5.88s-1.34 5.15-3.69 5.15zm-.98-9.3c-1.03 0-1.9.73-2.1 1.63v5.62c.2.85.98 1.52 2.1 1.52 1.6 0 2.48-1.5 2.48-4.3 0-2.85-.88-4.47-2.48-4.47zM28.24 20.3c-3.4 0-5.92-2.48-5.92-7.38 0-4.93 2.52-7.7 6.08-7.7 3.28 0 5.64 2.1 5.64 6.48v1.12H22.5c.15 2.52 1.55 3.8 3.72 3.8 1.48 0 2.6-.3 3.55-.85v3.4a8.46 8.46 0 0 1-3.53.73zm.98-12.1c-1.5 0-2.45 1.05-2.54 2.8h5.08c-.1-1.75-1.05-2.8-2.54-2.8zM14.25 20.05H10.1V.64h4.1v19.41zM6.66 20.05H2.51V.64h4.1v19.41z"
      />
    </svg>
  )
}

export function Footer() {
  const company = readCompanyLegal()
  const year = new Date().getFullYear()

  return (
    <footer
      role="contentinfo"
      className="mt-auto border-t border-gray-800 bg-gray-900 text-gray-300"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
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
              <FooterLink href="/contact">Contact</FooterLink>
              <FooterLink href="/track-order">Suivre ma commande</FooterLink>
            </ul>
          </nav>

          <div aria-labelledby="footer-payment-heading">
            <h2 id="footer-payment-heading" className="text-sm font-semibold uppercase tracking-wider text-white">
              Paiement sécurisé
            </h2>
            <div className="mt-4 space-y-3">
              <StripeMark />
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
