"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTranslationSettingsStep = exports.updateTranslationSettingsStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
exports.updateTranslationSettingsStepId = "update-translation-settings";
/**
 * This step updates translation settings based on the provided input.
 * It supports both single and multiple translation settings updates.
 * In case of failure, it compensates by restoring the previous translation settings.
 *
 * @since 2.13.0
 *
 * @example
 * const result = updateTranslationSettingsStep({
 *   id: "ts_123",
 *   fields: ["title", "description", "material"],
 *   is_active: false
 * })
 */
exports.updateTranslationSettingsStep = (0, workflows_sdk_1.createStep)(exports.updateTranslationSettingsStepId, async (data, { container }) => {
    const service = container.resolve(utils_1.Modules.TRANSLATION);
    const normalizedInput = Array.isArray(data) ? data : [data];
    const previous = await service.listTranslationSettings({
        id: normalizedInput.map((d) => d.id),
    });
    const updated = await service.updateTranslationSettings(normalizedInput);
    return new workflows_sdk_1.StepResponse(updated, previous);
}, async (previous, { container }) => {
    if (!previous?.length) {
        return;
    }
    const service = container.resolve(utils_1.Modules.TRANSLATION);
    await service.updateTranslationSettings(previous);
});
//# sourceMappingURL=update-translation-settings.js.map