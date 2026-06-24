"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInviteRolesStep = exports.getInviteRolesStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.getInviteRolesStepId = "get-invite-roles-step";
/**
 * This step retrieves the roles associated with an invite.
 *
 * @example
 * const data = getInviteRolesStep({
 *   invite_id: "invite_123"
 * })
 * @ignore
 * @featureFlag rbac
 */
exports.getInviteRolesStep = (0, workflows_sdk_1.createStep)(exports.getInviteRolesStepId, async (input, { container }) => {
    const remoteLink = container.resolve(utils_1.ContainerRegistrationKeys.LINK);
    const linkService = remoteLink.getLinkModule(utils_1.Modules.USER, "invite_id", utils_1.Modules.RBAC, "rbac_role_id");
    if (!linkService) {
        return new workflows_sdk_1.StepResponse([]);
    }
    const inviteRoles = await linkService.list({
        invite_id: input.invite_id,
    });
    const roleIds = inviteRoles.map((link) => link.rbac_role_id);
    return new workflows_sdk_1.StepResponse(roleIds);
});
//# sourceMappingURL=get-invite-roles.js.map