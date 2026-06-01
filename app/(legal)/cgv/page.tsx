import type { Metadata } from "next"

import { LegalPageShell } from "@/components/legal/legal-page-shell"
import { readCompanyLegal } from "@/lib/legal/company-env"

export const metadata: Metadata = {
  title: "Conditions générales de vente | Affisell",
  description:
    "CGV Affisell — marketplace dropshipping UE : mandataire, délais, rétractation, TVA, litiges.",
}

const LAST_UPDATED = "2026-06-01"

export default function CgvPage() {
  const c = readCompanyLegal()

  return (
    <LegalPageShell
      title="Conditions générales de vente (CGV)"
      description="Applicables aux achats réalisés sur la marketplace Affisell par des consommateurs situés dans l'Union européenne."
      lastUpdated={LAST_UPDATED}
    >
      <h2>1. Identité du vendeur et rôle d&apos;Affisell</h2>
      <p>
        <strong>{c.name}</strong> ({c.address}, SIRET {c.siret}) exploite la plateforme Affisell.
        Pour chaque commande, le contrat de vente du produit est conclu entre vous (le client) et le{" "}
        <strong>fournisseur (Supplier)</strong> identifié sur la fiche produit. Affisell agit en qualité de{" "}
        <strong>mandataire et intermédiaire technique</strong> (paiement, facturation, médiation) :{" "}
        <strong>Affisell n&apos;est pas le vendeur</strong> des marchandises, sauf mention contraire explicite.
      </p>

      <h2>2. Prix, TVA et facturation</h2>
      <p>
        Les prix affichés incluent la TVA applicable au moment de la commande lorsque la mention « TVA incluse »
        figure sur la page produit. La facture est émise au nom de {c.name} en tant qu&apos;intermédiaire de
        facturation ou selon les règles fiscales applicables au fournisseur. Les frais de livraison, le cas
        échéant, sont indiqués avant validation du paiement.
      </p>

      <h2>3. Paiement</h2>
      <p>
        Le règlement s&apos;effectue en ligne via <strong>Stripe</strong> (carte bancaire et moyens compatibles).
        La commande n&apos;est confirmée qu&apos;après acceptation du paiement par l&apos;établissement bancaire.
      </p>

      <h2>4. Livraison — délais indicatifs</h2>
      <p>
        Les produits proposés sur Affisell proviennent fréquemment d&apos;entrepôts situés en Asie ou en Europe.
        Sauf indication contraire sur la fiche produit, le <strong>délai de livraison estimé est de 15 à 30 jours
        ouvrés</strong> à compter de la confirmation de commande, hors cas de force majeure, contrôle douanier ou
        rupture de stock. Un numéro de suivi est communiqué lorsque le fournisseur l&apos;expédie.
      </p>

      <h2>5. Droit de rétractation (14 jours — UE)</h2>
      <p>
        Conformément aux articles L221-18 et suivants du Code de la consommation, vous disposez d&apos;un délai de{" "}
        <strong>14 jours calendaires</strong> à compter de la réception du produit pour exercer votre droit de
        rétractation, sans avoir à justifier de motifs. Le produit doit être retourné dans son état d&apos;origine,
        non utilisé, avec emballage intact. Les <strong>frais de retour sont à votre charge</strong>, sauf si le
        produit est défectueux, non conforme ou si la loi applicable impose le contraire.
      </p>
      <p>
        Pour exercer ce droit : contactez-nous à{" "}
        <a href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a> ou via la page{" "}
        <a href="/returns">Retours &amp; remboursements</a>.
      </p>

      <h2>6. Remboursement</h2>
      <p>
        Après réception et contrôle du retour (ou accord sur preuve de défaut), le remboursement est effectué sur le
        moyen de paiement initial, <strong>sous 14 jours</strong>, conformément à l&apos;article L221-24 du Code de
        la consommation. Les frais de livraison initiaux peuvent être remboursés selon les cas prévus par la loi.
      </p>

      <h2>7. Garanties légales</h2>
      <p>
        Vous bénéficiez de la garantie légale de conformité et, le cas échéant, de la garantie contre les vices
        cachés. En cas de défaut avéré, contactez le support avec photos ; une solution (échange, remboursement sans
        retour pour petits montants) pourra être proposée selon notre politique retours.
      </p>

      <h2>8. Litiges et médiation</h2>
      <p>
        En cas de réclamation, contactez d&apos;abord <a href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a>.
        À défaut de résolution amiable, vous pouvez recourir à une médiation de la consommation ou à la{" "}
        <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">
          plateforme européenne de règlement des litiges en ligne
        </a>
        . Le tribunal compétent reste celui prévu par les règles de droit applicable, sous réserve des dispositions
        impératives protectrices du consommateur de votre pays de résidence.
      </p>

      <h2>9. Données personnelles</h2>
      <p>
        Le traitement de vos données est décrit dans notre{" "}
        <a href="/privacy">politique de confidentialité</a>.
      </p>
    </LegalPageShell>
  )
}
