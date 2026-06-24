"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRbacRolePoliciesWorkflow = exports.updateRbacRolePoliciesWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const update_rbac_role_policies_1 = require("../steps/update-rbac-role-policies");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.updateRbacRolePoliciesWorkflowId = "update-rbac-role-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.updateRbacRolePoliciesWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.updateRbacRolePoliciesWorkflowId, (input) => {
    return new workflows_sdk_1.WorkflowResponse((0, update_rbac_role_policies_1.updateRbacRolePoliciesStep)(input));
});
//# sourceMappingURL=update-rbac-role-policies.js.map