"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPropertyLabelsWorkflow = exports.createPropertyLabelsWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const steps_1 = require("../steps");
exports.createPropertyLabelsWorkflowId = "create-property-labels";
/**
 * @since 2.13.2
 * @featureFlag view_configurations
 */
exports.createPropertyLabelsWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.createPropertyLabelsWorkflowId, (input) => {
    const propertyLabels = (0, steps_1.createPropertyLabelsStep)(input);
    return new workflows_sdk_1.WorkflowResponse(propertyLabels);
});
//# sourceMappingURL=create-property-label.js.map