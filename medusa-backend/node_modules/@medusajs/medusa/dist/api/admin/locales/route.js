"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
const translation_1 = __importDefault(require("../../../feature-flags/translation"));
/**
 * @since 2.12.3
 * @featureFlag translation
 */
const GET = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: locales, metadata } = await query.graph({
        entity: "locale",
        filters: req.filterableFields,
        fields: req.queryConfig.fields,
        pagination: req.queryConfig.pagination,
    }, {
        cache: { enable: true },
    });
    res.json({
        locales,
        count: metadata?.count ?? 0,
        offset: metadata?.skip ?? 0,
        limit: metadata?.take ?? 0,
    });
};
exports.GET = GET;
(0, utils_1.defineFileConfig)({
    isDisabled: () => !utils_1.FeatureFlag.isFeatureEnabled(translation_1.default.key),
});
//# sourceMappingURL=route.js.map