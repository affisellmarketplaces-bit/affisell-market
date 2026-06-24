"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportOrdersStep = exports.exportOrdersStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const json_2_csv_1 = require("json-2-csv");
const aggregate_status_1 = require("../utils/aggregate-status");
exports.exportOrdersStepId = "export-orders";
const normalizeOrderForExport = (order) => {
    const order_ = order;
    const customer = order_.customer || {};
    const shippingAddress = order_.shipping_address || {};
    return JSON.parse(JSON.stringify({
        Order_ID: order.id,
        Display_ID: order.display_id,
        "Order status": order.status,
        Date: order.created_at,
        "Customer First name": customer.first_name || "",
        "Customer Last name": customer.last_name || "",
        "Customer Email": customer.email || "",
        "Customer ID": customer.id || "",
        "Shipping Address 1": shippingAddress.address_1 || "",
        "Shipping Address 2": shippingAddress.address_2 || "",
        "Shipping Country Code": shippingAddress.country_code || "",
        "Shipping City": shippingAddress.city || "",
        "Shipping Postal Code": shippingAddress.postal_code || "",
        "Shipping Region ID": order.region_id,
        "Fulfillment Status": order_.fulfillment_status,
        "Payment Status": order_.payment_status,
        Subtotal: order.subtotal,
        "Shipping Total": order.shipping_total,
        "Discount Total": order.discount_total,
        "Gift Card Total": order.gift_card_total,
        "Refunded Total": order_.refunded_total,
        "Tax Total": order.tax_total,
        Total: order.total,
        "Currency Code": order.currency_code,
    }));
};
exports.exportOrdersStep = (0, workflows_sdk_1.createStep)(exports.exportOrdersStepId, async (input, { container }) => {
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const fileModule = container.resolve(utils_1.Modules.FILE);
    const filename = `${Date.now()}-order-exports.csv`;
    const { writeStream, promise, fileKey } = await fileModule.getUploadStream({
        filename,
        mimeType: "text/csv",
    });
    const pageSize = !isNaN(parseInt(input?.batch_size))
        ? parseInt(input?.batch_size, 10)
        : 50;
    let page = 0;
    let hasHeader = false;
    const fields = (0, utils_1.deduplicate)([
        ...input.select,
        "id",
        "status",
        "items.*",
        "customer.*",
        "shipping_address.*",
        "payment_collections.status",
        "payment_collections.amount",
        "payment_collections.captured_amount",
        "payment_collections.refunded_amount",
        "fulfillments.packed_at",
        "fulfillments.shipped_at",
        "fulfillments.delivered_at",
        "fulfillments.canceled_at",
    ]);
    while (true) {
        const { data: orders } = await query.graph({
            entity: "order",
            filters: {
                ...input.filter,
                status: {
                    $ne: "draft",
                },
            },
            pagination: {
                skip: page * pageSize,
                take: pageSize,
            },
            fields,
        });
        if (orders.length === 0) {
            break;
        }
        for (let i = 0; i < orders.length; i++) {
            const order = orders[i];
            const order_ = order;
            order_.payment_status = (0, aggregate_status_1.getLastPaymentStatus)(order_);
            order_.fulfillment_status = (0, aggregate_status_1.getLastFulfillmentStatus)(order_);
            delete order_.version;
            delete order.payment_collections;
            delete order.fulfillments;
            orders[i] = normalizeOrderForExport(order);
        }
        const batchCsv = (0, json_2_csv_1.json2csv)(orders, {
            prependHeader: !hasHeader,
            arrayIndexesAsKeys: true,
            expandNestedObjects: true,
            expandArrayObjects: true,
            unwindArrays: false,
            preventCsvInjection: true,
            emptyFieldValue: "",
        });
        const ok = writeStream.write((hasHeader ? "\n" : "") + batchCsv);
        if (!ok) {
            await new Promise((resolve) => writeStream.once("drain", resolve));
        }
        hasHeader = true;
        if (orders.length < pageSize) {
            break;
        }
        page += 1;
    }
    writeStream.end();
    await promise;
    return new workflows_sdk_1.StepResponse({ id: fileKey, filename }, fileKey);
}, async (fileId, { container }) => {
    if (!fileId) {
        return;
    }
    const fileModule = container.resolve(utils_1.Modules.FILE);
    await fileModule.deleteFiles(fileId);
});
//# sourceMappingURL=export-orders.js.map