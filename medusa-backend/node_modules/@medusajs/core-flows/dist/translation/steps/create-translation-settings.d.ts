import { CreateTranslationSettingsDTO } from "@medusajs/types";
export declare const createTranslationSettingsStepId = "create-translation-settings";
export type CreateTranslationSettingsStepInput = CreateTranslationSettingsDTO | CreateTranslationSettingsDTO[];
/**
 * This step creates translation settings based on the provided input.
 * It supports both single and multiple translation settings creation.
 * In case of failure, it compensates by deleting the created translation settings.
 *
 * @since 2.13.0
 *
 * @example
 * const result = createTranslationSettingsStep({
 *   entity_type: "product",
 *   fields: ["title", "description", "material"],
 *   is_active: true
 * })
 */
export declare const createTranslationSettingsStep: import("@medusajs/framework/workflows-sdk").StepFunction<CreateTranslationSettingsStepInput, import("@medusajs/types").TranslationSettingsDTO[]>;
//# sourceMappingURL=create-translation-settings.d.ts.map