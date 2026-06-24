"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchTranslationsWorkflow = exports.batchTranslationsWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const create_translations_1 = require("./create-translations");
const delete_translations_1 = require("./delete-translations");
const update_translations_1 = require("./update-translations");
exports.batchTranslationsWorkflowId = "batch-translations";
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
exports.batchTranslationsWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.batchTranslationsWorkflowId, (input) => {
    const [created, updated, deleted] = (0, workflows_sdk_1.parallelize)(create_translations_1.createTranslationsWorkflow.runAsStep({
        input: {
            translations: input.create,
        },
    }), update_translations_1.updateTranslationsWorkflow.runAsStep({
        input: {
            translations: input.update,
        },
    }), delete_translations_1.deleteTranslationsWorkflow.runAsStep({
        input: {
            ids: input.delete,
        },
    }));
    return new workflows_sdk_1.WorkflowResponse((0, workflows_sdk_1.transform)({ created, updated, deleted }, (result) => result));
});
//# sourceMappingURL=batch-translations.js.map