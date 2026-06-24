"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePropertyLabelsStep = exports.deletePropertyLabelsStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
/**
 * Step ID for deleting property labels step.
 *
 * @since 2.13.7
 */
exports.deletePropertyLabelsStepId = "delete-property-labels";
/**
 * Workflow step to delete property labels.
 *
 * @since 2.13.7
 * @featureFlag view_configurations
 */
exports.deletePropertyLabelsStep = (0, workflows_sdk_1.createStep)(exports.deletePropertyLabelsStepId, async (data, { container }) => {
    if (!data.ids?.length) {
        return new workflows_sdk_1.StepResponse(void 0, []);
    }
    const service = container.resolve(utils_1.Modules.SETTINGS);
    const existing = await service.listPropertyLabels({
        id: data.ids,
    });
    await service.deletePropertyLabels(data.ids);
    return new workflows_sdk_1.StepResponse(void 0, existing);
}, async (previousLabels, { container }) => {
    if (!previousLabels?.length) {
        return;
    }
    const service = container.resolve(utils_1.Modules.SETTINGS);
    await service.createPropertyLabels(previousLabels.map((label) => ({
        entity: label.entity,
        property: label.property,
        label: label.label,
        description: label.description ?? undefined,
    })));
});
//# sourceMappingURL=delete-property-labels.js.map