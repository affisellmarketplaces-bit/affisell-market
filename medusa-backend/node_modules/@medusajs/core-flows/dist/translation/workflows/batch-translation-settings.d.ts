import { UpdateTranslationSettingsDTO, CreateTranslationSettingsDTO } from "@medusajs/types";
export declare const batchTranslationSettingsWorkflowId = "batch-translation-settings";
/**
 * The translation settings to manage.
 */
export interface BatchTranslationSettingsWorkflowInput {
    /**
     * Translation settings to create.
     */
    create: CreateTranslationSettingsDTO[];
    /**
     * Translation settings to update.
     */
    update: UpdateTranslationSettingsDTO[];
    /**
     * Translation settings IDs to delete.
     */
    delete: string[];
}
/**
 * This workflow creates, updates, and deletes translation settings in batch.
 * It's used by the [List Translation Settings API route](https://docs.medusajs.com/api/admin#translations_gettranslationssettings).
 *
 * You can use this workflow within your own customizations or custom workflows, allowing you
 * to create, update, and delete translation settings in your custom flows.
 *
 * @since 2.13.0
 * @featureFlag translation
 *
 * @example
 * const { result } = await batchTranslationSettingsWorkflow(container)
 * .run({
 *   create: [{
 *     entity_type: "product",
 *     fields: ["title", "description"],
 *     is_active: true
 *   }],
 *   update: [{
 *     id: "ts_123",
 *     is_active: false
 *   }],
 *   delete: ["ts_456"]
 * })
 *
 * @summary
 *
 * Create, update, and delete translation settings.
 */
export declare const batchTranslationSettingsWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<BatchTranslationSettingsWorkflowInput, {
    created: import("@medusajs/types").TranslationSettingsDTO[] & import("@medusajs/framework/workflows-sdk").WorkflowDataProperties<import("@medusajs/types").TranslationSettingsDTO[]> & {
        config(config: {
            name?: string;
        } & Omit<import("@medusajs/orchestration").TransactionStepsDefinition, "next" | "uuid" | "action">): import("@medusajs/framework/workflows-sdk").WorkflowData<import("@medusajs/types").TranslationSettingsDTO[]>;
    } & import("@medusajs/framework/workflows-sdk").StepFunctionReturnConfig<import("@medusajs/types").TranslationSettingsDTO[]>;
    updated: import("@medusajs/types").TranslationSettingsDTO[] & import("@medusajs/framework/workflows-sdk").WorkflowDataProperties<import("@medusajs/types").TranslationSettingsDTO[]> & {
        config(config: {
            name?: string;
        } & Omit<import("@medusajs/orchestration").TransactionStepsDefinition, "next" | "uuid" | "action">): import("@medusajs/framework/workflows-sdk").WorkflowData<import("@medusajs/types").TranslationSettingsDTO[]>;
    } & import("@medusajs/framework/workflows-sdk").StepFunctionReturnConfig<import("@medusajs/types").TranslationSettingsDTO[]>;
    deleted: never;
}, []>;
//# sourceMappingURL=batch-translation-settings.d.ts.map