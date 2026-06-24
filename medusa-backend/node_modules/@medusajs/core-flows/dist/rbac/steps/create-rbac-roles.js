"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRbacRolesStep = exports.createRbacRolesStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.createRbacRolesStepId = "create-rbac-roles";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.createRbacRolesStep = (0, workflows_sdk_1.createStep)(exports.createRbacRolesStepId, async (data, { container }) => {
    const service = container.resolve(utils_1.Modules.RBAC);
    if (!data.roles?.length) {
        return new workflows_sdk_1.StepResponse([], []);
    }
    const created = await service.createRbacRoles(data.roles);
    return new workflows_sdk_1.StepResponse(created, (created ?? []).map((r) => r.id));
}, async (createdIds, { container }) => {
    if (!createdIds?.length) {
        return;
    }
    const service = container.resolve(utils_1.Modules.RBAC);
    await service.deleteRbacRoles(createdIds);
});
//# sourceMappingURL=create-rbac-roles.js.map