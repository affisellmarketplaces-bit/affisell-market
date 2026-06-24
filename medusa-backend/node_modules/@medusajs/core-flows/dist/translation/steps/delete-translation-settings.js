"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTranslationSettingsStep = exports.deleteTranslationSettingsStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
exports.deleteTranslationSettingsStepId = "delete-translation-settings";
/**
 * This step deletes translation settings based on the provided IDs.
 * It compensates by restoring the deleted translation settings in case of failure.
 *
 * @since 2.13.0
 *
 * @example
 * const result = deleteTranslationSettingsStep([
 *   "ts_123",
 *   "ts_456"
 * ])
 */
exports.deleteTranslationSettingsStep = (0, workflows_sdk_1.createStep)(exports.deleteTranslationSettingsStepId, async (data, { container }) => {
    const service = container.resolve(utils_1.Modules.TRANSLATION);
    const previous = await service.listTranslationSettings({
        id: data,
    });
    await service.deleteTranslationSettings(data);
    return new workflows_sdk_1.StepResponse(void 0, previous);
}, async (previous, { container }) => {
    if (!previous?.length) {
        return;
    }
    const service = container.resolve(utils_1.Modules.TRANSLATION);
    await service.createTranslationSettings(previous);
});
//# sourceMappingURL=delete-translation-settings.js.map