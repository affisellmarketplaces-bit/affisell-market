"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRbacPoliciesWorkflow = exports.updateRbacPoliciesWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const update_rbac_policies_1 = require("../steps/update-rbac-policies");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.updateRbacPoliciesWorkflowId = "update-rbac-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.updateRbacPoliciesWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.updateRbacPoliciesWorkflowId, (input) => {
    return new workflows_sdk_1.WorkflowResponse((0, update_rbac_policies_1.updateRbacPoliciesStep)(input));
});
//# sourceMappingURL=update-rbac-policies.js.map