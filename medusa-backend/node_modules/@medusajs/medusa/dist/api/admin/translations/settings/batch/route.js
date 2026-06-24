"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = void 0;
const core_flows_1 = require("@medusajs/core-flows");
const utils_1 = require("@medusajs/framework/utils");
const translation_1 = __importDefault(require("../../../../../feature-flags/translation"));
/**
 * @since 2.13.0
 * @featureFlag translation
 */
const POST = async (req, res) => {
    const { create = [], update = [], delete: deleteIds = [] } = req.validatedBody;
    const { result } = await (0, core_flows_1.batchTranslationSettingsWorkflow)(req.scope).run({
        input: {
            create,
            update,
            delete: deleteIds,
        },
    });
    return res.status(200).json({
        created: result.created,
        updated: result.updated,
        deleted: {
            ids: deleteIds,
            object: "translation_settings",
            deleted: true,
        },
    });
};
exports.POST = POST;
(0, utils_1.defineFileConfig)({
    isDisabled: () => !utils_1.FeatureFlag.isFeatureEnabled(translation_1.default.key),
});
//# sourceMappingURL=route.js.map