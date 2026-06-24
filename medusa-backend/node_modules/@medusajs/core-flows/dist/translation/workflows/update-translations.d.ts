import { TranslationDTO } from "@medusajs/framework/types";
import { UpdateTranslationsStepInput } from "../steps";
/**
 * The translations to update.
 */
export type UpdateTranslationsWorkflowInput = UpdateTranslationsStepInput;
export declare const updateTranslationsWorkflowId = "update-translations";
/**
 * This workflow updates translations matching the specified filters or IDs. It's used by other
 * workflows like the {@link batchTranslationsWorkflow} workflow.
 *
 * You can use this workflow within your own customizations or custom workflows, allowing you
 * to update translations in your custom flows.
 *
 * @since 2.12.3
 * @featureFlag translation
 *
 * @example
 * To update translations by their IDs:
 *
 * ```ts
 * const { result } = await updateTranslationsWorkflow(container)
 * .run({
 *   input: {
 *     translations: [
 *       { id: "trans_123", translations: { title: "Nouveau titre" } }
 *     ]
 *   }
 * })
 * ```
 *
 * To update translations matching filters:
 *
 * ```ts
 * const { result } = await updateTranslationsWorkflow(container)
 * .run({
 *   input: {
 *     selector: { reference_id: "prod_123", locale: "fr-FR" },
 *     update: { translations: { title: "Nouveau titre" } }
 *   }
 * })
 * ```
 *
 * @summary
 *
 * Update translations.
 */
export declare const updateTranslationsWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<UpdateTranslationsStepInput, TranslationDTO[], []>;
//# sourceMappingURL=update-translations.d.ts.map