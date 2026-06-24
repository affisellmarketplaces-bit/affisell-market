"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
const GET = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: product_categories, metadata } = await query.graph({
        entity: "product_category",
        fields: req.queryConfig.fields,
        filters: req.filterableFields,
        pagination: req.queryConfig.pagination,
    }, {
        locale: req.locale,
    });
    res.json({
        product_categories,
        count: metadata.count,
        offset: metadata.skip,
        limit: metadata.take,
    });
};
exports.GET = GET;
//# sourceMappingURL=route.js.map