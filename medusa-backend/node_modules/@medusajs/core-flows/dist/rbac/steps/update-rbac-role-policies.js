"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRbacRolePoliciesStep = exports.updateRbacRolePoliciesStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.updateRbacRolePoliciesStepId = "update-rbac-role-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.updateRbacRolePoliciesStep = (0, workflows_sdk_1.createStep)(exports.updateRbacRolePoliciesStepId, async (data, { container }) => {
    const service = container.resolve(utils_1.Modules.RBAC);
    const { selects, relations } = (0, utils_1.getSelectsAndRelationsFromObjectArray)([
        data.update,
    ]);
    const prevData = await service.listRbacRolePolicies(data.selector, {
        select: selects,
        relations,
    });
    const updates = (prevData ?? []).map((rp) => ({
        id: rp.id,
        ...data.update,
    }));
    const updated = await service.updateRbacRolePolicies(updates);
    return new workflows_sdk_1.StepResponse(updated, {
        prevData,
        updateKeys: Object.keys(data.update ?? {}),
    });
}, async (compensationData, { container }) => {
    if (!compensationData?.prevData?.length) {
        return;
    }
    const service = container.resolve(utils_1.Modules.RBAC);
    const updates = compensationData.prevData.map((rp) => {
        const payload = { id: rp.id };
        for (const key of compensationData.updateKeys) {
            payload[key] = rp[key];
        }
        return payload;
    });
    await service.updateRbacRolePolicies(updates);
});
//# sourceMappingURL=update-rbac-role-policies.js.map