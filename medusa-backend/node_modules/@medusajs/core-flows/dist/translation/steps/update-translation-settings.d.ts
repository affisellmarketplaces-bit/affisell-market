import { UpdateTranslationSettingsDTO } from "@medusajs/types";
export declare const updateTranslationSettingsStepId = "update-translation-settings";
export type UpdateTranslationSettingsStepInput = UpdateTranslationSettingsDTO | UpdateTranslationSettingsDTO[];
/**
 * This step updates translation settings based on the provided input.
 * It supports both single and multiple translation settings updates.
 * In case of failure, it compensates by restoring the previous translation settings.
 *
 * @since 2.13.0
 *
 * @example
 * const result = updateTranslationSettingsStep({
 *   id: "ts_123",
 *   fields: ["title", "description", "material"],
 *   is_active: false
 * })
 */
export declare const updateTranslationSettingsStep: import("@medusajs/framework/workflows-sdk").StepFunction<UpdateTranslationSettingsStepInput, import("@medusajs/types").TranslationSettingsDTO[]>;
//# sourceMappingURL=update-translation-settings.d.ts.map