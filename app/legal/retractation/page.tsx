import type { Metadata } from "next"
import Link from "next/link"

import { LegalLaunchShell, LegalSection } from "@/components/legal/legal-launch-shell"
import { readCompanyLegal } from "@/lib/legal/company-env"

export const metadata: Metadata = {
  title: "Droit de rétractation | Affisell",
  description: "Rétractation 14 jours — modalités Affisell pour les consommateurs UE.",
  robots: { index: true, follow: true },
}

export default function LegalRetractationPage() {
  const c = readCompanyLegal()

  return (
    <LegalLaunchShell
      title="Droit de rétractation"
      description="Comment exercer votre droit de rétractation de 14 jours (consommateurs situés dans l’UE)."
    >
      <LegalSection id="delai" title="1. Délai">
        <p>
          Vous disposez de <strong className="text-zinc-900 dark:text-white">14 jours calendaires</strong> à compter de
          la réception du bien pour vous rétracter, sans motif, conformément aux articles L221-18 et suivants du Code
          de la consommation.
        </p>
      </LegalSection>

      <LegalSection id="exclusions" title="2. Exceptions">
        <p>
          Certains biens sont exclus (biens personnalisés, scellés ouverts ne pouvant être repris pour des raisons
          d’hygiène, contenus numériques fournis immédiatement avec accord préalable, etc.). Les exclusions légales
          s’appliquent.
        </p>
      </LegalSection>

      <LegalSection id="exercice" title="3. Comment exercer">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Écrivez à{" "}
            <a href={`mailto:${c.supportEmail}`} className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
              {c.supportEmail}
            </a>{" "}
            avec votre n° de commande et votre décision claire de vous rétracter.
          </li>
          <li>Nous confirmons la procédure de retour (adresse fournisseur / consignes).</li>
          <li>
            Renvoyez le produit dans son état d’origine, non utilisé, emballage intact, dans les délais indiqués.
          </li>
        </ol>
        <p className="text-xs text-zinc-500">
          Les frais de retour sont en principe à votre charge, sauf produit défectueux / non conforme.
        </p>
      </LegalSection>

      <LegalSection id="remboursement" title="4. Remboursement">
        <p>
          Après réception et contrôle du retour (ou accord sur preuve), le remboursement est effectué sur le moyen de
          paiement initial, sous 14 jours (art. L221-24).
        </p>
      </LegalSection>

      <LegalSection id="dropforge" title="5. Commandes DropForge / fournisseurs tiers">
        <p>
          Lorsque le fulfillment est assuré par un fournisseur tiers (auto AliExpress ou manuel Amazon), le retour peut
          être adressé selon les consignes du fournisseur. Affisell reste votre interlocuteur pour coordonner la
          demande.
        </p>
        <p>
          Voir aussi les{" "}
          <Link href="/legal/cgv" className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            CGV
          </Link>{" "}
          et la page{" "}
          <Link href="/returns" className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            Retours
          </Link>
          .
        </p>
      </LegalSection>
    </LegalLaunchShell>
  )
}
