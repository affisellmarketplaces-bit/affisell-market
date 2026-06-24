"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderWorkflow = exports.updateOrderWorkflowId = exports.updateOrderValidationStep = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const common_1 = require("../../common");
const steps_1 = require("../steps");
const order_validation_1 = require("../utils/order-validation");
const cart_1 = require("../../cart");
const update_order_tax_lines_translations_1 = require("../steps/update-order-tax-lines-translations");
/**
 * This step validates that an order can be updated with provided input. If the order is cancelled,
 * the email is invalid, or the country code is being changed in the shipping or billing addresses, the step will throw an error.
 *
 * :::note
 *
 * You can retrieve an order's details using [Query](https://docs.medusajs.com/learn/fundamentals/module-links/query),
 * or [useQueryGraphStep](https://docs.medusajs.com/resources/references/medusa-workflows/steps/useQueryGraphStep).
 *
 * :::
 *
 * @example
 * const data = updateOrderValidationStep({
 *   order: {
 *     id: "order_123",
 *     // other order details...
 *   },
 *   input: {
 *     id: "order_123",
 *     user_id: "user_123"
 *   }
 * })
 */
exports.updateOrderValidationStep = (0, workflows_sdk_1.createStep)("update-order-validation", async function ({ order, input }) {
    (0, order_validation_1.throwIfOrderIsCancelled)({ order });
    if (input.shipping_address?.country_code &&
        order.shipping_address?.country_code !==
            input.shipping_address?.country_code) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "Country code cannot be changed");
    }
    if (input.billing_address?.country_code &&
        order.billing_address?.country_code !==
            input.billing_address?.country_code) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "Country code cannot be changed");
    }
    if (input.email) {
        (0, utils_1.validateEmail)(input.email);
    }
});
exports.updateOrderWorkflowId = "update-order-workflow";
/**
 * This workflow updates an order's general details, such as its email or addresses. It's used by the
 * [Update Order Admin API Route](https://docs.medusajs.com/api/admin#orders_postordersid).
 *
 * You can use this workflow within your customizations or your own custom workflows, allowing you to update an
 * order's details in your custom flows.
 *
 * @example
 * const { result } = await updateOrderWorkflow(container)
 * .run({
 *   input: {
 *     id: "order_123",
 *     user_id: "user_123",
 *     email: "example@gmail.com",
 *   }
 * })
 *
 * @summary
 *
 * Update an order's details.
 */
exports.updateOrderWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.updateOrderWorkflowId, function (input) {
    const orderQuery = (0, common_1.useQueryGraphStep)({
        entity: "order",
        fields: [
            "id",
            "status",
            "email",
            "locale",
            "shipping_address.*",
            "billing_address.*",
            "metadata",
            "shipping_methods.id",
            "shipping_methods.name",
            "shipping_methods.shipping_option_id",
        ],
        filters: { id: input.id },
        options: { throwIfKeyNotFound: true },
    }).config({ name: "order-query" });
    const order = (0, workflows_sdk_1.transform)({ orderQuery }, ({ orderQuery }) => orderQuery.data[0]);
    (0, exports.updateOrderValidationStep)({ order, input });
    const customerData = (0, workflows_sdk_1.when)({ input, order }, ({ input, order }) => {
        return !order.email && !!input.email;
    }).then(() => {
        return (0, cart_1.findOrCreateCustomerStep)({ email: input.email });
    });
    const updateInput = (0, workflows_sdk_1.transform)({ input, order, customerData }, ({ input, order, customerData }) => {
        const update = {};
        if (input.shipping_address) {
            const address = {
                // we want to create a new address
                ...order.shipping_address,
                ...input.shipping_address,
            };
            delete address.id;
            update.shipping_address = address;
        }
        if (input.billing_address) {
            const address = {
                ...order.billing_address,
                ...input.billing_address,
            };
            delete address.id;
            update.billing_address = address;
        }
        if (!!customerData?.customer) {
            update.customer_id = customerData.customer.id;
        }
        return { ...input, ...update };
    });
    const updatedOrders = (0, steps_1.updateOrdersStep)({
        selector: { id: input.id },
        update: updateInput,
    });
    const orderChangeInput = (0, workflows_sdk_1.transform)({ input, updatedOrders, order }, ({ input, updatedOrders, order }) => {
        const updatedOrder = updatedOrders[0];
        const changes = [];
        if (input.shipping_address) {
            changes.push({
                change_type: "update_order",
                order_id: input.id,
                created_by: input.user_id,
                confirmed_by: input.user_id,
                details: {
                    type: "shipping_address",
                    old: order.shipping_address,
                    new: updatedOrder.shipping_address,
                },
            });
        }
        if (input.billing_address) {
            changes.push({
                change_type: "update_order",
                order_id: input.id,
                created_by: input.user_id,
                confirmed_by: input.user_id,
                details: {
                    type: "billing_address",
                    old: order.billing_address,
                    new: updatedOrder.billing_address,
                },
            });
        }
        if (input.email) {
            changes.push({
                change_type: "update_order",
                order_id: input.id,
                created_by: input.user_id,
                confirmed_by: input.user_id,
                details: {
                    type: "email",
                    old: order.email,
                    new: input.email,
                },
            });
        }
        if (input.metadata !== undefined) {
            changes.push({
                change_type: "update_order",
                order_id: input.id,
                created_by: input.user_id,
                confirmed_by: input.user_id,
                details: {
                    type: "metadata",
                    old: order.metadata,
                    new: input.metadata,
                },
            });
        }
        if (!!input.locale && input.locale !== order.locale) {
            changes.push({
                change_type: "update_order",
                order_id: input.id,
                created_by: input.user_id,
                confirmed_by: input.user_id,
                details: {
                    type: "locale",
                    old: order.locale,
                    new: input.locale,
                },
            });
        }
        return changes;
    });
    (0, steps_1.registerOrderChangesStep)(orderChangeInput);
    (0, workflows_sdk_1.when)("locale-changed", { input, order }, ({ input, order }) => {
        return !!input.locale && input.locale !== order.locale;
    }).then(() => {
        (0, workflows_sdk_1.parallelize)((0, steps_1.updateOrderItemsTranslationsStep)({
            order_id: input.id,
            locale: input.locale,
        }), (0, steps_1.updateOrderShippingMethodsTranslationsStep)({
            locale: input.locale,
            shippingMethods: order.shipping_methods,
        }), (0, update_order_tax_lines_translations_1.updateOrderTaxLinesTranslationsStep)({
            order_id: input.id,
            locale: input.locale,
        }));
    });
    (0, common_1.emitEventStep)({
        eventName: utils_1.OrderWorkflowEvents.UPDATED,
        data: { id: input.id },
    });
    return new workflows_sdk_1.WorkflowResponse((0, steps_1.previewOrderChangeStep)(input.id));
});
//# sourceMappingURL=update-order.js.map