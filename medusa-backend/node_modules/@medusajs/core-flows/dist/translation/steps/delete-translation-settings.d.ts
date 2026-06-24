export declare const deleteTranslationSettingsStepId = "delete-translation-settings";
/**
 * The IDs of the translation settings to be deleted.
 */
export type DeleteTranslationSettingsStepInput = string[];
/**
 * This step deletes translation settings based on the provided IDs.
 * It compensates by restoring the deleted translation settings in case of failure.
 *
 * @since 2.13.0
 *
 * @example
 * const result = deleteTranslationSettingsStep([
 *   "ts_123",
 *   "ts_456"
 * ])
 */
export declare const deleteTranslationSettingsStep: import("@medusajs/framework/workflows-sdk").StepFunction<DeleteTranslationSettingsStepInput, undefined>;
//# sourceMappingURL=delete-translation-settings.d.ts.map