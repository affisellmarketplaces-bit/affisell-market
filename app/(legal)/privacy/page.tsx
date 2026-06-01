import type { Metadata } from "next"

import { LegalPageShell } from "@/components/legal/legal-page-shell"
import { readCompanyLegal } from "@/lib/legal/company-env"

export const metadata: Metadata = {
  title: "Politique de confidentialité | Affisell",
  description: "RGPD — collecte, finalités, droits, cookies, Stripe, transferts Affisell.",
}

const LAST_UPDATED = "2026-06-01"

export default function PrivacyPage() {
  const c = readCompanyLegal()

  return (
    <LegalPageShell
      title="Politique de confidentialité (RGPD)"
      description="Comment Affisell traite vos données personnelles conformément au RGPD et à la loi Informatique et Libertés."
      lastUpdated={LAST_UPDATED}
    >
      <h2>1. Responsable du traitement</h2>
      <p>
        {c.name} — {c.address} — SIRET {c.siret}.
        <br />
        Contact données : <a href={`mailto:${c.dpoEmail}`}>{c.dpoEmail}</a>
      </p>

      <h2>2. Données collectées</h2>
      <ul>
        <li>
          <strong>Compte :</strong> nom, email, mot de passe (hash), rôle (client, affilié, fournisseur).
        </li>
        <li>
          <strong>Commande :</strong> adresse de livraison, email, téléphone si fourni, historique d&apos;achats.
        </li>
        <li>
          <strong>Paiement :</strong> données de carte traitées exclusivement par <strong>Stripe</strong> (Affisell
          ne stocke pas les numéros de carte complets).
        </li>
        <li>
          <strong>Navigation :</strong> cookies techniques, logs, identifiants de session, analytics si vous y consentez.
        </li>
        <li>
          <strong>Support :</strong> contenu des messages envoyés via le formulaire de contact.
        </li>
      </ul>

      <h2>3. Finalités et bases légales</h2>
      <ul>
        <li>Exécution du contrat (commande, livraison, SAV) — art. 6(1)(b) RGPD.</li>
        <li>Lutte contre la fraude et sécurité — intérêt légitime / obligation légale.</li>
        <li>Facturation et obligations comptables — obligation légale.</li>
        <li>Marketing (newsletter, offres) — uniquement avec votre <strong>consentement</strong>, révocable à tout moment.</li>
        <li>Amélioration du service et statistiques — intérêt légitime ou consentement selon le traceur.</li>
      </ul>

      <h2>4. Destinataires et sous-traitants</h2>
      <p>Vos données peuvent être communiquées à :</p>
      <ul>
        <li>
          <strong>Stripe, Inc.</strong> (paiement) — sous-traitant certifié PCI-DSS ;
        </li>
        <li>
          <strong>Vercel Inc.</strong> (hébergement) ;
        </li>
        <li>
          Fournisseurs logistiques et partenaires techniques strictement nécessaires à la commande ;
        </li>
        <li>
          Autorités compétentes sur réquisition légale.
        </li>
      </ul>
      <p>
        Une liste actualisée des sous-traitants peut être obtenue sur demande à {c.dpoEmail}.
      </p>

      <h2>5. Transferts hors Union européenne</h2>
      <p>
        Certains prestataires (ex. Stripe, Vercel) peuvent traiter des données aux États-Unis ou dans d&apos;autres pays.
        Ces transferts reposent sur les <strong>clauses contractuelles types</strong> de la Commission européenne ou
        mécanismes équivalents, ainsi que les garanties contractuelles des prestataires.
      </p>

      <h2>6. Durées de conservation</h2>
      <ul>
        <li>Données de compte : durée du compte + 3 ans après dernière activité (prospection) sauf obligation contraire.</li>
        <li>Données de commande et facturation : 10 ans (obligations comptables).</li>
        <li>Logs techniques : jusqu&apos;à 12 mois sauf litige en cours.</li>
        <li>Cookies : selon la durée indiquée dans le bandeau cookies.</li>
      </ul>

      <h2>7. Vos droits</h2>
      <p>
        Vous disposez des droits d&apos;<strong>accès, rectification, effacement, limitation, portabilité,
        opposition</strong> et de retrait du consentement. Pour les exercer :{" "}
        <a href={`mailto:${c.dpoEmail}`}>{c.dpoEmail}</a> ou via{" "}
        <a href="/marketplace/account/gdpr">votre espace RGPD</a> lorsque connecté.
      </p>
      <p>
        Réclamation auprès de la CNIL :{" "}
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
          www.cnil.fr
        </a>
        .
      </p>

      <h2>8. Cookies</h2>
      <p>
        Des cookies strictement nécessaires assurent le panier et la session. Les cookies analytics ou marketing ne sont
        déposés qu&apos;avec votre accord via le gestionnaire de consentement. Vous pouvez retirer votre consentement à
        tout moment. Voir aussi <a href="/legal/cookies-policy">politique cookies (détail)</a>.
      </p>

      <h2>9. Sécurité</h2>
      <p>
        Affisell met en œuvre des mesures techniques et organisationnelles appropriées (HTTPS, contrôle d&apos;accès,
        hachage des mots de passe, journalisation des accès sensibles).
      </p>

      <h2>10. Mineurs</h2>
      <p>Le service n&apos;est pas destiné aux personnes de moins de 16 ans sans autorisation parentale.</p>
    </LegalPageShell>
  )
}
