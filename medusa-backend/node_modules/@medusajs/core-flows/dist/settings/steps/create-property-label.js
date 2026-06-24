"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPropertyLabelsStep = exports.createPropertyLabelsStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
/**
 * Step ID for creating property labels step.
 *
 * @since 2.13.7
 */
exports.createPropertyLabelsStepId = "create-property-labels";
/**
 * Workflow step to create property labels.
 *
 * @since 2.13.7
 * @featureFlag view_configurations
 */
exports.createPropertyLabelsStep = (0, workflows_sdk_1.createStep)(exports.createPropertyLabelsStepId, async (data, { container }) => {
    if (!data.property_labels?.length) {
        return new workflows_sdk_1.StepResponse([], []);
    }
    const service = container.resolve(utils_1.Modules.SETTINGS);
    const created = await service.createPropertyLabels(data.property_labels);
    const createdArray = Array.isArray(created) ? created : [created];
    return new workflows_sdk_1.StepResponse(createdArray, createdArray.map((c) => c.id));
}, async (createdIds, { container }) => {
    if (!createdIds?.length) {
        return;
    }
    const service = container.resolve(utils_1.Modules.SETTINGS);
    await service.deletePropertyLabels(createdIds);
});
//# sourceMappingURL=create-property-label.js.map