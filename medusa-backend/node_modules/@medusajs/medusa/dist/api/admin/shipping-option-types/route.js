"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
const core_flows_1 = require("@medusajs/core-flows");
const helpers_1 = require("./helpers");
/**
 * @since 2.10.0
 */
const GET = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: shippingOptionTypes, metadata } = await query.graph({
        entity: "shipping_option_type",
        fields: req.queryConfig.fields,
        filters: req.filterableFields,
        pagination: req.queryConfig.pagination,
    });
    res.json({
        shipping_option_types: shippingOptionTypes,
        count: metadata.count,
        offset: metadata.skip,
        limit: metadata.take,
    });
};
exports.GET = GET;
/**
 * @since 2.10.0
 */
const POST = async (req, res) => {
    const input = [req.validatedBody];
    const { result } = await (0, core_flows_1.createShippingOptionTypesWorkflow)(req.scope).run({
        input: { shipping_option_types: input },
    });
    const shippingOptionType = await (0, helpers_1.refetchShippingOptionType)(result[0].id, req.scope, req.queryConfig.fields);
    res.status(200).json({ shipping_option_type: shippingOptionType });
};
exports.POST = POST;
//# sourceMappingURL=route.js.map