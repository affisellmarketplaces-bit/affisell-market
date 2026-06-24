"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRbacPoliciesStep = exports.deleteRbacPoliciesStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.deleteRbacPoliciesStepId = "delete-rbac-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.deleteRbacPoliciesStep = (0, workflows_sdk_1.createStep)({ name: exports.deleteRbacPoliciesStepId, noCompensation: true }, async (ids, { container }) => {
    const service = container.resolve(utils_1.Modules.RBAC);
    if (!ids?.length) {
        return new workflows_sdk_1.StepResponse([], []);
    }
    const deleted = await service.deleteRbacPolicies(ids);
    return new workflows_sdk_1.StepResponse(deleted, ids);
}, async (deletedPoliciesIds, { container }) => {
    if (!deletedPoliciesIds?.length) {
        return;
    }
    const service = container.resolve(utils_1.Modules.RBAC);
    // Restore the soft-deleted roles during compensation
    await service.restoreRbacPolicies(deletedPoliciesIds);
});
//# sourceMappingURL=delete-rbac-policies.js.map