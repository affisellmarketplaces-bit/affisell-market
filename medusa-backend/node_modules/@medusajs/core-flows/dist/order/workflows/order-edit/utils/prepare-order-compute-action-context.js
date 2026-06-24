"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareOrderComputeActionContextStep = exports.prepareOrderComputeActionContextStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const normalizeProductContext = (product) => {
    if (!product) {
        return undefined;
    }
    const data = product;
    return {
        id: product.id,
        collection_id: data.collection_id ?? undefined,
        tags: data.tags ?? undefined,
        categories: data.categories ?? undefined,
        type_id: data.type_id ?? undefined,
    };
};
const filterAdjustments = (adjustments = []) => {
    return adjustments
        .filter((adj) => adj?.id && adj?.code)
        .map((adj) => ({ id: adj.id, code: adj.code }));
};
exports.prepareOrderComputeActionContextStepId = "prepare-order-compute-action-context";
/**
 * This step prepares the compute action context for an order by enriching
 * previewed items and shipping methods with external entities.
 *
 * Order `preview` doesn't return related entities from external modules
 * and order itself could have stale entitites depending on the change action
 * so we need to prepare some data "manually" to make sure the compute action context is correct
 */
exports.prepareOrderComputeActionContextStep = (0, workflows_sdk_1.createStep)(exports.prepareOrderComputeActionContextStepId, async ({ order, previewedOrder }, { container }) => {
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const items = previewedOrder.items ?? order.items ?? [];
    const shippingMethods = previewedOrder.shipping_methods ?? order.shipping_methods ?? [];
    const productIds = [
        ...new Set(items.map((item) => item.product_id).filter((id) => !!id)),
    ];
    const shippingOptionIds = [
        ...new Set(shippingMethods
            .map((method) => method.shipping_option_id)
            .filter((id) => !!id)),
    ];
    const [productsResult, shippingOptionsResult] = await Promise.all([
        productIds.length
            ? query.graph({
                entity: "product",
                fields: [
                    "id",
                    "collection_id",
                    "tags.id",
                    "categories.id",
                    "type_id",
                ],
                filters: { id: productIds },
            })
            : { data: [] },
        shippingOptionIds.length
            ? query.graph({
                entity: "shipping_option",
                fields: ["id", "shipping_option_type_id"],
                filters: { id: shippingOptionIds },
            })
            : { data: [] },
    ]);
    const products = (productsResult.data ?? []);
    const shippingOptions = (shippingOptionsResult.data ??
        []);
    const productMap = new Map(products.map((p) => [p.id, p]));
    const shippingOptionMap = new Map(shippingOptions.map((o) => [o.id, o]));
    const computedItems = items.map((item) => {
        const product = normalizeProductContext(item.product ?? (item.product_id && productMap.get(item.product_id)));
        const adjustments = filterAdjustments(item.adjustments);
        return {
            ...item,
            adjustments: adjustments.length ? adjustments : undefined,
            product: product ?? (item.product_id ? { id: item.product_id } : undefined),
        };
    });
    const computedShippingMethods = shippingMethods.map((method) => {
        const shippingOption = method.shipping_option_id
            ? shippingOptionMap.get(method.shipping_option_id)
            : undefined;
        const adjustments = filterAdjustments(method.adjustments);
        const shippingOptionTypeId = method.shipping_option?.shipping_option_type_id ??
            shippingOption?.shipping_option_type_id;
        return {
            ...method,
            adjustments: adjustments.length ? adjustments : undefined,
            shipping_option: shippingOptionTypeId
                ? { shipping_option_type_id: shippingOptionTypeId }
                : undefined,
        };
    });
    const previewCustomer = previewedOrder.customer;
    const orderCustomer = order.customer;
    const customer = previewCustomer?.id || orderCustomer?.id || order.customer_id
        ? {
            id: previewCustomer?.id ?? orderCustomer?.id ?? order.customer_id,
            groups: (previewCustomer?.groups ?? orderCustomer?.groups)?.map((group) => ({ id: group.id })),
        }
        : undefined;
    const previewRegion = previewedOrder.region;
    const orderRegion = order.region;
    const region = previewRegion?.id || orderRegion?.id || order.region_id
        ? { id: previewRegion?.id ?? orderRegion?.id ?? order.region_id }
        : undefined;
    const shippingAddress = previewedOrder.shipping_address ??
        order.shipping_address;
    const shipping_address = shippingAddress?.country_code
        ? { country_code: shippingAddress.country_code }
        : undefined;
    return new workflows_sdk_1.StepResponse({
        currency_code: previewedOrder.currency_code ?? order.currency_code,
        customer,
        region,
        shipping_address,
        sales_channel_id: previewedOrder.sales_channel_id ?? order.sales_channel_id,
        email: previewedOrder.email ?? order.email,
        items: computedItems,
        shipping_methods: computedShippingMethods,
    });
});
//# sourceMappingURL=prepare-order-compute-action-context.js.map