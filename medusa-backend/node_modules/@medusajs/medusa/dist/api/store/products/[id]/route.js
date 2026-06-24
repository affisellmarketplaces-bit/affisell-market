"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
const middlewares_1 = require("../../../utils/middlewares");
const helpers_1 = require("../helpers");
const GET = async (req, res) => {
    const withInventoryQuantity = req.queryConfig.fields.some((field) => field.includes("variants.inventory_quantity"));
    if (withInventoryQuantity) {
        req.queryConfig.fields = req.queryConfig.fields.filter((field) => !field.includes("variants.inventory_quantity"));
    }
    const filters = {
        id: req.params.id,
        ...req.filterableFields,
    };
    const context = {};
    if (req.pricingContext) {
        context["variants"] ??= {};
        context["variants"]["calculated_price"] ??= (0, utils_1.QueryContext)(req.pricingContext);
    }
    const includesCategoriesField = req.queryConfig.fields.some((field) => field.startsWith("categories"));
    if (!req.queryConfig.fields.includes("categories.is_internal")) {
        req.queryConfig.fields.push("categories.is_internal");
    }
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: products } = await query.graph({
        entity: "product",
        filters,
        context,
        fields: req.queryConfig.fields,
    }, {
        locale: req.locale,
    });
    const product = products[0];
    if (!product) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `Product with id: ${req.params.id} was not found`);
    }
    if (withInventoryQuantity) {
        await (0, middlewares_1.wrapVariantsWithInventoryQuantityForSalesChannel)(req, product.variants || []);
    }
    if (includesCategoriesField) {
        (0, helpers_1.filterOutInternalProductCategories)([product]);
    }
    await (0, helpers_1.wrapProductsWithTaxPrices)(req, [product]);
    res.json({ product });
};
exports.GET = GET;
//# sourceMappingURL=route.js.map