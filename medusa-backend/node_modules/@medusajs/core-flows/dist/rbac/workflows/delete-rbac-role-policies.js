"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRbacRolePoliciesWorkflow = exports.deleteRbacRolePoliciesWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const steps_1 = require("../steps");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.deleteRbacRolePoliciesWorkflowId = "delete-rbac-role-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.deleteRbacRolePoliciesWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.deleteRbacRolePoliciesWorkflowId, (input) => {
    const deletedRolePolicies = (0, steps_1.deleteRbacRolePoliciesStep)(input.role_policy_ids);
    return new workflows_sdk_1.WorkflowResponse(deletedRolePolicies);
});
//# sourceMappingURL=delete-rbac-role-policies.js.map