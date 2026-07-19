/**
 * Alias — DB kind remains `stocker`; UI/email wording is Grossiste.
 * Prefer importing from `@/emails/supplier-welcome-grossiste`.
 */
export {
  SupplierWelcomeGrossisteEmail as SupplierWelcomeStockerEmail,
  SupplierWelcomeGrossisteEmail as default,
  type SupplierWelcomeGrossisteEmailProps as SupplierWelcomeStockerEmailProps,
} from "@/emails/supplier-welcome-grossiste"
