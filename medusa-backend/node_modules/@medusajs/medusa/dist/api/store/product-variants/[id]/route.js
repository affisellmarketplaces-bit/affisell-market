"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
const middlewares_1 = require("../../../utils/middlewares");
const helpers_1 = require("../helpers");
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
    const { data: variants = [] } = await query.graph({
        entity: "variant",
        filters: {
            ...req.filterableFields,
            id: req.params.id,
        },
        fields: req.queryConfig.fields,
        context,
    }, {
        locale: req.locale,
    });
    const variant = variants[0];
    if (!variant) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `Product variant with id: ${req.params.id} was not found`);
    }
    if (withInventoryQuantity) {
        await (0, middlewares_1.wrapVariantsWithInventoryQuantityForSalesChannel)(req, [variant]);
    }
    await (0, helpers_1.wrapVariantsWithTaxPrices)(req, [variant]);
    res.json({ variant });
};
exports.GET = GET;
//# sourceMappingURL=route.js.map