"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllProductsStep = exports.getAllProductsStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
exports.getAllProductsStepId = "get-all-products";
/**
 * This step retrieves all products matching a set of filters.
 *
 * @example
 * To retrieve all products:
 *
 * ```ts
 * const data = getAllProductsStep({
 *   select: ["*"],
 * })
 * ```
 *
 * To retrieve all products matching a filter:
 *
 * ```ts
 * const data = getAllProductsStep({
 *   select: ["*"],
 *   filter: {
 *     collection_id: "collection_123"
 *   }
 * })
 */
exports.getAllProductsStep = (0, workflows_sdk_1.createStep)(exports.getAllProductsStepId, async (data, { container }) => {
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const allProducts = [];
    const pageSize = 200;
    let page = 0;
    const { sales_channel_id, ..._filters } = data.filter ?? {};
    // We intentionally fetch the products serially here to avoid putting too much load on the DB
    while (true) {
        if (!!sales_channel_id) {
            const { data: salesChannelProducts } = await query.graph({
                entity: "product_sales_channel",
                filters: {
                    sales_channel_id,
                },
                fields: ["product_id"],
                pagination: {
                    skip: page * pageSize,
                    take: pageSize,
                },
            });
            _filters.id = salesChannelProducts.map((product) => product.product_id);
        }
        const { data: products } = await query.graph({
            entity: "product",
            filters: _filters,
            fields: data.select,
            // If sales channel is specified, we already paginated
            pagination: sales_channel_id ? undefined : {
                skip: page * pageSize,
                take: pageSize,
            },
        });
        allProducts.push(...products);
        if (products.length < pageSize) {
            break;
        }
        page += 1;
    }
    return new workflows_sdk_1.StepResponse(allProducts, allProducts);
});
//# sourceMappingURL=get-all-products.js.map