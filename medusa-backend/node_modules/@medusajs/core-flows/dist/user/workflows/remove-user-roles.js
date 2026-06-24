"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeUserRolesWorkflow = exports.removeUserRolesWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const dismiss_remote_links_1 = require("../../common/steps/dismiss-remote-links");
const validate_user_role_permissions_1 = require("../steps/validate-user-role-permissions");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.removeUserRolesWorkflowId = "remove-user-roles";
/**
 * This workflow removes roles from users.
 * Supports two modes:
 * - Remove multiple roles from a single user: { user_id, role_ids }
 * - Remove multiple users from a single role: { user_ids, role_id }
 * It validates that the actor has all the policies from the roles being removed.
 * @ignore
 * @featureFlag rbac
 */
exports.removeUserRolesWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.removeUserRolesWorkflowId, (input) => {
    const roleIds = (0, workflows_sdk_1.transform)({ input }, ({ input }) => {
        return input.role_ids ?? (input.role_id ? [input.role_id] : []);
    });
    (0, validate_user_role_permissions_1.validateUserRolePermissionsStep)({
        actor_id: input.actor_id,
        role_ids: roleIds,
        actor: input.actor,
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
    (0, dismiss_remote_links_1.dismissRemoteLinkStep)(userRoleLinks);
    return new workflows_sdk_1.WorkflowResponse(void 0);
});
//# sourceMappingURL=remove-user-roles.js.map