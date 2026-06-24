"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dismissProductVariantsInventoryStep = exports.dismissProductVariantsInventoryStepId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const utils_1 = require("@medusajs/framework/utils");
exports.dismissProductVariantsInventoryStepId = "dismiss-product-variants-inventory";
async function dismissVariantsInventory(variantIds, query, link) {
    const dismissedVariantInventoryItems = {};
    if (!variantIds.length) {
        return dismissedVariantInventoryItems;
    }
    const { data: variantInventoryItems } = await query.graph({
        entity: "product_variant_inventory_item",
        fields: ["inventory_item_id", "variant_id"],
        filters: {
            variant_id: variantIds,
        },
    });
    const variantInventoryItemsMap = new Map();
    for (const item of variantInventoryItems) {
        variantInventoryItemsMap.set(item.variant_id, [
            ...(variantInventoryItemsMap.get(item.variant_id) ?? []),
            item.inventory_item_id,
        ]);
    }
    const dismissLinks = [];
    for (const variantId of variantIds) {
        if (!variantId) {
            continue;
        }
        dismissedVariantInventoryItems[variantId] =
            variantInventoryItemsMap.get(variantId) ?? [];
        for (const inventoryItemId of variantInventoryItemsMap.get(variantId) ??
            []) {
            dismissLinks.push({
                [utils_1.Modules.PRODUCT]: { variant_id: variantId },
                [utils_1.Modules.INVENTORY]: { inventory_item_id: inventoryItemId },
            });
        }
    }
    await link.dismiss(dismissLinks);
    return dismissedVariantInventoryItems;
}
exports.dismissProductVariantsInventoryStep = (0, workflows_sdk_1.createStep)(exports.dismissProductVariantsInventoryStepId, async (data, { container }) => {
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const link = container.resolve(utils_1.ContainerRegistrationKeys.LINK);
    const variantIds = data.variantIds || [];
    if (!variantIds.length) {
        return new workflows_sdk_1.StepResponse(void 0);
    }
    const dismissedVariantInventoryItems = await dismissVariantsInventory(variantIds, query, link);
    return new workflows_sdk_1.StepResponse(void 0, dismissedVariantInventoryItems);
}, async (dismissedVariantInventoryItems, { container }) => {
    if (!dismissedVariantInventoryItems) {
        return;
    }
    const linksToCreate = [];
    for (const [variantId, inventoryItemIds] of Object.entries(dismissedVariantInventoryItems)) {
        for (const inventoryItemId of inventoryItemIds) {
            linksToCreate.push({
                [utils_1.Modules.PRODUCT]: { variant_id: variantId },
                [utils_1.Modules.INVENTORY]: { inventory_item_id: inventoryItemId },
            });
        }
    }
    const link = container.resolve(utils_1.ContainerRegistrationKeys.LINK);
    await link.create(linksToCreate);
});
//# sourceMappingURL=dismiss-product-variants-inventory.js.map