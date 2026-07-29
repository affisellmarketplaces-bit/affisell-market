import type { Metadata } from "next"
import Link from "next/link"

import { LegalLaunchShell, LegalSection } from "@/components/legal/legal-launch-shell"
import { readCompanyLegal } from "@/lib/legal/company-env"

export const metadata: Metadata = {
  title: "Politique cookies | Affisell",
  description: "Cookies Affisell — essentiels, analytics, marketing, gestion du consentement RGPD.",
  robots: { index: true, follow: true },
}

export default function LegalCookiesPage() {
  const c = readCompanyLegal()

  return (
    <LegalLaunchShell
      title="Politique cookies"
      description="Quels cookies utilise Affisell, pourquoi, et comment gérer votre choix."
    >
      <LegalSection id="quoi" title="1. Qu’est-ce qu’un cookie ?">
        <p>
          Un cookie est un petit fichier stocké sur votre appareil. Certains sont indispensables au fonctionnement du
          site ; d’autres mesurent l’audience ou personnalisent l’expérience, uniquement avec votre accord.
        </p>
      </LegalSection>

      <LegalSection id="types" title="2. Catégories utilisées">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-zinc-900 dark:text-white">Essentiels</strong> — session, sécurité, panier,
            consentement (toujours actifs).
          </li>
          <li>
            <strong className="text-zinc-900 dark:text-white">Analytics</strong> — mesure d’audience anonymisée /
            agrégée (désactivés par défaut jusqu’à acceptation).
          </li>
          <li>
            <strong className="text-zinc-900 dark:text-white">Marketing</strong> — éventuels pixels / campagnes
            (désactivés sans consentement).
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="gestion" title="3. Gérer votre choix">
        <p>
          Le bandeau cookies permet d’accepter ou de refuser les cookies non essentiels. Vous pouvez aussi paramétrer
          votre navigateur. Pour toute question :{" "}
          <a href={`mailto:${c.dpoEmail}`} className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            {c.dpoEmail}
          </a>
          .
        </p>
        <p>
          Voir aussi la{" "}
          <Link href="/legal/confidentialite" className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            politique de confidentialité
          </Link>{" "}
          et les réglages détaillés sur{" "}
          <Link href="/cookies" className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            /cookies
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="duree" title="4. Durée">
        <p>
          Le consentement est mémorisé jusqu’à 180 jours (ou jusqu’à retrait). Les cookies de session expirent à la
          fermeture du navigateur sauf indication contraire.
        </p>
      </LegalSection>
    </LegalLaunchShell>
  )
}
