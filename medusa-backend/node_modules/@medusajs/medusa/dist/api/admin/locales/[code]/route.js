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
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: [locale], } = await query.graph({
        entity: "locale",
        filters: {
            code: req.params.code,
        },
        fields: req.queryConfig.fields,
    }, {
        cache: { enable: true },
    });
    if (!locale) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `Locale with code: ${req.params.code} was not found`);
    }
    res.status(200).json({ locale });
};
exports.GET = GET;
(0, utils_1.defineFileConfig)({
    isDisabled: () => !utils_1.FeatureFlag.isFeatureEnabled(translation_1.default.key),
});
//# sourceMappingURL=route.js.map