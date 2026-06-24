"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = void 0;
const core_flows_1 = require("@medusajs/core-flows");
const utils_1 = require("@medusajs/framework/utils");
const translation_1 = __importDefault(require("../../../../feature-flags/translation"));
const query_config_1 = require("../query-config");
/**
 * @since 2.12.3
 * @featureFlag translation
 */
const POST = async (req, res) => {
    const { create = [], update = [], delete: deleteIds = [] } = req.validatedBody;
    const { result } = await (0, core_flows_1.batchTranslationsWorkflow)(req.scope).run({
        input: {
            create,
            update,
            delete: deleteIds,
        },
    });
    const ids = Array.from(new Set([
        ...result.created.map((t) => t.id),
        ...result.updated.map((t) => t.id),
    ]));
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: translations } = await query.graph({
        entity: "translation",
        fields: query_config_1.defaultAdminTranslationFields,
        filters: {
            id: ids,
        },
    });
    const created = translations.filter((t) => result.created.some((r) => r.id === t.id));
    const updated = translations.filter((t) => result.updated.some((r) => r.id === t.id));
    return res.status(200).json({
        created,
        updated,
        deleted: {
            ids: deleteIds,
            object: "translation",
            deleted: true,
        },
    });
};
exports.POST = POST;
(0, utils_1.defineFileConfig)({
    isDisabled: () => !utils_1.FeatureFlag.isFeatureEnabled(translation_1.default.key),
});
//# sourceMappingURL=route.js.map