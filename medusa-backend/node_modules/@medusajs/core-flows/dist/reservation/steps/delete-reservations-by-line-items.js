"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteReservationsByLineItemsStep = exports.deleteReservationsByLineItemsStepId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const utils_1 = require("@medusajs/framework/utils");
exports.deleteReservationsByLineItemsStepId = "delete-reservations-by-line-items";
/**
 * This step deletes reservations by their associated line items.
 */
exports.deleteReservationsByLineItemsStep = (0, workflows_sdk_1.createStep)(exports.deleteReservationsByLineItemsStepId, async (ids, { container }) => {
    const service = container.resolve(utils_1.Modules.INVENTORY);
    const locking = container.resolve(utils_1.Modules.LOCKING);
    const reservations = await service.listReservationItems({ line_item_id: ids }, { select: ["id", "inventory_item_id"] });
    const inventoryItemIds = reservations.map((r) => r.inventory_item_id);
    const lockingKeys = Array.from(new Set(inventoryItemIds));
    await locking.execute(lockingKeys, async () => {
        await service.deleteReservationItemsByLineItem(ids);
    });
    return new workflows_sdk_1.StepResponse(void 0, { ids, inventoryItemIds });
}, async (data, { container }) => {
    if (!data?.ids?.length) {
        return;
    }
    const service = container.resolve(utils_1.Modules.INVENTORY);
    const locking = container.resolve(utils_1.Modules.LOCKING);
    const lockingKeys = Array.from(new Set(data.inventoryItemIds));
    await locking.execute(lockingKeys, async () => {
        await service.restoreReservationItemsByLineItem(data.ids);
    });
});
//# sourceMappingURL=delete-reservations-by-line-items.js.map