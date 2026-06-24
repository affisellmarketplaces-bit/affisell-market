"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
const translation_1 = __importDefault(require("../../../../feature-flags/translation"));
/**
 * @since 2.12.3
 * @featureFlag translation
 */
const GET = async (req, res) => {
    const translationService = req.scope.resolve(utils_1.Modules.TRANSLATION);
    const translatableFields = await translationService.getTranslatableFields(req.validatedQuery.entity_type);
    const inactiveTranslatableFields = await translationService.getInactiveTranslatableFields(req.validatedQuery.entity_type);
    const settings = await translationService.listTranslationSettings(req.filterableFields);
    const settingsMap = new Map(settings.map((setting) => [setting.entity_type, setting]));
    res.json({
        translation_settings: Object.entries(translatableFields).reduce((acc, [entityType, fields]) => {
            const setting = settingsMap.get(entityType);
            if (!setting) {
                return acc;
            }
            acc[entityType] = {
                id: setting.id,
                fields: fields,
                inactive_fields: inactiveTranslatableFields[entityType],
                is_active: setting.is_active,
            };
            return acc;
        }, {}),
    });
};
exports.GET = GET;
(0, utils_1.defineFileConfig)({
    isDisabled: () => !utils_1.FeatureFlag.isFeatureEnabled(translation_1.default.key),
});
//# sourceMappingURL=route.js.map