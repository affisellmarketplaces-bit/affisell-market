"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRbacRolePoliciesStep = exports.createRbacRolePoliciesStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.createRbacRolePoliciesStepId = "create-rbac-role-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.createRbacRolePoliciesStep = (0, workflows_sdk_1.createStep)(exports.createRbacRolePoliciesStepId, async (data, { container }) => {
    const service = container.resolve(utils_1.Modules.RBAC);
    if (!data.policies?.length) {
        return new workflows_sdk_1.StepResponse([], []);
    }
    const created = await service.createRbacRolePolicies(data.policies);
    return new workflows_sdk_1.StepResponse(created, (created ?? []).map((rp) => rp.id));
}, async (createdIds, { container }) => {
    if (!createdIds?.length) {
        return;
    }
    const service = container.resolve(utils_1.Modules.RBAC);
    await service.deleteRbacRolePolicies(createdIds);
});
//# sourceMappingURL=create-rbac-role-policies.js.map