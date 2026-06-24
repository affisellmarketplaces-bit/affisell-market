"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const calculate_order_change_1 = require("../calculate-order-change");
const set_action_reference_1 = require("../set-action-reference");
calculate_order_change_1.OrderChangeProcessing.registerActionType(utils_1.ChangeActionType.ITEM_ADJUSTMENTS_REPLACE, {
    operation({ action, currentOrder, options }) {
        let existing = currentOrder.items.find((item) => item.id === action.details.reference_id);
        if (!existing) {
            return;
        }
        existing.adjustments = action.details.adjustments ?? [];
        (0, set_action_reference_1.setActionReference)(existing, action, options);
    },
    validate({ action }) {
        const refId = action.details?.reference_id;
        if (!action.details.adjustments) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Adjustments of item ${refId} must exist.`);
        }
    },
});
//# sourceMappingURL=item-adjustments-replace.js.map