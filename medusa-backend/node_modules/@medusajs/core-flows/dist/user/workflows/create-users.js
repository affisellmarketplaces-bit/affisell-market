"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUsersWorkflow = exports.createUsersWorkflowId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const create_remote_links_1 = require("../../common/steps/create-remote-links");
const emit_event_1 = require("../../common/steps/emit-event");
const validate_roles_exist_1 = require("../../invite/steps/validate-roles-exist");
const steps_1 = require("../steps");
exports.createUsersWorkflowId = "create-users-workflow";
/**
 * This workflow creates one or more users. It's used by other workflows, such
 * as {@link acceptInviteWorkflow} to create a user for an invite.
 *
 * You can attach an auth identity to each user to allow the user to log in using the
 * {@link setAuthAppMetadataStep}. Learn more about auth identities in
 * [this documentation](https://docs.medusajs.com/resources/commerce-modules/auth/auth-identity-and-actor-types).
 *
 * You can provide roles to be assigned to each user during creation.
 *
 * You can use this workflow within your customizations or your own custom workflows, allowing you to
 * create users within your custom flows.
 *
 * @example
 * const { result } = await createUsersWorkflow(container)
 * .run({
 *   input: {
 *     users: [{
 *       email: "example@gmail.com",
 *       first_name: "John",
 *       last_name: "Doe",
 *       roles: ["role_super_admin"]
 *     }]
 *   }
 * })
 *
 * @summary
 *
 * Create one or more users with optional role assignment.
 */
exports.createUsersWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.createUsersWorkflowId, (input) => {
    const allRoleIds = (0, workflows_sdk_1.transform)({ input }, ({ input }) => {
        const roleIds = new Set();
        input.users.forEach((user) => {
            for (const roleId of user.roles || []) {
                roleIds.add(roleId);
            }
        });
        return Array.from(roleIds);
    });
    (0, validate_roles_exist_1.validateRolesExistStep)(allRoleIds);
    const createdUsers = (0, steps_1.createUsersStep)(input.users);
    const userRoleLinks = (0, workflows_sdk_1.transform)({ input, createdUsers }, ({ input, createdUsers }) => {
        const links = [];
        input.users.forEach((user, index) => {
            const userId = createdUsers[index].id;
            for (const roleId of user.roles || []) {
                links.push({
                    user: { user_id: userId },
                    rbac: { rbac_role_id: roleId },
                });
            }
        });
        return links;
    });
    (0, create_remote_links_1.createRemoteLinkStep)(userRoleLinks);
    const userIdEvents = (0, workflows_sdk_1.transform)({ createdUsers }, ({ createdUsers }) => {
        return createdUsers.map((v) => {
            return { id: v.id };
        });
    });
    (0, emit_event_1.emitEventStep)({
        eventName: utils_1.UserWorkflowEvents.CREATED,
        data: userIdEvents,
    });
    return new workflows_sdk_1.WorkflowResponse(createdUsers);
});
//# sourceMappingURL=create-users.js.map