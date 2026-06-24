"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRbacRolesStep = exports.updateRbacRolesStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.updateRbacRolesStepId = "update-rbac-roles";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.updateRbacRolesStep = (0, workflows_sdk_1.createStep)(exports.updateRbacRolesStepId, async (data, { container }) => {
    const service = container.resolve(utils_1.Modules.RBAC);
    const { selects, relations } = (0, utils_1.getSelectsAndRelationsFromObjectArray)([
        data.update,
    ]);
    const prevData = await service.listRbacRoles(data.selector, {
        select: selects,
        relations,
    });
    const updates = (prevData ?? []).map((r) => ({
        id: r.id,
        ...data.update,
    }));
    const updated = await service.updateRbacRoles(updates);
    return new workflows_sdk_1.StepResponse(updated, {
        prevData,
        updateKeys: Object.keys(data.update ?? {}),
    });
}, async (compensationData, { container }) => {
    if (!compensationData?.prevData?.length) {
        return;
    }
    const service = container.resolve(utils_1.Modules.RBAC);
    const updates = compensationData.prevData.map((r) => {
        const payload = { id: r.id };
        for (const key of compensationData.updateKeys) {
            payload[key] = r[key];
        }
        return payload;
    });
    await service.updateRbacRoles(updates);
});
//# sourceMappingURL=update-rbac-roles.js.map