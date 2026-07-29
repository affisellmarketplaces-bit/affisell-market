import type { Metadata } from "next"
import Link from "next/link"

import { LegalLaunchShell, LegalSection } from "@/components/legal/legal-launch-shell"
import { readCompanyLegal } from "@/lib/legal/company-env"

export const metadata: Metadata = {
  title: "Conditions générales d’utilisation (CGU) | Affisell",
  description: "CGU Affisell — accès à la plateforme, comptes, DropForge, règles d’usage.",
  robots: { index: true, follow: true },
}

export default function LegalCguPage() {
  const c = readCompanyLegal()

  return (
    <LegalLaunchShell
      title="Conditions générales d’utilisation"
      description="Règles d’accès et d’usage de la plateforme Affisell (visiteurs, acheteurs, revendeurs, fournisseurs)."
    >
      <LegalSection id="objet" title="1. Objet">
        <p>
          Les présentes CGU régissent l’accès au site et aux services Affisell (marketplace, DropForge, outils
          revendeur / fournisseur), édités par l’entreprise individuelle {c.legalName} (SIRET {c.siret}).
        </p>
      </LegalSection>

      <LegalSection id="compte" title="2. Compte & sécurité">
        <p>
          Vous êtes responsable de la confidentialité de vos identifiants et des actions réalisées depuis votre
          compte. Signalez immédiatement tout usage suspect à{" "}
          <a href={`mailto:${c.supportEmail}`} className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            {c.supportEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="roles" title="3. Rôles sur la plateforme">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-zinc-900 dark:text-white">Acheteur</strong> — consultation et commande de
            produits ;
          </li>
          <li>
            <strong className="text-zinc-900 dark:text-white">Revendeur / affilié</strong> — vitrine et curation ;
          </li>
          <li>
            <strong className="text-zinc-900 dark:text-white">Fournisseur</strong> — catalogue, stock, fulfillment
            (y compris via DropForge).
          </li>
        </ul>
        <p>
          Des conditions spécifiques peuvent s’appliquer :{" "}
          <Link href="/conditions-affilie" className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            conditions affilié
          </Link>
          ,{" "}
          <Link href="/conditions-fournisseur" className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            conditions fournisseur
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="usage" title="4. Usage acceptable">
        <p>
          Il est interdit d’utiliser Affisell pour des contenus illicites, trompeurs, contrefaits, ou pour contourner
          les mesures de sécurité, scrapers abusifs hors outils autorisés, ou spam.
        </p>
      </LegalSection>

      <LegalSection id="ip" title="5. Propriété intellectuelle">
        <p>
          Les éléments Affisell restent la propriété de {c.legalName} / Affisell. Les contenus produits par les
          marchands restent leur responsabilité (licéité, droits tiers).
        </p>
      </LegalSection>

      <LegalSection id="dispo" title="6. Disponibilité">
        <p>
          Nous visons une haute disponibilité sans engagement de service 100 %. Des maintenances peuvent intervenir.
          DropForge dépend aussi des APIs / catalogues tiers (disponibilité hors de notre contrôle exclusif).
        </p>
      </LegalSection>

      <LegalSection id="resiliation" title="7. Suspension">
        <p>
          Affisell peut suspendre un compte en cas de manquement grave aux CGU, fraude, ou risque légal, après
          notification lorsque cela est raisonnablement possible.
        </p>
      </LegalSection>

      <LegalSection id="droit" title="8. Droit applicable">
        <p>Droit français. Tribunaux compétents selon les règles protectrices du consommateur le cas échéant.</p>
      </LegalSection>
    </LegalLaunchShell>
  )
}
