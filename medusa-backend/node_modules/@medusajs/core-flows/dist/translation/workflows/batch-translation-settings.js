"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchTranslationSettingsWorkflow = exports.batchTranslationSettingsWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const steps_1 = require("../steps");
exports.batchTranslationSettingsWorkflowId = "batch-translation-settings";
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
exports.batchTranslationSettingsWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.batchTranslationSettingsWorkflowId, (input) => {
    const [created, updated, deleted] = (0, workflows_sdk_1.parallelize)((0, steps_1.createTranslationSettingsStep)(input.create), (0, steps_1.updateTranslationSettingsStep)(input.update), (0, steps_1.deleteTranslationSettingsStep)(input.delete));
    return new workflows_sdk_1.WorkflowResponse({ created, updated, deleted });
});
//# sourceMappingURL=batch-translation-settings.js.map