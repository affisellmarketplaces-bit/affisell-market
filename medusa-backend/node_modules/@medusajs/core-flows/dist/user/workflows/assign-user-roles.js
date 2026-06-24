"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignUserRolesWorkflow = exports.assignUserRolesWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const create_remote_links_1 = require("../../common/steps/create-remote-links");
const validate_roles_exist_1 = require("../../invite/steps/validate-roles-exist");
const validate_user_role_permissions_1 = require("../steps/validate-user-role-permissions");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.assignUserRolesWorkflowId = "assign-user-roles";
/**
 * This workflow assigns roles to users.
 * Supports two modes:
 * - Assign multiple roles to a single user: { user_id, role_ids }
 * - Assign multiple users to a single role: { user_ids, role_id }
 * It validates that the actor has all the policies from the roles being assigned.
 * @ignore
 * @featureFlag rbac
 */
exports.assignUserRolesWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.assignUserRolesWorkflowId, (input) => {
    const roleIds = (0, workflows_sdk_1.transform)({ input }, ({ input }) => {
        return input.role_ids ?? (input.role_id ? [input.role_id] : []);
    });
    (0, validate_roles_exist_1.validateRolesExistStep)(roleIds);
    (0, validate_user_role_permissions_1.validateUserRolePermissionsStep)({
        actor_id: input.actor_id,
        actor: input.actor,
        role_ids: roleIds,
    });
    const userRoleLinks = (0, workflows_sdk_1.transform)({ input }, ({ input }) => {
        const users = input.user_ids ?? (input.user_id ? [input.user_id] : []);
        const roles = input.role_ids ?? (input.role_id ? [input.role_id] : []);
        const links = [];
        for (const userId of users) {
            for (const roleId of roles) {
                links.push({
                    user: { user_id: userId },
                    rbac: { rbac_role_id: roleId },
                });
            }
        }
        return links;
    });
    (0, create_remote_links_1.createRemoteLinkStep)(userRoleLinks);
    return new workflows_sdk_1.WorkflowResponse(void 0);
});
//# sourceMappingURL=assign-user-roles.js.map