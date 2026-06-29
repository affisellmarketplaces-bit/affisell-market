import { readCompanyLegal } from "@/lib/legal/company-env"
import { CGU_LAST_UPDATED_LABEL } from "@/lib/legal/cgu"

/** Corps des CGU — variables société via .env (readCompanyLegal). */
export function CguDocumentBody() {
  const c = readCompanyLegal()
  const siren =
    c.siret.replace(/\D/g, "").length >= 9
      ? c.siret.replace(/\D/g, "").slice(0, 9)
      : c.siret
  const capital = c.capital.startsWith("[") ? "variable" : c.capital
  const tvaSuffix = siren.replace(/\D/g, "").slice(0, 11) || "XXXXXXXXXXX"

  return (
    <>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <strong>Dernière mise à jour : {CGU_LAST_UPDATED_LABEL}</strong>
      </p>

      <p>
        Les présentes Conditions générales d&apos;utilisation (« <strong>CGU</strong> ») régissent
        l&apos;accès et l&apos;utilisation de la plateforme <strong>Affisell</strong> (ci-après la «{" "}
        <strong>Plateforme</strong> »), éditée par <strong>{c.name}</strong>
        {capital !== "variable" ? (
          <>
            , société par actions simplifiée au capital de {capital} euros
          </>
        ) : null}
        , immatriculée au RCS d&apos;Aix-en-Provence sous le numéro {siren}, dont le siège social est
        situé {c.address}
        {tvaSuffix ? (
          <>, numéro de TVA intracommunautaire FR{tvaSuffix}</>
        ) : null}{" "}
        (ci-après « <strong>Affisell</strong> », « <strong>nous</strong> »).
      </p>
      <p>
        Directeur de la publication : <strong>{c.publisher}</strong>. Contact :{" "}
        <a href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a> — DPO :{" "}
        <a href={`mailto:${c.dpoEmail}`}>{c.dpoEmail}</a>.
      </p>

      <h2>Article 1 — Objet et champ d&apos;application</h2>
      <p>
        1.1. Affisell met à disposition une place de marché en ligne permettant à des{" "}
        <strong>Fournisseurs</strong> de proposer des produits, à des <strong>Affiliés</strong> (créateurs /
        partenaires) de les commercialiser via une vitrine dédiée, et à des <strong>Acheteurs</strong>{" "}
        d&apos;acheter ces produits.
      </p>
      <p>
        1.2. Affisell agit en qualité d&apos;<strong>hébergeur</strong> au sens de la loi n° 2004-575 du
        21 juin 2004 pour la confiance dans l&apos;économie numérique (LCEN).{" "}
        <strong>Affisell n&apos;est pas vendeur</strong> des produits proposés sur la Plateforme, sauf
        mention expresse contraire sur une fiche produit.
      </p>
      <p>
        1.3. Les CGU s&apos;appliquent à tout Utilisateur de la Plateforme. Les Fournisseurs et Affiliés
        sont également soumis à leurs conditions spécifiques respectives (
        <a href="/conditions-fournisseur">CGA</a> fournisseur, <a href="/conditions-affilie">CGS</a>{" "}
        affilié).
      </p>

      <h2>Article 2 — Définitions</h2>
      <ul>
        <li>
          <strong>Acheteur</strong> : personne physique ou morale passant commande via la Plateforme.
        </li>
        <li>
          <strong>Affilié</strong> : partenaire commercialisant les produits d&apos;un Fournisseur via un
          listing Affisell.
        </li>
        <li>
          <strong>Fournisseur</strong> : professionnel proposant des produits sur la Plateforme.
        </li>
        <li>
          <strong>Listing</strong> : fiche produit personnalisée par un Affilié (prix, médias, description).
        </li>
        <li>
          <strong>Commande</strong> : contrat de vente conclu entre l&apos;Acheteur et le Fournisseur,
          facilité par Affisell.
        </li>
      </ul>

      <h2>Article 3 — Inscription et compte</h2>
      <p>
        3.1. L&apos;inscription requiert des informations exactes et une acceptation des présentes CGU et
        de la <a href="/privacy">Politique de confidentialité</a>.
      </p>
      <p>3.2. L&apos;Utilisateur est responsable de la confidentialité de ses identifiants.</p>
      <p>
        3.3. Affisell peut suspendre ou résilier un compte en cas de violation des CGU, fraude,
        contrefaçon ou atteinte à l&apos;ordre public.
      </p>

      <h2>Article 4 — Rôle d&apos;Affisell et relation tripartite</h2>
      <p>
        4.1. Le contrat de vente du produit est conclu <strong>directement entre l&apos;Acheteur et le
        Fournisseur</strong>. L&apos;Affilié perçoit une rémunération (commission et/ou marge) selon les
        paramètres du listing et du catalogue.
      </p>
      <p>
        4.2. Affisell perçoit une <strong>commission de plateforme</strong> calculée sur le{" "}
        <strong>montant HT</strong> de la ligne commande (hors TVA), selon le barème en vigueur (taux par
        défaut <strong>10 %</strong>, variable par catégorie ou produit).
      </p>
      <p>
        4.3. Les paiements sont traités via <strong>Stripe</strong> (Stripe Connect pour les reversements
        Fournisseur et Affilié). Affisell n&apos;est pas établissement de paiement.
      </p>

      <h2>Article 5 — Prix, TVA et facturation</h2>
      <p>
        5.1. Les prix affichés à l&apos;Acheteur peuvent être indiqués TTC lorsque la TVA est collectée
        via Stripe Tax ou mécanisme équivalent.
      </p>
      <p>
        5.2. Le Fournisseur demeure responsable de ses obligations fiscales (TVA, facturation). Affisell
        fournit des données de transaction pour faciliter la comptabilité.
      </p>

      <h2>Article 6 — Paiements et reversements (payouts)</h2>
      <p>
        6.1. Les reversements aux Fournisseurs et Affiliés interviennent via <strong>Stripe Connect</strong>
        , en principe <strong>7 jours</strong> après confirmation de livraison ou délai légal applicable
        (J+7), sous réserve de litige, retour ou chargeback.
      </p>
      <p>
        6.2. Affisell peut retenir temporairement des fonds en cas de suspicion de fraude, non-conformité
        ou obligation légale.
      </p>
      <p>
        6.3. En cas de remboursement Acheteur, les commissions peuvent faire l&apos;objet d&apos;un{" "}
        <strong>clawback</strong> proportionnel (voir <a href="/legal/refund-policy">Politique de remboursement</a>).
      </p>

      <h2>Article 7 — Livraison et SLA expédition</h2>
      <p>
        7.1. Le Fournisseur s&apos;engage à expédier dans un délai maximal de <strong>48 heures ouvrées</strong>{" "}
        après paiement, sauf délai affiché plus long sur la fiche produit ou accord de prolongation via
        l&apos;outil « Ship Pulse ».
      </p>
      <p>7.2. Le non-respect répété du SLA peut entraîner pénalités, déréférencement ou résiliation (voir CGS).</p>

      <h2>Article 8 — Droit de rétractation et retours</h2>
      <p>
        8.1. L&apos;Acheteur consommateur bénéficie du droit de rétractation de <strong>14 jours</strong>{" "}
        pour les biens éligibles, sous réserve des exceptions légales (articles L221-28 et suivants du Code
        de la consommation).
      </p>
      <p>
        8.2. Les modalités pratiques sont détaillées dans la{" "}
        <a href="/legal/refund-policy">Politique de remboursement</a>.
      </p>

      <h2>Article 9 — Propriété intellectuelle</h2>
      <p>
        9.1. La Plateforme, sa marque, son code et ses contenus éditoriaux sont protégés. Toute reproduction
        non autorisée est interdite.
      </p>
      <p>
        9.2. Les Affiliés et Fournisseurs garantissent disposer des droits sur les contenus qu&apos;ils
        publient (images, textes, vidéos).
      </p>

      <h2>Article 10 — Responsabilité</h2>
      <p>10.1. Affisell est soumise à une obligation de moyens pour la disponibilité de la Plateforme.</p>
      <p>
        10.2. Affisell n&apos;est pas responsable des contenus publiés par les Utilisateurs, ni des
        manquements du Fournisseur (défaut de conformité, retard), dans les limites permises par la loi.
      </p>
      <p>
        10.3. En cas de faute prouvée d&apos;Affisell, la responsabilité est limitée au montant des
        commissions perçues sur la Commande concernée au cours des douze (12) derniers mois.
      </p>

      <h2>Article 11 — Données personnelles</h2>
      <p>
        Le traitement des données est décrit dans la{" "}
        <a href="/privacy">Politique de confidentialité</a>. L&apos;Utilisateur peut exercer ses droits
        RGPD depuis <a href="/dashboard/account/gdpr">son espace RGPD</a>.
      </p>

      <h2>Article 12 — Cookies</h2>
      <p>
        Voir la <a href="/legal/cookies-policy">Politique cookies</a>.
      </p>

      <h2>Article 13 — Modification des CGU</h2>
      <p>
        Affisell peut modifier les CGU. Les Utilisateurs seront informés en cas de changement substantiel.
        La poursuite d&apos;utilisation vaut acceptation si la loi l&apos;autorise.
      </p>

      <h2>Article 14 — Droit applicable et litiges</h2>
      <p>14.1. Les CGU sont soumises au <strong>droit français</strong>.</p>
      <p>
        14.2. En cas de litige avec un consommateur, les règles impératives de son pays de résidence peuvent
        s&apos;appliquer. Une solution amiable est recherchée préalablement à{" "}
        <a href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a>.
      </p>
      <p>
        14.3. À défaut, compétence des tribunaux du ressort du siège d&apos;Affisell, sous réserve d&apos;une
        attribution spécifique imposée par la loi.
      </p>

      <h2>Article 15 — Contact</h2>
      <p>
        <strong>{c.name}</strong> — {c.address} —{" "}
        <a href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a> — DPO :{" "}
        <a href={`mailto:${c.dpoEmail}`}>{c.dpoEmail}</a>.
      </p>
    </>
  )
}
