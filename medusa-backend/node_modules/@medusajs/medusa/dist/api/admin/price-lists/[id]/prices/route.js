"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * @since 2.12.3
 */
const GET = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const result = await query.graph({
        entity: "price",
        fields: req.queryConfig.fields,
        filters: {
            ...req.filterableFields,
            price_list_id: req.params.id,
        },
        pagination: req.queryConfig.pagination,
    });
    res.status(200).json({
        prices: result.data,
        count: result.metadata?.count ?? 0,
        offset: result.metadata?.skip ?? 0,
        limit: result.metadata?.take ?? 0,
    });
};
exports.GET = GET;
//# sourceMappingURL=route.js.map