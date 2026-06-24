"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryEvents = void 0;
// TODO: Comment temporarely and we will re enable it in the near future #14478
// import { EventOptions } from "@medusajs/types"
const event_bus_1 = require("../event-bus");
const modules_sdk_1 = require("../modules-sdk");
const eventBaseNames = [
    "inventoryItem",
    "reservationItem",
    "inventoryLevel",
];
exports.InventoryEvents = (0, event_bus_1.buildEventNamesFromEntityName)(eventBaseNames, modules_sdk_1.Modules.INVENTORY);
// TODO: Comment temporarely and we will re enable it in the near future #14478
// declare module "@medusajs/types" {
//   export interface EventBusEventsOptions {
//     // Inventory Item events
//     [InventoryEvents.INVENTORY_ITEM_CREATED]?: EventOptions
//     [InventoryEvents.INVENTORY_ITEM_UPDATED]?: EventOptions
//     [InventoryEvents.INVENTORY_ITEM_DELETED]?: EventOptions
//     [InventoryEvents.INVENTORY_ITEM_RESTORED]?: EventOptions
//     [InventoryEvents.INVENTORY_ITEM_ATTACHED]?: EventOptions
//     [InventoryEvents.INVENTORY_ITEM_DETACHED]?: EventOptions
//     // Reservation Item events
//     [InventoryEvents.RESERVATION_ITEM_CREATED]?: EventOptions
//     [InventoryEvents.RESERVATION_ITEM_UPDATED]?: EventOptions
//     [InventoryEvents.RESERVATION_ITEM_DELETED]?: EventOptions
//     [InventoryEvents.RESERVATION_ITEM_RESTORED]?: EventOptions
//     [InventoryEvents.RESERVATION_ITEM_ATTACHED]?: EventOptions
//     [InventoryEvents.RESERVATION_ITEM_DETACHED]?: EventOptions
//     // Inventory Level events
//     [InventoryEvents.INVENTORY_LEVEL_CREATED]?: EventOptions
//     [InventoryEvents.INVENTORY_LEVEL_UPDATED]?: EventOptions
//     [InventoryEvents.INVENTORY_LEVEL_DELETED]?: EventOptions
//     [InventoryEvents.INVENTORY_LEVEL_RESTORED]?: EventOptions
//     [InventoryEvents.INVENTORY_LEVEL_ATTACHED]?: EventOptions
//     [InventoryEvents.INVENTORY_LEVEL_DETACHED]?: EventOptions
//   }
// }
//# sourceMappingURL=events.js.map