"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePropertyLabelsWorkflow = exports.deletePropertyLabelsWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const steps_1 = require("../steps");
exports.deletePropertyLabelsWorkflowId = "delete-property-labels";
/**
 * @since 2.13.2
 * @featureFlag view_configurations
 */
exports.deletePropertyLabelsWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.deletePropertyLabelsWorkflowId, (input) => {
    (0, steps_1.deletePropertyLabelsStep)(input);
    return new workflows_sdk_1.WorkflowResponse(void 0);
});
//# sourceMappingURL=delete-property-labels.js.map