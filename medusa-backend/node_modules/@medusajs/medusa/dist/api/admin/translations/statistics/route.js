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
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    // The Zod schema normalizes both string and string[] to string[] via transform,
    // so the runtime values are always arrays despite the HTTP type allowing string | string[].
    const locales = req.validatedQuery.locales;
    const entity_types = req.validatedQuery.entity_types;
    // Fetch counts for each entity type in parallel
    const entityCounts = await (0, utils_1.promiseAll)(entity_types.map(async (entityType) => {
        const { metadata } = await query
            .graph({
            entity: entityType,
            fields: ["id"],
            pagination: { take: 1, skip: 0 },
        }, {
            throwIfKeyNotFound: false,
            cache: { enable: true },
        })
            .catch((e) => {
            const normalizedMessage = e.message.toLowerCase();
            if (normalizedMessage.includes("service with alias") &&
                normalizedMessage.includes("was not found")) {
                return { metadata: { count: 0 } };
            }
            throw e;
        });
        return { entityType, count: metadata?.count ?? 0 };
    }));
    const entities = {};
    for (const { entityType, count } of entityCounts) {
        entities[entityType] = { count };
    }
    const statistics = await translationService.getStatistics({
        locales,
        entities,
    });
    return res.json({
        statistics,
    });
};
exports.GET = GET;
(0, utils_1.defineFileConfig)({
    isDisabled: () => !utils_1.FeatureFlag.isFeatureEnabled(translation_1.default.key),
});
//# sourceMappingURL=route.js.map