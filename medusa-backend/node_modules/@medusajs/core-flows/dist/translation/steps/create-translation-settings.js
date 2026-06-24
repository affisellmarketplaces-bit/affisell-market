"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTranslationSettingsStep = exports.createTranslationSettingsStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
exports.createTranslationSettingsStepId = "create-translation-settings";
/**
 * This step creates translation settings based on the provided input.
 * It supports both single and multiple translation settings creation.
 * In case of failure, it compensates by deleting the created translation settings.
 *
 * @since 2.13.0
 *
 * @example
 * const result = createTranslationSettingsStep({
 *   entity_type: "product",
 *   fields: ["title", "description", "material"],
 *   is_active: true
 * })
 */
exports.createTranslationSettingsStep = (0, workflows_sdk_1.createStep)(exports.createTranslationSettingsStepId, async (data, { container }) => {
    const service = container.resolve(utils_1.Modules.TRANSLATION);
    const normalizedInput = Array.isArray(data) ? data : [data];
    const created = await service.createTranslationSettings(normalizedInput);
    return new workflows_sdk_1.StepResponse(created, created.map((translationSettings) => translationSettings.id));
}, async (createdIds, { container }) => {
    if (!createdIds?.length) {
        return;
    }
    const service = container.resolve(utils_1.Modules.TRANSLATION);
    await service.deleteTranslationSettings(createdIds);
});
//# sourceMappingURL=create-translation-settings.js.map