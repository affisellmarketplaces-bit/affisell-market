/**
 * The IDs of the translations to delete.
 */
export type DeleteTranslationsWorkflowInput = {
    /**
     * The IDs of the translations to delete.
     */
    ids: string[];
};
export declare const deleteTranslationsWorkflowId = "delete-translations";
/**
 * This workflow deletes one or more translations. It's used by other
 * workflows like the {@link batchTranslationsWorkflow} workflow.
 *
 * You can use this workflow within your own customizations or custom workflows, allowing you
 * to delete translations in your custom flows.
 *
 * @since 2.12.3
 * @featureFlag translation
 *
 * @example
 * const { result } = await deleteTranslationsWorkflow(container)
 * .run({
 *   input: {
 *     ids: ["trans_123"]
 *   }
 * })
 *
 * @summary
 *
 * Delete one or more translations.
 */
export declare const deleteTranslationsWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<DeleteTranslationsWorkflowInput, unknown, any[]>;
//# sourceMappingURL=delete-translations.d.ts.map