"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
const GET = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: collections, metadata } = await query.graph({
        entity: "product_collection",
        filters: req.filterableFields,
        pagination: req.queryConfig.pagination,
        fields: req.queryConfig.fields,
    }, {
        locale: req.locale,
    });
    res.json({
        collections,
        count: metadata.count,
        offset: metadata.skip,
        limit: metadata.take,
    });
};
exports.GET = GET;
//# sourceMappingURL=route.js.map