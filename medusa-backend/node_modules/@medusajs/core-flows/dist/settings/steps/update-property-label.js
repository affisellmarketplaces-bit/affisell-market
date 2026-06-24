"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePropertyLabelsStep = exports.updatePropertyLabelsStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
/**
 * Step ID for updating property labels step.
 *
 * @since 2.13.7
 */
exports.updatePropertyLabelsStepId = "update-property-labels";
/**
 * Workflow step to update property labels.
 *
 * @since 2.13.7
 * @featureFlag view_configurations
 */
exports.updatePropertyLabelsStep = (0, workflows_sdk_1.createStep)(exports.updatePropertyLabelsStepId, async (data, { container }) => {
    if (!data.property_labels?.length) {
        return new workflows_sdk_1.StepResponse([], { previous: [] });
    }
    const service = container.resolve(utils_1.Modules.SETTINGS);
    const ids = data.property_labels.map((p) => p.id);
    const existing = await service.listPropertyLabels({ id: ids });
    const previous = existing.map((e) => ({
        id: e.id,
        label: e.label,
        description: e.description,
    }));
    const updated = await service.updatePropertyLabels(data.property_labels);
    return new workflows_sdk_1.StepResponse(updated, { previous });
}, async (compensateData, { container }) => {
    if (!compensateData?.previous?.length) {
        return;
    }
    const service = container.resolve(utils_1.Modules.SETTINGS);
    const restoreData = compensateData.previous.map((prev) => ({
        id: prev.id,
        label: prev.label,
        description: prev.description ?? undefined,
    }));
    await service.updatePropertyLabels(restoreData);
});
//# sourceMappingURL=update-property-label.js.map