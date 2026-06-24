import { FilterableTranslationProps, UpdateTranslationDataDTO, UpdateTranslationDTO } from "@medusajs/framework/types";
/**
 * The data to update translations.
 */
export type UpdateTranslationsStepInput = {
    /**
     * The filters to select the translations to update.
     */
    selector: FilterableTranslationProps;
    /**
     * The data to update in the translations.
     */
    update: UpdateTranslationDataDTO;
} | {
    /**
     * The translations to update by ID.
     */
    translations: UpdateTranslationDTO[];
};
export declare const updateTranslationsStepId = "update-translations";
/**
 * This step updates translations matching the specified filters or by ID.
 *
 * @since 2.12.3
 * @featureFlag translation
 *
 * @example
 * To update translations by their ID:
 *
 * ```ts
 * const data = updateTranslationsStep({
 *   translations: [
 *     { id: "trans_123", translations: { title: "Nouveau titre" } }
 *   ]
 * })
 * ```
 *
 * To update translations matching filters:
 *
 * ```ts
 * const data = updateTranslationsStep({
 *   selector: {
 *     reference_id: "prod_123",
 *     locale: "fr-FR"
 *   },
 *   update: {
 *     translations: { title: "Nouveau titre" }
 *   }
 * })
 * ```
 */
export declare const updateTranslationsStep: import("@medusajs/framework/workflows-sdk").StepFunction<UpdateTranslationsStepInput, import("@medusajs/framework/types").TranslationDTO[]>;
//# sourceMappingURL=update-translations.d.ts.map