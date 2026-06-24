"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInvitesWorkflow = exports.createInvitesWorkflowId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const create_remote_links_1 = require("../../common/steps/create-remote-links");
const emit_event_1 = require("../../common/steps/emit-event");
const steps_1 = require("../steps");
exports.createInvitesWorkflowId = "create-invite-step";
/**
 * This workflow creates one or more user invites. It's used by the
 * [Create Invite Admin API Route](https://docs.medusajs.com/api/admin#invites_postinvites).
 *
 * You can provide roles to be assigned to each user when the invite is accepted.
 *
 * You can use this workflow within your customizations or your own custom workflows, allowing you to
 * create invites within your custom flows.
 *
 * @example
 * const { result } = await createInvitesWorkflow(container)
 * .run({
 *   input: {
 *     invites: [
 *       {
 *         email: "example@gmail.com",
 *         roles: ["role_super_admin"]
 *       }
 *     ]
 *   }
 * })
 *
 * @summary
 *
 * Create one or more user invites with optional role assignment.
 */
exports.createInvitesWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.createInvitesWorkflowId, (input) => {
    const allRoleIds = (0, workflows_sdk_1.transform)({ input }, ({ input }) => {
        const roleIds = new Set();
        input.invites.forEach((invite) => {
            for (const roleId of invite.roles || []) {
                roleIds.add(roleId);
            }
        });
        return Array.from(roleIds);
    });
    (0, steps_1.validateRolesExistStep)(allRoleIds);
    const createdInvites = (0, steps_1.createInviteStep)(input.invites);
    const inviteRoleLinks = (0, workflows_sdk_1.transform)({ input, createdInvites }, ({ input, createdInvites }) => {
        const links = [];
        input.invites.forEach((invite, index) => {
            const inviteId = createdInvites[index].id;
            for (const roleId of invite.roles || []) {
                links.push({
                    user: { invite_id: inviteId },
                    rbac: { rbac_role_id: roleId },
                });
            }
        });
        return links;
    });
    (0, create_remote_links_1.createRemoteLinkStep)(inviteRoleLinks);
    const invitesIdEvents = (0, workflows_sdk_1.transform)({ createdInvites }, ({ createdInvites }) => {
        return createdInvites.map((v) => {
            return { id: v.id };
        });
    });
    (0, emit_event_1.emitEventStep)({
        eventName: utils_1.InviteWorkflowEvents.CREATED,
        data: invitesIdEvents,
    });
    return new workflows_sdk_1.WorkflowResponse(createdInvites);
});
//# sourceMappingURL=create-invites.js.map