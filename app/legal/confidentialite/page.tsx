import type { Metadata } from "next"
import Link from "next/link"

import { LegalLaunchShell, LegalSection } from "@/components/legal/legal-launch-shell"
import { AFFISELL_LEGAL_IDENTITY } from "@/lib/legal/auto-entreprise-identity"
import { readCompanyLegal } from "@/lib/legal/company-env"

export const metadata: Metadata = {
  title: "Politique de confidentialité | Affisell",
  description:
    "RGPD Affisell — traitements, sous-traitants (Vercel, Supabase, Stripe, ScrapingBee, AliExpress), droits des personnes.",
  robots: { index: true, follow: true },
}

export default function LegalConfidentialitePage() {
  const c = readCompanyLegal()

  return (
    <LegalLaunchShell
      title="Politique de confidentialité"
      description="Comment Affisell traite vos données personnelles (RGPD / Loi Informatique et Libertés)."
    >
      <LegalSection id="responsable" title="1. Responsable de traitement">
        <p>
          Responsable : entreprise individuelle <strong className="text-zinc-900 dark:text-white">{c.legalName}</strong>{" "}
          (marque Affisell), SIRET {c.siret}.
        </p>
        <p>
          Contact / DPO opérationnel :{" "}
          <a href={`mailto:${c.dpoEmail}`} className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            {c.dpoEmail}
          </a>
        </p>
      </LegalSection>

      <LegalSection id="finalites" title="2. Finalités">
        <ul className="list-disc space-y-1 pl-5">
          <li>Création et gestion de compte</li>
          <li>Traitement des commandes et paiements</li>
          <li>Support client et prévention de la fraude</li>
          <li>Amélioration produit (analytics, si consentement)</li>
          <li>Obligations légales (comptabilité, litiges)</li>
          <li>Imports DropForge (fiches produit, fulfillment)</li>
        </ul>
      </LegalSection>

      <LegalSection id="bases" title="3. Bases légales">
        <p>
          Exécution du contrat, obligation légale, intérêt légitime (sécurité, amélioration), et consentement
          (cookies non essentiels, marketing).
        </p>
      </LegalSection>

      <LegalSection id="sous-traitants" title="4. Sous-traitants & destinataires">
        <ul className="list-disc space-y-1 pl-5">
          {AFFISELL_LEGAL_IDENTITY.processors.map((p) => (
            <li key={p.name}>
              <strong className="text-zinc-900 dark:text-white">{p.name}</strong> — {p.role}
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-500">
          Transferts hors UE possibles (ex. Vercel, États-Unis) encadrés par clauses contractuelles types / mesures
          appropriées lorsque requis.
        </p>
      </LegalSection>

      <LegalSection id="duree" title="5. Durées de conservation">
        <p>
          Données de compte : durée de la relation + délais légaux. Commandes : conservation comptable (généralement
          10 ans). Cookies : selon la{" "}
          <Link href="/legal/cookies" className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            politique cookies
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="droits" title="6. Vos droits">
        <p>
          Accès, rectification, effacement, limitation, opposition, portabilité, et retrait du consentement. Contact :{" "}
          <a href={`mailto:${c.dpoEmail}`} className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            {c.dpoEmail}
          </a>
          . Vous pouvez aussi saisir la CNIL (
          <a href="https://www.cnil.fr" className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300" target="_blank" rel="noreferrer">
            cnil.fr
          </a>
          ).
        </p>
      </LegalSection>
    </LegalLaunchShell>
  )
}
