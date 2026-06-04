import { readCompanyLegal } from "@/lib/legal/company-env"
import { CGS_LAST_UPDATED_LABEL } from "@/lib/legal/cgs"

/** CGS — Conditions générales affilié / créateur (`/conditions-affilie`). */
export function CgsDocumentBody() {
  const c = readCompanyLegal()

  return (
    <>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <strong>Dernière mise à jour : {CGS_LAST_UPDATED_LABEL}</strong>
      </p>

      <p>
        Les présentes Conditions générales de services — applicables aux <strong>Affiliés</strong> / créateurs
        (« <strong>CGS</strong> ») — complètent les <a href="/cgu">CGU</a> d&apos;{c.name} (« Affisell »).
        En activant votre boutique affiliée, vous acceptez les CGS.
      </p>

      <h2>Article 1 — Objet</h2>
      <p>
        Les CGS encadrent la création de listings, la promotion de produits Fournisseurs, le calcul des
        commissions et vos obligations de transparence vis-à-vis du public.
      </p>

      <h2>Article 2 — Commission affilié</h2>
      <p>
        2.1. Votre rémunération combine la marge ou commission négociée sur chaque listing et une{" "}
        <strong>commission plateforme Affisell de 20 %</strong> prélevée sur vos gains nets, sauf mention
        contraire sur le catalogue ou un programme promotionnel.
      </p>
      <p>
        2.2. Les montants affichés dans votre dashboard sont indicatifs jusqu&apos;à confirmation du payout
        Stripe Connect.
      </p>

      <h2>Article 3 — Loi relative à l&apos;influence commerciale</h2>
      <p>
        3.1. Si vous diffusez du contenu promotionnel en France, vous respectez la{" "}
        <strong>loi du 9 juin 2023 relative à l&apos;influence commerciale</strong> (Loi Influenceurs) :
      </p>
      <ul>
        <li>mention claire du caractère commercial (partenariat, publicité, #ad, #pub selon le média) ;</li>
        <li>interdiction de présenter comme bénéfiques des produits que vous n&apos;avez pas testés lorsque la loi l&apos;exige ;</li>
        <li>respect des règles ARPP / déontologie professionnelle applicables à votre secteur.</li>
      </ul>
      <p>
        3.2. Affisell peut retirer un listing ou suspendre un compte en cas de signalement crédible ou
        d&apos;injonction d&apos;une autorité.
      </p>

      <h2>Article 4 — Publicité loyale</h2>
      <p>Il est strictement interdit de :</p>
      <ul>
        <li>publier des <strong>publicités mensongères</strong> ou des promesses de gain irréalistes ;</li>
        <li>masquer une relation commerciale avec Affisell ou un Fournisseur ;</li>
        <li>cibler des mineurs avec des contenus inadaptés ou des produits interdits ;</li>
        <li>utiliser des données personnelles d&apos;audience sans base légale RGPD.</li>
      </ul>

      <h2>Article 5 — Seuil d&apos;activité professionnelle</h2>
      <p>
        5.1. Lorsque vos revenus d&apos;affiliation dépassent <strong>5 000 € par an</strong> (seuil indicatif
        aligné sur les pratiques de déclaration d&apos;activité commerciale), vous vous engagez à :
      </p>
      <ul>
        <li>adopter un <strong>statut professionnel</strong> adapté (micro-entreprise, société, etc.) ;</li>
        <li>déclarer vos revenus aux administrations compétentes ;</li>
        <li>fournir à Affisell, sur demande, les justificatifs nécessaires au paiement et à la conformité
          Stripe Connect.</li>
      </ul>
      <p>
        5.2. Affisell peut bloquer les payouts tant que la vérification KYC / statut pro n&apos;est pas complète.
      </p>

      <h2>Article 6 — Propriété intellectuelle</h2>
      <p>
        Vous garantissez disposer des droits sur les médias (images, vidéos, textes) publiés dans vos listings.
        Une licence non exclusive est accordée à Affisell pour l&apos;exploitation marketing de la Plateforme.
      </p>

      <h2>Article 7 — Contact</h2>
      <p>
        Support affilié : <a href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a> — DPO :{" "}
        <a href={`mailto:${c.dpoEmail}`}>{c.dpoEmail}</a>. Voir aussi les <a href="/cgu">CGU</a>.
      </p>
      <p>
        <strong>{c.name}</strong> — {c.address}
      </p>
    </>
  )
}
