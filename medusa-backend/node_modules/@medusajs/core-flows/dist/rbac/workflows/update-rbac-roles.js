"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRbacRolesWorkflow = exports.updateRbacRolesWorkflowId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const steps_1 = require("../steps");
const update_rbac_roles_1 = require("../steps/update-rbac-roles");
const validate_user_permissions_1 = require("../steps/validate-user-permissions");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.updateRbacRolesWorkflowId = "update-rbac-roles";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.updateRbacRolesWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.updateRbacRolesWorkflowId, (input) => {
    const validationData = (0, workflows_sdk_1.transform)({ input }, ({ input }) => {
        const policyIds = input.update.policy_ids || [];
        return {
            actor_id: input.actor_id,
            policy_ids: policyIds,
            actor: input.actor,
        };
    });
    (0, workflows_sdk_1.when)({ validationData }, ({ validationData }) => {
        return !!validationData?.actor_id && !!validationData?.policy_ids?.length;
    }).then(() => {
        (0, validate_user_permissions_1.validateUserPermissionsStep)(validationData);
    });
    const roleUpdateData = (0, workflows_sdk_1.transform)({ input }, ({ input }) => ({
        selector: input.selector,
        update: {
            name: input.update.name,
            description: input.update.description,
            metadata: input.update.metadata,
        },
    }));
    const updatedRoles = (0, update_rbac_roles_1.updateRbacRolesStep)(roleUpdateData);
    const parentUpdateData = (0, workflows_sdk_1.transform)({ input, updatedRoles }, ({ input, updatedRoles }) => {
        if (!(0, utils_1.isDefined)(input.update.parent_ids)) {
            return [];
        }
        return updatedRoles.map((role) => ({
            role_id: role.id,
            parent_ids: input.update.parent_ids || [],
        }));
    });
    (0, steps_1.setRoleParentStep)(parentUpdateData);
    const policiesUpdateData = (0, workflows_sdk_1.transform)({ input, updatedRoles }, ({ input, updatedRoles }) => {
        if (!(0, utils_1.isDefined)(input.update.policy_ids)) {
            return { policies: [] };
        }
        const allPolicies = [];
        updatedRoles.forEach((role) => {
            const policyIds = input.update.policy_ids || [];
            policyIds.forEach((policyId) => {
                allPolicies.push({
                    role_id: role.id,
                    policy_id: policyId,
                });
            });
        });
        return { policies: allPolicies };
    });
    (0, steps_1.createRbacRolePoliciesStep)(policiesUpdateData);
    return new workflows_sdk_1.WorkflowResponse(updatedRoles);
});
//# sourceMappingURL=update-rbac-roles.js.map