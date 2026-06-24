import { ItemTaxLineDTO, MedusaContainer, ShippingTaxLineDTO } from "@medusajs/types";
/**
 * Applies translations to tax lines. If you are using a tax provider that doesn't have TaxRates defined in the database,
 * you should apply the translations inside of your tax provider's `getTaxLines` method, using the `locale` provided in the context.
 *
 * @param taxLines - The tax lines to apply translations to.
 * @param locale - The locale to apply translations to.
 * @param container - The container to use for the translations.
 * @returns The tax lines with translations applied.
 */
export declare const applyTranslationsToTaxLines: (taxLines: ItemTaxLineDTO[] | ShippingTaxLineDTO[], locale: string | undefined, container: MedusaContainer) => Promise<ItemTaxLineDTO[] | ShippingTaxLineDTO[]>;
//# sourceMappingURL=apply-translations-to-tax-lines.d.ts.map