"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRbacRoleParentsStep = exports.createRbacRoleParentsStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.createRbacRoleParentsStepId = "create-rbac-role-parents";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.createRbacRoleParentsStep = (0, workflows_sdk_1.createStep)(exports.createRbacRoleParentsStepId, async (data, { container }) => {
    const service = container.resolve(utils_1.Modules.RBAC);
    if (!data.role_parents?.length) {
        return new workflows_sdk_1.StepResponse([], []);
    }
    const created = await service.createRbacRoleParents(data.role_parents);
    return new workflows_sdk_1.StepResponse(created, (created ?? []).map((ri) => ri.id));
}, async (createdIds, { container }) => {
    if (!createdIds?.length) {
        return;
    }
    const service = container.resolve(utils_1.Modules.RBAC);
    await service.deleteRbacRoleParents(createdIds);
});
//# sourceMappingURL=create-rbac-role-parents.js.map