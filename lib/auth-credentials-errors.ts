import { CredentialsSignin } from "@auth/core/errors"

/** Supplier account used on an affiliate-only login target. */
export class SupplierBlockedOnAffiliatePortal extends CredentialsSignin {
  code = "supplier_on_affiliate_portal"
}

/** Affiliate account used on a supplier-only login target. */
export class AffiliateBlockedOnSupplierPortal extends CredentialsSignin {
  code = "affiliate_on_supplier_portal"
}

/** CUSTOMER or other role on affiliate-only login target. */
export class NonAffiliateOnAffiliatePortal extends CredentialsSignin {
  code = "non_affiliate_on_affiliate_portal"
}

/** CUSTOMER or other role on supplier-only login target. */
export class NonSupplierOnSupplierPortal extends CredentialsSignin {
  code = "non_supplier_on_supplier_portal"
}

export class EmailIdentifierRequired extends CredentialsSignin {
  code = "email_required_not_id"
}

/** Email not registered on Affisell. */
export class AccountNotFound extends CredentialsSignin {
  code = "account_not_found"
}

/** Password does not match the hash on file. */
export class InvalidPassword extends CredentialsSignin {
  code = "invalid_password"
}

/** Account exists but only OAuth sign-in (no password set yet). */
export class PasswordLoginNotAvailable extends CredentialsSignin {
  code = "password_login_unavailable"
}
