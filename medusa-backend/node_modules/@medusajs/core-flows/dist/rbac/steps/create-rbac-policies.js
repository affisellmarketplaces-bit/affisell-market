"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRbacPoliciesStep = exports.createRbacPoliciesStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.createRbacPoliciesStepId = "create-rbac-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.createRbacPoliciesStep = (0, workflows_sdk_1.createStep)(exports.createRbacPoliciesStepId, async (data, { container }) => {
    const service = container.resolve(utils_1.Modules.RBAC);
    // Normalize resource and operation to lowercase
    const normalizedPolicies = data.policies.map((policy) => ({
        ...policy,
        resource: policy.resource.toLowerCase(),
        operation: policy.operation.toLowerCase(),
    }));
    const created = await service.createRbacPolicies(normalizedPolicies);
    return new workflows_sdk_1.StepResponse(created, (created ?? []).map((p) => p.id));
}, async (createdIds, { container }) => {
    if (!createdIds?.length) {
        return;
    }
    const service = container.resolve(utils_1.Modules.RBAC);
    await service.deleteRbacPolicies(createdIds);
});
//# sourceMappingURL=create-rbac-policies.js.map