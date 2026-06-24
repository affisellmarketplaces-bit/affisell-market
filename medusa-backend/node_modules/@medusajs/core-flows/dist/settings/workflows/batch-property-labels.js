"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchPropertyLabelsWorkflow = exports.batchPropertyLabelsWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const create_property_label_1 = require("./create-property-label");
const delete_property_labels_1 = require("./delete-property-labels");
const update_property_label_1 = require("./update-property-label");
const conditionallyCreatePropertyLabels = (input) => (0, workflows_sdk_1.when)({ input }, ({ input }) => !!input.create?.length).then(() => create_property_label_1.createPropertyLabelsWorkflow.runAsStep({
    input: { property_labels: input.create },
}));
const conditionallyUpdatePropertyLabels = (input) => (0, workflows_sdk_1.when)({ input }, ({ input }) => !!input.update?.length).then(() => update_property_label_1.updatePropertyLabelsWorkflow.runAsStep({
    input: { property_labels: input.update },
}));
const conditionallyDeletePropertyLabels = (input) => (0, workflows_sdk_1.when)({ input }, ({ input }) => !!input.delete?.length).then(() => delete_property_labels_1.deletePropertyLabelsWorkflow.runAsStep({
    input: { ids: input.delete },
}));
/**
 * Workflow ID for batch property labels workflow.
 *
 * @since 2.13.7
 */
exports.batchPropertyLabelsWorkflowId = "batch-property-labels";
/**
 * This workflow creates, updates, or deletes property labels in batch.
 *
 * @since 2.13.7
 * @featureFlag view_configurations
 */
exports.batchPropertyLabelsWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.batchPropertyLabelsWorkflowId, (input) => {
    const res = (0, workflows_sdk_1.parallelize)(conditionallyCreatePropertyLabels(input), conditionallyUpdatePropertyLabels(input), conditionallyDeletePropertyLabels(input));
    return new workflows_sdk_1.WorkflowResponse((0, workflows_sdk_1.transform)({ res, input }, (data) => {
        return {
            created: data.res[0] ?? [],
            updated: data.res[1] ?? [],
            deleted: data.input.delete ?? [],
        };
    }));
});
//# sourceMappingURL=batch-property-labels.js.map