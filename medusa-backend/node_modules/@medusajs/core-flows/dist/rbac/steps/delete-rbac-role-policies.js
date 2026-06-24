"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRbacRolePoliciesStep = exports.deleteRbacRolePoliciesStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.deleteRbacRolePoliciesStepId = "delete-rbac-role-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.deleteRbacRolePoliciesStep = (0, workflows_sdk_1.createStep)({ name: exports.deleteRbacRolePoliciesStepId, noCompensation: true }, async (ids, { container }) => {
    const service = container.resolve(utils_1.Modules.RBAC);
    if (!ids?.length) {
        return new workflows_sdk_1.StepResponse([], []);
    }
    const deleted = await service.deleteRbacRolePolicies(ids);
    return new workflows_sdk_1.StepResponse(deleted, ids);
}, async (deletedRolePolicyIds, { container }) => {
    if (!deletedRolePolicyIds?.length) {
        return;
    }
    const service = container.resolve(utils_1.Modules.RBAC);
    await service.restoreRbacRolePolicies(deletedRolePolicyIds);
});
//# sourceMappingURL=delete-rbac-role-policies.js.map