/** User-facing copy for credentials portal enforcement (FR). */
export function messageForCredentialsSignInCode(code: string | undefined): string | null {
  switch (code) {
    case "supplier_on_affiliate_portal":
      return "Connexion refusée : ce compte est un compte fournisseur. Utilisez la connexion vendeur (espace supplier)."
    case "affiliate_on_supplier_portal":
      return "Connexion refusée : ce compte est affilié. Utilisez la connexion affilié, pas l’espace fournisseur."
    case "non_affiliate_on_affiliate_portal":
      return "Connexion refusée : seuls les comptes affiliés sont autorisés pour cette destination."
    case "non_supplier_on_supplier_portal":
      return "Connexion refusée : seuls les comptes fournisseur sont autorisés pour cette destination."
    case "email_required_not_id":
      return "Connexion refusée : saisissez votre adresse e-mail (pas un identifiant interne / ID)."
    default:
      return null
  }
}
