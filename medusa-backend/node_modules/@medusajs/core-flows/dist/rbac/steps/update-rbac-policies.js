"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRbacPoliciesStep = exports.updateRbacPoliciesStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.updateRbacPoliciesStepId = "update-rbac-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.updateRbacPoliciesStep = (0, workflows_sdk_1.createStep)(exports.updateRbacPoliciesStepId, async (data, { container }) => {
    const service = container.resolve(utils_1.Modules.RBAC);
    const { selects, relations } = (0, utils_1.getSelectsAndRelationsFromObjectArray)([
        data.update,
    ]);
    const prevData = await service.listRbacPolicies(data.selector, {
        select: selects,
        relations,
    });
    // Normalize resource and operation to lowercase if present
    const normalizedUpdate = { ...data.update };
    if (normalizedUpdate.resource) {
        normalizedUpdate.resource = normalizedUpdate.resource.toLowerCase();
    }
    if (normalizedUpdate.operation) {
        normalizedUpdate.operation = normalizedUpdate.operation.toLowerCase();
    }
    const updates = (prevData ?? []).map((p) => ({
        id: p.id,
        ...normalizedUpdate,
    }));
    const updated = await service.updateRbacPolicies(updates);
    return new workflows_sdk_1.StepResponse(updated, {
        prevData,
        updateKeys: Object.keys(data.update ?? {}),
    });
}, async (compensationData, { container }) => {
    if (!compensationData?.prevData?.length) {
        return;
    }
    const service = container.resolve(utils_1.Modules.RBAC);
    const updates = compensationData.prevData.map((p) => {
        const payload = { id: p.id };
        for (const key of compensationData.updateKeys) {
            payload[key] = p[key];
        }
        return payload;
    });
    await service.updateRbacPolicies(updates);
});
//# sourceMappingURL=update-rbac-policies.js.map