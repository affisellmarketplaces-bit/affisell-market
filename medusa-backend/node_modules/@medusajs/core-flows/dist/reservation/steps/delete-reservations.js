"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteReservationsStep = exports.deleteReservationsStepId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const utils_1 = require("@medusajs/framework/utils");
exports.deleteReservationsStepId = "delete-reservations";
/**
 * This step deletes one or more reservations.
 */
exports.deleteReservationsStep = (0, workflows_sdk_1.createStep)(exports.deleteReservationsStepId, async (ids, { container }) => {
    const service = container.resolve(utils_1.Modules.INVENTORY);
    const locking = container.resolve(utils_1.Modules.LOCKING);
    const reservations = await service.listReservationItems({ id: ids }, { select: ["id", "inventory_item_id"] });
    const inventoryItemIds = reservations.map((r) => r.inventory_item_id);
    const lockingKeys = Array.from(new Set(inventoryItemIds));
    await locking.execute(lockingKeys, async () => {
        await service.softDeleteReservationItems(ids);
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
        await service.restoreReservationItems(data.ids);
    });
});
//# sourceMappingURL=delete-reservations.js.map