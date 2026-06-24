"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRbacRolesStep = exports.deleteRbacRolesStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.deleteRbacRolesStepId = "delete-rbac-roles";
/**
 * This step deletes one or more RBAC roles.
 * @param ids - The IDs of the roles to delete
 * @param container - The workflow container
 * @returns A step response with the deleted role IDs
 * @ignore
 * @featureFlag rbac
 */
exports.deleteRbacRolesStep = (0, workflows_sdk_1.createStep)(exports.deleteRbacRolesStepId, async (ids, { container }) => {
    const service = container.resolve(utils_1.Modules.RBAC);
    if (!ids?.length) {
        return new workflows_sdk_1.StepResponse([], []);
    }
    const deleted = await service.deleteRbacRoles(ids);
    return new workflows_sdk_1.StepResponse(deleted, ids);
}, async (deletedRoleIds, { container }) => {
    if (!deletedRoleIds?.length) {
        return;
    }
    const service = container.resolve(utils_1.Modules.RBAC);
    // Restore the soft-deleted roles during compensation
    await service.restoreRbacRoles(deletedRoleIds);
});
//# sourceMappingURL=delete-rbac-roles.js.map