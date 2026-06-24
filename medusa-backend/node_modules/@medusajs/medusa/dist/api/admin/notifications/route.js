"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const http_1 = require("@medusajs/framework/http");
const GET = async (req, res) => {
    const { data: notifications, metadata } = await (0, http_1.refetchEntities)({
        entity: "notification",
        idOrFilter: req.filterableFields,
        scope: req.scope,
        fields: req.queryConfig.fields,
        pagination: req.queryConfig.pagination,
    });
    res.json({
        notifications,
        count: metadata.count,
        offset: metadata.skip,
        limit: metadata.take,
    });
};
exports.GET = GET;
//# sourceMappingURL=route.js.map