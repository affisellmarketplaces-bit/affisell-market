"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * @since 2.12.4
 * @featureFlag translation
 */
const GET = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { type, id } = req.validatedQuery;
    const { data: [translationSettings], } = await query.graph({
        entity: "translation_settings",
        fields: ["*"],
        filters: {
            entity_type: type,
        },
    }, {
        cache: { enable: true },
    });
    const translatableFields = translationSettings?.fields ?? [];
    const filters = {};
    if (id) {
        filters.id = id;
    }
    const { data: entities = [], metadata } = await query
        .graph({
        entity: type,
        fields: ["id", ...translatableFields],
        filters,
        pagination: req.queryConfig.pagination,
    }, {
        cache: { enable: true },
    })
        .catch((e) => {
        const normalizedMessage = e.message.toLowerCase();
        if (normalizedMessage.includes("service with alias") &&
            normalizedMessage.includes("was not found")) {
            return { data: [], metadata: { count: 0, skip: 0, take: 0 } };
        }
        throw e;
    });
    let aggregatedData = entities;
    if (aggregatedData.length) {
        const { data: translations } = await query.graph({
            entity: "translations",
            fields: ["*"],
            filters: {
                reference_id: aggregatedData.map((entity) => entity.id),
            },
        });
        // aggregate data - include all translations for all locales
        aggregatedData = aggregatedData.map((entity) => {
            entity.translations = translations.filter((translation) => translation.reference_id === entity.id);
            return entity;
        });
    }
    return res.json({
        data: aggregatedData,
        count: metadata?.count ?? 0,
        offset: metadata?.skip ?? 0,
        limit: metadata?.take ?? 0,
    });
};
exports.GET = GET;
//# sourceMappingURL=route.js.map