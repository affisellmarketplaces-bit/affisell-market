"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRbacRolesWorkflow = exports.createRbacRolesWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const steps_1 = require("../steps");
const validate_user_permissions_1 = require("../steps/validate-user-permissions");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.createRbacRolesWorkflowId = "create-rbac-roles";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.createRbacRolesWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.createRbacRolesWorkflowId, (input) => {
    const validationData = (0, workflows_sdk_1.transform)({ input }, ({ input }) => {
        const allPolicyIds = new Set();
        input.roles.forEach((role) => {
            role.policy_ids?.forEach((policyId) => allPolicyIds.add(policyId));
        });
        return {
            actor_id: input.actor_id,
            actor: input.actor,
            policy_ids: Array.from(allPolicyIds),
        };
    });
    (0, workflows_sdk_1.when)({ validationData }, ({ validationData }) => {
        return !!validationData?.actor_id && !!validationData?.policy_ids?.length;
    }).then(() => {
        (0, validate_user_permissions_1.validateUserPermissionsStep)(validationData);
    });
    const roleData = (0, workflows_sdk_1.transform)({ input }, ({ input }) => ({
        roles: input.roles.map((r) => ({
            name: r.name,
            description: r.description,
            metadata: r.metadata,
        })),
    }));
    const createdRoles = (0, steps_1.createRbacRolesStep)(roleData);
    const parentData = (0, workflows_sdk_1.transform)({ input, createdRoles }, ({ input, createdRoles }) => {
        const parents = [];
        createdRoles.forEach((role, index) => {
            const inheritedRoleIds = input.roles[index].parent_ids || [];
            inheritedRoleIds.forEach((inheritedRoleId) => {
                parents.push({
                    role_id: role.id,
                    parent_id: inheritedRoleId,
                });
            });
        });
        return { role_parents: parents };
    });
    const policiesData = (0, workflows_sdk_1.transform)({ input, createdRoles }, ({ input, createdRoles }) => {
        const allPolicies = [];
        createdRoles.forEach((role, index) => {
            const policyIds = input.roles[index].policy_ids || [];
            policyIds.forEach((policy_id) => {
                allPolicies.push({
                    role_id: role.id,
                    policy_id: policy_id,
                });
            });
        });
        return { policies: allPolicies };
    });
    (0, steps_1.createRbacRoleParentsStep)(parentData);
    (0, steps_1.createRbacRolePoliciesStep)(policiesData);
    return new workflows_sdk_1.WorkflowResponse(createdRoles);
});
//# sourceMappingURL=create-rbac-roles.js.map