"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRbacRolePoliciesWorkflow = exports.createRbacRolePoliciesWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const steps_1 = require("../steps");
const validate_user_permissions_1 = require("../steps/validate-user-permissions");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.createRbacRolePoliciesWorkflowId = "create-rbac-role-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.createRbacRolePoliciesWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.createRbacRolePoliciesWorkflowId, (input) => {
    const validationData = (0, workflows_sdk_1.transform)({ input }, ({ input }) => {
        if (!input.actor_id) {
            return null;
        }
        const policyIds = new Set();
        input.policies.forEach((rp) => policyIds.add(rp.policy_id));
        return {
            actor_id: input.actor_id,
            actor: input.actor,
            policy_ids: Array.from(policyIds),
        };
    });
    (0, workflows_sdk_1.when)({ validationData }, ({ validationData }) => {
        return !!validationData?.actor_id && !!validationData?.policy_ids?.length;
    }).then(() => {
        (0, validate_user_permissions_1.validateUserPermissionsStep)(validationData);
    });
    const rolePolicies = (0, steps_1.createRbacRolePoliciesStep)({
        policies: input.policies,
    });
    return new workflows_sdk_1.WorkflowResponse(rolePolicies);
});
//# sourceMappingURL=create-rbac-role-policies.js.map