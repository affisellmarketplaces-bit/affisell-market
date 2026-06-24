/**
 * The IDs of the translations to delete.
 */
export type DeleteTranslationsStepInput = string[];
export declare const deleteTranslationsStepId = "delete-translations";
/**
 * This step deletes one or more translations.
 *
 * @since 2.12.3
 * @featureFlag translation
 *
 * @example
 * const data = deleteTranslationsStep([
 *   "trans_123",
 *   "trans_456",
 * ])
 */
export declare const deleteTranslationsStep: import("@medusajs/framework/workflows-sdk").StepFunction<DeleteTranslationsStepInput, undefined>;
//# sourceMappingURL=delete-translations.d.ts.map