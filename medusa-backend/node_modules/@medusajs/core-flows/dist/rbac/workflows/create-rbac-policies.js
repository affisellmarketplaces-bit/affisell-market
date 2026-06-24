"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRbacPoliciesWorkflow = exports.createRbacPoliciesWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const steps_1 = require("../steps");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.createRbacPoliciesWorkflowId = "create-rbac-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.createRbacPoliciesWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.createRbacPoliciesWorkflowId, (input) => {
    return new workflows_sdk_1.WorkflowResponse((0, steps_1.createRbacPoliciesStep)(input));
});
//# sourceMappingURL=create-rbac-policies.js.map