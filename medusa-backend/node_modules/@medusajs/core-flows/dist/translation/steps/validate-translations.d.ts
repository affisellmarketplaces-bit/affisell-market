import { CreateTranslationDTO, UpdateTranslationDataDTO, UpdateTranslationDTO } from "@medusajs/types";
export declare const validateTranslationsStepId = "validate-translations";
export type ValidateTranslationsStepInput = CreateTranslationDTO[] | CreateTranslationDTO | UpdateTranslationDTO[] | UpdateTranslationDTO | UpdateTranslationDataDTO;
/**
 * This step validates that the translations are supported by the store.
 *
 * @since 2.12.3
 * @featureFlag translation
 *
 * @example
 * const data = validateTranslationsStep([
 *   {
 *     reference_id: "prod_123",
 *     reference: "product",
 *     locale: "fr-FR",
 *     translations: { title: "Produit", description: "Description du produit" }
 *   }
 * ])
 *
 * @privateRemarks
 * TODO: Do we want to validate anything else here?
 */
export declare const validateTranslationsStep: import("@medusajs/framework/workflows-sdk").StepFunction<ValidateTranslationsStepInput, undefined>;
//# sourceMappingURL=validate-translations.d.ts.map