"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationEvents = void 0;
// TODO: Comment temporarely and we will re enable it in the near future #14478
// import { EventOptions } from "@medusajs/types"
const event_bus_1 = require("../event-bus");
const modules_sdk_1 = require("../modules-sdk");
const eventBaseNames = ["notification"];
exports.NotificationEvents = (0, event_bus_1.buildEventNamesFromEntityName)(eventBaseNames, modules_sdk_1.Modules.NOTIFICATION);
// TODO: Comment temporarely and we will re enable it in the near future #14478
// declare module "@medusajs/types" {
//   export interface EventBusEventsOptions {
//     // Notification events
//     [NotificationEvents.NOTIFICATION_CREATED]?: EventOptions
//     [NotificationEvents.NOTIFICATION_UPDATED]?: EventOptions
//     [NotificationEvents.NOTIFICATION_DELETED]?: EventOptions
//     [NotificationEvents.NOTIFICATION_RESTORED]?: EventOptions
//     [NotificationEvents.NOTIFICATION_ATTACHED]?: EventOptions
//     [NotificationEvents.NOTIFICATION_DETACHED]?: EventOptions
//   }
// }
//# sourceMappingURL=events.js.map