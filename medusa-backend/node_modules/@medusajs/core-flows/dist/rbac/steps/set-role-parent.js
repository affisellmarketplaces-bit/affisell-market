"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRoleParentStep = exports.setRoleParentStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.setRoleParentStepId = "set-role-parent";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.setRoleParentStep = (0, workflows_sdk_1.createStep)(exports.setRoleParentStepId, async (data, { container }) => {
    const service = container.resolve(utils_1.Modules.RBAC);
    const allCompensationData = [];
    if (!data || data.length === 0) {
        return new workflows_sdk_1.StepResponse({ created: [], removedCount: 0 }, allCompensationData);
    }
    const allToRemoveIds = [];
    const allToCreate = [];
    for (const roleData of data) {
        const existingParent = await service.listRbacRoleParents({
            role_id: roleData.role_id,
        });
        const existingInheritedRoleIds = existingParent.map((ri) => ri.parent_id);
        allCompensationData.push({
            role_id: roleData.role_id,
            previous_inherited_role_ids: existingInheritedRoleIds,
        });
        const toAdd = roleData.parent_ids.filter((id) => !existingInheritedRoleIds.includes(id));
        const toRemove = existingInheritedRoleIds.filter((id) => !roleData.parent_ids.includes(id));
        if (toRemove.length > 0) {
            const toRemoveRecords = existingParent.filter((ri) => toRemove.includes(ri.parent_id));
            allToRemoveIds.push(...toRemoveRecords.map((ri) => ri.id));
        }
        if (toAdd.length > 0) {
            allToCreate.push(...toAdd.map((parent_id) => ({
                role_id: roleData.role_id,
                parent_id,
            })));
        }
    }
    if (allToRemoveIds.length > 0) {
        await service.deleteRbacRoleParents(allToRemoveIds);
    }
    let created = [];
    if (allToCreate.length > 0) {
        created = await service.createRbacRoleParents(allToCreate);
    }
    return new workflows_sdk_1.StepResponse({ created, removedCount: allToRemoveIds.length }, allCompensationData);
}, async (compensationData, { container }) => {
    if (!compensationData || compensationData.length === 0) {
        return;
    }
    const service = container.resolve(utils_1.Modules.RBAC);
    for (const roleCompensation of compensationData) {
        const currentParent = await service.listRbacRoleParents({
            role_id: roleCompensation.role_id,
        });
        if (currentParent.length > 0) {
            await service.deleteRbacRoleParents(currentParent.map((ri) => ri.id));
        }
        if (roleCompensation.previous_inherited_role_ids.length > 0) {
            await service.createRbacRoleParents(roleCompensation.previous_inherited_role_ids.map((parent_id) => ({
                role_id: roleCompensation.role_id,
                parent_id,
            })));
        }
    }
});
//# sourceMappingURL=set-role-parent.js.map