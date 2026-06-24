"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
const middlewares_1 = require("../../utils/middlewares");
const helpers_1 = require("./helpers");
/**
 * @since 2.11.2
 */
const GET = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const withInventoryQuantity = req.queryConfig.fields.includes("inventory_quantity");
    if (withInventoryQuantity) {
        req.queryConfig.fields = req.queryConfig.fields.filter((field) => field !== "inventory_quantity");
    }
    const context = {};
    if (req.pricingContext) {
        context["calculated_price"] = (0, utils_1.QueryContext)(req.pricingContext);
    }
    const { data: variants = [], metadata } = await query.graph({
        entity: "variant",
        fields: req.queryConfig.fields,
        filters: req.filterableFields,
        pagination: req.queryConfig.pagination,
        context,
    }, {
        cache: {
            enable: true,
        },
        locale: req.locale,
    });
    if (withInventoryQuantity) {
        await (0, middlewares_1.wrapVariantsWithInventoryQuantityForSalesChannel)(req, variants);
    }
    await (0, helpers_1.wrapVariantsWithTaxPrices)(req, variants);
    res.json({
        variants,
        count: metadata?.count ?? 0,
        offset: metadata?.skip ?? 0,
        limit: metadata?.take ?? 0,
    });
};
exports.GET = GET;
//# sourceMappingURL=route.js.map