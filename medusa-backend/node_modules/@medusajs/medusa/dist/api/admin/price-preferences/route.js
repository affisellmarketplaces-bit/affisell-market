"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = exports.GET = void 0;
const http_1 = require("@medusajs/framework/http");
const core_flows_1 = require("@medusajs/core-flows");
const GET = async (req, res) => {
    const { data: price_preferences, metadata } = await (0, http_1.refetchEntities)({
        entity: "price_preference",
        idOrFilter: req.filterableFields,
        scope: req.scope,
        fields: req.queryConfig.fields,
        pagination: req.queryConfig.pagination,
    });
    res.json({
        price_preferences: price_preferences,
        count: metadata.count,
        offset: metadata.skip,
        limit: metadata.take,
    });
};
exports.GET = GET;
const POST = async (req, res) => {
    const workflow = (0, core_flows_1.createPricePreferencesWorkflow)(req.scope);
    const { result } = await workflow.run({
        input: [req.validatedBody],
    });
    const price_preference = await (0, http_1.refetchEntity)({
        entity: "price_preference",
        idOrFilter: result[0].id,
        scope: req.scope,
        fields: req.queryConfig.fields,
    });
    res.status(200).json({ price_preference });
};
exports.POST = POST;
//# sourceMappingURL=route.js.map