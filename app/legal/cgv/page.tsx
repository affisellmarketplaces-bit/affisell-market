import type { Metadata } from "next"
import Link from "next/link"

import { LegalLaunchShell, LegalSection } from "@/components/legal/legal-launch-shell"
import { AFFISELL_LEGAL_IDENTITY } from "@/lib/legal/auto-entreprise-identity"
import { readCompanyLegal } from "@/lib/legal/company-env"
import { EU_CONSUMER_ODR_URL } from "@/lib/legal/mentions-constants"

export const metadata: Metadata = {
  title: "Conditions générales de vente (CGV) | Affisell",
  description:
    "CGV Affisell — marketplace B2B/B2C, DropForge, fulfillment AliExpress / Amazon, rétractation 14 jours.",
  robots: { index: true, follow: true },
}

export default function LegalCgvPage() {
  const c = readCompanyLegal()

  return (
    <LegalLaunchShell
      title="Conditions générales de vente"
      description="Règles applicables aux achats sur Affisell (consommateurs UE et professionnels)."
    >
      <LegalSection id="roles" title="1. Qui vend quoi">
        <p>
          Affisell est édité par l’entreprise individuelle {c.legalName} (SIRET {c.siret}). Pour chaque commande :
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            le <strong className="text-zinc-900 dark:text-white">contrat de vente du produit</strong> est conclu entre
            l’acheteur et le <strong className="text-zinc-900 dark:text-white">fournisseur</strong> identifié sur la
            fiche ;
          </li>
          <li>
            le revendeur / affilié agit en <strong className="text-zinc-900 dark:text-white">curateur</strong> (vitrine)
            et n’est pas le vendeur des marchandises ;
          </li>
          <li>
            Affisell agit comme <strong className="text-zinc-900 dark:text-white">intermédiaire technique</strong>{" "}
            (paiement, outils, médiation), sauf mention contraire.
          </li>
        </ul>
        <p className="text-xs text-zinc-500">{c.vatRegime || AFFISELL_LEGAL_IDENTITY.vatRegimeFr}.</p>
      </LegalSection>

      <LegalSection id="dropforge" title="2. DropForge & sources fournisseurs">
        <p>
          <strong className="text-zinc-900 dark:text-white">DropForge</strong> permet d’importer des fiches produit
          depuis des fournisseurs tiers (ex. AliExpress, Amazon, autres catalogues).
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-zinc-900 dark:text-white">AliExpress / canaux auto</strong> : fulfillment pouvant
            être automatisé (auto-buy) lorsque activé et disponible ;
          </li>
          <li>
            <strong className="text-zinc-900 dark:text-white">Amazon / sources manuelles</strong> : fulfillment{" "}
            <em>manual</em> — le fournisseur ou l’opérateur traite la commande hors auto-buy ;
          </li>
          <li>
            les descriptions, stocks, prix d’achat et délais dépendent du fournisseur tiers et peuvent varier ;
          </li>
          <li>
            Affisell ne garantit pas l’exactitude permanente des catalogues externes, mais s’efforce d’afficher des
            informations vérifiées au moment de la publication.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="prix" title="3. Prix, paiement & facturation">
        <p>
          Les prix sont indiqués en euros. Le paiement s’effectue via <strong className="text-zinc-900 dark:text-white">Stripe</strong>.
          La commande est confirmée après acceptation du paiement. Les frais de livraison, s’ils s’appliquent, sont
          rappelés avant validation.
        </p>
      </LegalSection>

      <LegalSection id="delais" title="4. Livraison — délais variables">
        <p>
          Les délais dépendent du fournisseur, du mode de fulfillment (auto vs manuel) et des contrôles douaniers.
          Sauf indication contraire sur la fiche, un délai estimatif de{" "}
          <strong className="text-zinc-900 dark:text-white">15 à 30 jours ouvrés</strong> peut s’appliquer pour les
          envois internationaux. Un suivi est communiqué lorsqu’il est fourni par le transporteur / fournisseur.
        </p>
      </LegalSection>

      <LegalSection id="retract" title="5. Rétractation 14 jours (consommateurs UE)">
        <p>
          Conformément aux articles L221-18 et suivants du Code de la consommation, le consommateur dispose de{" "}
          <strong className="text-zinc-900 dark:text-white">14 jours</strong> à compter de la réception pour se
          rétracter, sous réserve des exceptions légales. Détails et modalités :{" "}
          <Link href="/legal/retractation" className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            page Rétractation
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="b2b" title="6. Achats professionnels (B2B)">
        <p>
          Pour les acheteurs agissant à titre professionnel, le droit de rétractation consommateur ne s’applique pas.
          Les délais, retours et garanties suivent les conditions négociées ou affichées pour le compte professionnel.
        </p>
      </LegalSection>

      <LegalSection id="garanties" title="7. Garanties">
        <p>
          Les consommateurs bénéficient de la garantie légale de conformité et, le cas échéant, des vices cachés.
          Signalez un défaut via{" "}
          <a href={`mailto:${c.supportEmail}`} className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            {c.supportEmail}
          </a>{" "}
          avec photos et n° de commande.
        </p>
      </LegalSection>

      <LegalSection id="litiges" title="8. Médiation">
        <p>
          Réclamation amiable d’abord, puis plateforme ODR :{" "}
          <a href={EU_CONSUMER_ODR_URL} className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300" target="_blank" rel="noreferrer">
            ec.europa.eu/consumers/odr
          </a>
          .
        </p>
      </LegalSection>
    </LegalLaunchShell>
  )
}
