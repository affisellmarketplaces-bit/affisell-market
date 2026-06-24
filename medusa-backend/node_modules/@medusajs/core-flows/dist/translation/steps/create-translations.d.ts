import { CreateTranslationDTO } from "@medusajs/framework/types";
/**
 * The translations to create.
 */
export type CreateTranslationsStepInput = CreateTranslationDTO[];
export declare const createTranslationsStepId = "create-translations";
/**
 * This step creates one or more translations.
 *
 * @since 2.12.3
 * @featureFlag translation
 *
 * @example
 * const data = createTranslationsStep([
 *   {
 *     reference_id: "prod_123",
 *     reference: "product",
 *     locale: "fr-FR",
 *     translations: { title: "Produit", description: "Description du produit" }
 *   }
 * ])
 */
export declare const createTranslationsStep: import("@medusajs/framework/workflows-sdk").StepFunction<CreateTranslationsStepInput, import("@medusajs/framework/types").TranslationDTO[]>;
//# sourceMappingURL=create-translations.d.ts.map