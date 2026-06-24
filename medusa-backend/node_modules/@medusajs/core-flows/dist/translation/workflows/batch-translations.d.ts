import { CreateTranslationDTO, UpdateTranslationDTO } from "@medusajs/types";
export declare const batchTranslationsWorkflowId = "batch-translations";
/**
 * The translations to manage.
 */
export type BatchTranslationsWorkflowInput = {
    /**
     * The translations to create.
     */
    create: CreateTranslationDTO[];
    /**
     * The translations to update.
     */
    update: UpdateTranslationDTO[];
    /**
     * The IDs of the translations to delete.
     */
    delete: string[];
};
/**
 * This workflow creates, updates, and deletes translations. It's used by the
 * [Manage Translations Admin API Route](https://docs.medusajs.com/api/admin#translations_posttranslationsbatch).
 *
 * You can use this workflow within your own customizations or custom workflows, allowing you
 * to create, update, and delete translations in your custom flows.
 *
 * @since 2.12.3
 * @featureFlag translation
 *
 * @example
 * const { result } = await batchTranslationsWorkflow(container)
 * .run({
 *   input: {
 *     create: [
 *       {
 *         reference_id: "prod_123",
 *         reference: "product",
 *         locale_code: "en-US",
 *         translations: {
 *           title: "Product Title",
 *           description: "Product Description",
 *         },
 *       }
 *     ],
 *     update: [
 *       {
 *         id: "trans_123",
 *         translations: {
 *           title: "Product Title",
 *           description: "Product Description",
 *         },
 *       }
 *     ],
 *     delete: ["trans_321"]
 *   }
 * })
 *
 * @summary
 *
 * Create, update, and delete translations.
 */
export declare const batchTranslationsWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<BatchTranslationsWorkflowInput, {
    created: import("@medusajs/types").TranslationDTO[];
    updated: import("@medusajs/types").TranslationDTO[];
    deleted: unknown;
}, []>;
//# sourceMappingURL=batch-translations.d.ts.map