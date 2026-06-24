"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLineItemActionsStep = exports.getLineItemActionsStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
exports.getLineItemActionsStepId = "get-line-item-actions-step";
/**
 * This step returns lists of cart line items to create or update based on the
 * provided input.
 *
 * @example
 * const data = getLineItemActionsStep({
 *   "id": "cart_123",
 *   "items": [{
 *     "title": "Shirt",
 *     "quantity": 1,
 *     "unit_price": 50,
 *     "cart_id": "cart_123",
 *   }]
 * })
 */
exports.getLineItemActionsStep = (0, workflows_sdk_1.createStep)(exports.getLineItemActionsStepId, async (data, { container }) => {
    if (!data.items.length) {
        return new workflows_sdk_1.StepResponse({ itemsToCreate: [], itemsToUpdate: [] }, null);
    }
    const cartModule = container.resolve(utils_1.Modules.CART);
    const variantIds = data.items.map((d) => d.variant_id);
    const existingVariantItems = await cartModule.listLineItems({
        cart_id: data.id,
        variant_id: variantIds,
    }, {
        select: [
            "id",
            "metadata",
            "variant_id",
            "quantity",
            "unit_price",
            "compare_at_unit_price",
        ],
    });
    const variantItemsMap = existingVariantItems.reduce((result, variantItem) => {
        if (!result.has(variantItem.variant_id)) {
            result.set(variantItem.variant_id, []);
        }
        result.get(variantItem.variant_id).push(variantItem);
        return result;
    }, new Map());
    const itemsToCreate = [];
    const itemsToUpdate = [];
    const metadataMatches = (existingItem, newItem) => (!(0, utils_1.isPresent)(existingItem?.metadata) && !(0, utils_1.isPresent)(newItem.metadata)) ||
        (0, utils_1.deepEqualObj)(existingItem?.metadata, newItem.metadata);
    for (const item of data.items) {
        const variantItems = variantItemsMap.get(item.variant_id);
        const existingItem = variantItems?.find((existingItem) => item.is_custom_price
            ? metadataMatches(existingItem, item) &&
                item.unit_price === existingItem.unit_price
            : metadataMatches(existingItem, item) && !existingItem.is_custom_price);
        if (existingItem) {
            const quantity = utils_1.MathBN.sum(existingItem.quantity, item.quantity ?? 1);
            // In case of multiple items with the same variant_id, metadata and custom price, we accumulate the quantity.
            existingItem.quantity = quantity;
            const existingUpdate = itemsToUpdate.find((u) => u.id === existingItem.id);
            if (existingUpdate) {
                existingUpdate.quantity = quantity;
            }
            else {
                itemsToUpdate.push({
                    id: existingItem.id,
                    quantity: quantity,
                    variant_id: item.variant_id,
                    unit_price: item.unit_price ?? existingItem.unit_price,
                    compare_at_unit_price: item.compare_at_unit_price ?? existingItem.compare_at_unit_price,
                });
            }
        }
        else {
            itemsToCreate.push(item);
        }
    }
    return new workflows_sdk_1.StepResponse({ itemsToCreate, itemsToUpdate }, null);
});
//# sourceMappingURL=get-line-item-actions.js.map