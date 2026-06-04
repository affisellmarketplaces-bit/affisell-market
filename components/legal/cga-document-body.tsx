import { readCompanyLegal } from "@/lib/legal/company-env"
import { CGA_LAST_UPDATED_LABEL } from "@/lib/legal/cga"

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

      <h2>Article 2 — Commission plateforme</h2>
      <p>
        2.1. Affisell prélève une <strong>commission de 12 % HT</strong> sur chaque ligne de commande
        réglée via la Plateforme, sauf barème catégorie ou produit affiché différemment sur votre espace
        fournisseur.
      </p>
      <p>
        2.2. La commission est déduite avant reversement ; elle couvre l&apos;hébergement marketplace, le
        paiement Stripe, la médiation et les outils opérationnels (analytics, Ship Pulse, litiges).
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

      <h2>Article 5 — Reversements (payout)</h2>
      <p>
        5.1. Les reversements s&apos;effectuent via <strong>Stripe Connect</strong>, en principe à{" "}
        <strong>J+2 ouvrés</strong> après confirmation de livraison ou preuve de remise au transporteur,
        sous réserve de litige, chargeback ou obligation légale de conservation.
      </p>
      <p>5.2. Affisell peut différer un payout en cas de suspicion de fraude ou de non-conformité produit.</p>

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
