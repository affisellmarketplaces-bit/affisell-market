"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePropertyLabelsWorkflow = exports.updatePropertyLabelsWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const steps_1 = require("../steps");
exports.updatePropertyLabelsWorkflowId = "update-property-labels";
/**
 * @since 2.13.2
 * @featureFlag view_configurations
 */
exports.updatePropertyLabelsWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.updatePropertyLabelsWorkflowId, (input) => {
    const propertyLabels = (0, steps_1.updatePropertyLabelsStep)(input);
    return new workflows_sdk_1.WorkflowResponse(propertyLabels);
});
//# sourceMappingURL=update-property-label.js.map