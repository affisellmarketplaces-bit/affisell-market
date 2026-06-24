"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateReservationsStep = exports.updateReservationsStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const utils_2 = require("@medusajs/framework/utils");
exports.updateReservationsStepId = "update-reservations-step";
/**
 * This step updates one or more reservations.
 *
 * @example
 * const data = updateReservationsStep([
 *   {
 *     id: "res_123",
 *     quantity: 1,
 *   }
 * ])
 */
exports.updateReservationsStep = (0, workflows_sdk_1.createStep)(exports.updateReservationsStepId, async (data, { container }) => {
    const inventoryModuleService = container.resolve(utils_2.Modules.INVENTORY);
    const locking = container.resolve(utils_2.Modules.LOCKING);
    if (!data.length) {
        return new workflows_sdk_1.StepResponse([], {
            dataBeforeUpdate: [],
            selects: [],
            relations: [],
            inventoryItemIds: [],
        });
    }
    const { selects, relations } = (0, utils_1.getSelectsAndRelationsFromObjectArray)(data);
    const selectsWithInventoryItem = Array.from(new Set([...selects, "inventory_item_id"]));
    const dataBeforeUpdate = await inventoryModuleService.listReservationItems({ id: data.map((d) => d.id) }, { relations, select: selectsWithInventoryItem });
    const inventoryItemIds = dataBeforeUpdate.map((r) => r.inventory_item_id);
    const lockingKeys = Array.from(new Set(inventoryItemIds));
    const updatedReservations = await locking.execute(lockingKeys, async () => {
        return await inventoryModuleService.updateReservationItems(data);
    });
    return new workflows_sdk_1.StepResponse(updatedReservations, {
        dataBeforeUpdate,
        selects,
        relations,
        inventoryItemIds,
    });
}, async (revertInput, { container }) => {
    if (!revertInput) {
        return;
    }
    const { dataBeforeUpdate = [], selects, relations, inventoryItemIds = [], } = revertInput;
    const inventoryModuleService = container.resolve(utils_2.Modules.INVENTORY);
    const locking = container.resolve(utils_2.Modules.LOCKING);
    const lockingKeys = Array.from(new Set(inventoryItemIds));
    await locking.execute(lockingKeys, async () => {
        await inventoryModuleService.updateReservationItems(dataBeforeUpdate.map((data) => (0, utils_1.convertItemResponseToUpdateRequest)(data, selects, relations)));
    });
});
//# sourceMappingURL=update-reservations.js.map