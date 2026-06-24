"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderItemsTranslationsStep = exports.updateOrderItemsTranslationsStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const apply_translations_to_items_1 = require("../../common/utils/apply-translations-to-items");
const fields_1 = require("../utils/fields");
const BATCH_SIZE = 100;
const lineItemFields = [
    "id",
    "variant_id",
    "product_id",
    "title",
    "subtitle",
    "product_title",
    "product_description",
    "product_subtitle",
    "product_type",
    "product_collection",
    "product_handle",
    "variant_title",
];
exports.updateOrderItemsTranslationsStepId = "update-order-items-translations";
async function compensation(originalItems, { container }) {
    if (!originalItems?.length) {
        return;
    }
    const orderModule = container.resolve(utils_1.Modules.ORDER);
    for (let i = 0; i < originalItems.length; i += BATCH_SIZE) {
        const batch = originalItems.slice(i, i + BATCH_SIZE);
        await orderModule.updateOrderLineItems(batch.map((item) => ({
            selector: { id: item.id },
            data: {
                title: item.title,
                subtitle: item.subtitle,
                product_title: item.product_title,
                product_description: item.product_description,
                product_subtitle: item.product_subtitle,
                product_type: item.product_type,
                product_collection: item.product_collection,
                product_handle: item.product_handle,
                variant_title: item.variant_title,
            },
        })));
    }
}
/**
 * This step re-translates all order line items when the order's locale changes.
 * It fetches items and their variants in batches to handle large orders gracefully.
 */
exports.updateOrderItemsTranslationsStep = (0, workflows_sdk_1.createStep)(exports.updateOrderItemsTranslationsStepId, async (data, { container }) => {
    const originalItems = [];
    try {
        const isTranslationEnabled = utils_1.FeatureFlag.isFeatureEnabled("translation");
        if (!isTranslationEnabled || !data.locale) {
            return new workflows_sdk_1.StepResponse(void 0, []);
        }
        const orderModule = container.resolve(utils_1.Modules.ORDER);
        const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
        const processBatch = async (items) => {
            const variantIds = (0, utils_1.deduplicate)(items
                .map((item) => item.variant_id)
                .filter((id) => !!id));
            if (variantIds.length === 0) {
                return;
            }
            // Store original values before updating
            for (const item of items) {
                originalItems.push({
                    id: item.id,
                    title: item.title,
                    subtitle: item.subtitle,
                    product_title: item.product_title,
                    product_description: item.product_description,
                    product_subtitle: item.product_subtitle,
                    product_type: item.product_type,
                    product_collection: item.product_collection,
                    product_handle: item.product_handle,
                    variant_title: item.variant_title,
                });
            }
            const { data: variants } = await query.graph({
                entity: "variants",
                filters: { id: variantIds },
                fields: fields_1.productVariantsFields,
            }, {
                locale: data.locale,
            });
            const translatedItems = (0, apply_translations_to_items_1.applyTranslationsToItems)(items, variants);
            const itemsToUpdate = translatedItems
                .filter((item) => item.id)
                .map((item) => ({
                selector: { id: item.id },
                data: {
                    title: item.title,
                    subtitle: item.subtitle,
                    product_title: item.product_title,
                    product_description: item.product_description,
                    product_subtitle: item.product_subtitle,
                    product_type: item.product_type,
                    product_collection: item.product_collection,
                    product_handle: item.product_handle,
                    variant_title: item.variant_title,
                },
            }));
            if (itemsToUpdate.length > 0) {
                await orderModule.updateOrderLineItems(itemsToUpdate);
            }
        };
        if (data.items?.length) {
            await processBatch(data.items);
            return new workflows_sdk_1.StepResponse(void 0, originalItems);
        }
        const { data: orders } = await query.graph({
            entity: "orders",
            filters: { id: data.order_id },
            fields: lineItemFields.map((f) => `items.${f}`),
        });
        const orderData = orders[0];
        const items = orderData?.items ?? [];
        // Process items in batches
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = items.slice(i, i + BATCH_SIZE);
            await processBatch(batch);
        }
        return new workflows_sdk_1.StepResponse(void 0, originalItems);
    }
    catch (error) {
        await compensation(originalItems, { container });
        throw error;
    }
}, compensation);
//# sourceMappingURL=update-order-items-translations.js.map