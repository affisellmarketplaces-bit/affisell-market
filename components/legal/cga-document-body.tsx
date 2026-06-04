import { readCompanyLegal } from "@/lib/legal/company-env"
import { CGA_LAST_UPDATED_LABEL } from "@/lib/legal/cga"
import { legalPlatformFeeLabels } from "@/lib/legal/fee-labels"

/** CGA — Conditions générales fournisseur (`/conditions-fournisseur`). */
export function CgaDocumentBody() {
  const c = readCompanyLegal()

  return (
    <>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <strong>Dernière mise à jour : {CGA_LAST_UPDATED_LABEL}</strong>
      </p>

      <p>
        Les présentes Conditions générales fournisseur (« <strong>CGA</strong> ») — applicables aux{" "}
        <strong>Fournisseurs</strong> — complètent les <a href="/cgu">CGU</a> d&apos;{c.name} (« Affisell »).
        En vous inscrivant en qualité de Fournisseur, vous acceptez sans réserve les CGA.
      </p>

      <h2>Article 1 — Objet</h2>
      <p>
        Les CGA régissent la mise en ligne de produits, la gestion des stocks, l&apos;expédition, le SAV
        produit et les reversements liés à votre activité sur la Plateforme Affisell.
      </p>

      <h2>Article 2 — Frais plateforme Affisell</h2>
      <p>
        2.1. Les frais par défaut (HT, hors TVA collectée) sont :
      </p>
      <ul>
        <li>
          <strong>Catalogue natif</strong> (vous expédiez) :{" "}
          <strong>{legalPlatformFeeLabels.supplierCatalog}</strong> sur le montant HT concerné ;
        </li>
        <li>
          <strong>Parcours auto-buy AE</strong> (achat automatisé Affisell) :{" "}
          <strong>{legalPlatformFeeLabels.supplierAutoBuy}</strong> ;
        </li>
        <li>
          un barème <strong>catégorie</strong>, <strong>produit</strong> ou <strong>compte fournisseur</strong>{" "}
          peut s&apos;appliquer lorsqu&apos;il est affiché dans votre espace ou sur la fiche produit.
        </li>
      </ul>
      <p>
        2.2. Sur certaines commandes historiques, un taux unique de{" "}
        <strong>{legalPlatformFeeLabels.legacyOrderHtPercent} HT</strong> (produits + livraison, hors TVA) peut
        figurer sur la commande ; il est indicatif du barème en vigueur à la date de vente.
      </p>
      <p>
        2.3. Les frais couvrent l&apos;hébergement marketplace, Stripe (paiement, Connect, 3D Secure), la
        médiation litiges et les outils opérationnels (analytics, notifications, conformité).
      </p>

      <h2>Article 3 — Délai d&apos;expédition</h2>
      <p>
        3.1. Vous vous engagez à expédier tout colis payé dans un délai maximal de{" "}
        <strong>72 heures ouvrées</strong> (SLA 72h), sauf délai plus long explicitement indiqué sur la fiche
        produit et accepté par l&apos;Acheteur.
      </p>
      <p>
        3.2. Le non-respect répété du SLA peut entraîner une dégradation de visibilité catalogue, des
        pénalités contractuelles ou la suspension du compte.
      </p>

      <h2>Article 4 — Pénalités stock et rupture</h2>
      <p>4.1. Vous garantissez l&apos;exactitude des stocks synchronisés sur Affisell.</p>
      <ul>
        <li>
          <strong>Rupture non signalée</strong> : commande acceptée alors que le produit est indisponible —
          remboursement intégral Acheteur + pénalité forfaitaire selon barème interne Affisell ;
        </li>
        <li>
          <strong>Stock fantôme</strong> : taux d&apos;annulation &gt; 2 % sur 30 jours — restriction des
          nouveaux listings ;
        </li>
        <li>
          <strong>Non-expédition &gt; 72h</strong> : annulation automatique possible et retenue temporaire des
          fonds en attente.
        </li>
      </ul>

      <h2>Article 5 — Reversements (payout) Stripe Connect</h2>
      <p>
        5.1. Les reversements s&apos;effectuent via <strong>Stripe Connect</strong> après livraison effective et,
        le cas échéant, <strong>confirmation acheteur</strong> ou délai de silence réglementaire (voir CGU).
        Le versement net intervient en principe sous <strong>
          {legalPlatformFeeLabels.payoutDaysAfterBuyerConfirm} jours calendaires
        </strong>{" "}
        après confirmation de réception par l&apos;acheteur, sous réserve de litige, chargeback, KYC incomplet ou
        obligation légale de conservation.
      </p>
      <p>
        5.2. Vous maintenez un compte Connect valide (identité, IBAN, informations fiscales). Affisell peut
        bloquer un payout en cas de suspicion de fraude, de non-conformité produit ou d&apos;injonction
        d&apos;une autorité.
      </p>
      <p>
        5.3. Les montants affichés dans le dashboard sont <strong>indicatifs</strong> jusqu&apos;à validation
        Stripe et passage en statut payé.
      </p>

      <h2>Article 6 — Garantie produit et conformité</h2>
      <p>
        6.1. Vous êtes seul responsable de la <strong>conformité</strong>, de la <strong>sécurité</strong> et
        de la <strong>description exacte</strong> des produits (garantie légale de conformité, vices cachés,
        étiquetage, réglementation sectorielle).
      </p>
      <p>
        6.2. Vous indemnisez Affisell contre toute réclamation d&apos;un Acheteur ou d&apos;un tiers liée à vos
        produits, dans les limites permises par la loi.
      </p>

      <h2>Article 7 — Données et contact</h2>
      <p>
        Le traitement des données est décrit dans la <a href="/privacy">Politique de confidentialité</a>.
        Questions CGA : <a href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a> — DPO :{" "}
        <a href={`mailto:${c.dpoEmail}`}>{c.dpoEmail}</a>.
      </p>
      <p>
        <strong>{c.name}</strong> — {c.address}
      </p>
    </>
  )
}
