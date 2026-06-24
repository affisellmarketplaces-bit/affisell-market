"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportOrdersWorkflow = exports.exportOrdersWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const common_1 = require("../../common");
const notification_1 = require("../../notification");
const steps_1 = require("../steps");
exports.exportOrdersWorkflowId = "export-orders";
/**
 * This workflow exports orders matching the specified filters. It's used to
 * export orders to a CSV file.
 *
 * :::note
 *
 * This workflow doesn't return the exported orders. Instead, it sends a notification to the admin
 * users that they can download the exported orders.
 *
 * :::
 *
 * @example
 * To export all orders:
 *
 * ```ts
 * const { result } = await exportOrdersWorkflow(container)
 * .run({
 *   input: {
 *     select: ["*"],
 *   }
 * })
 * ```
 *
 * To export orders matching a criteria:
 *
 * ```ts
 * const { result } = await exportOrdersWorkflow(container)
 * .run({
 *   input: {
 *     select: ["*"],
 *     filter: {
 *       created_at: {
 *         $gte: "2024-01-01",
 *         $lte: "2024-12-31"
 *       }
 *     }
 *   }
 * })
 * ```
 *
 * To export orders within a date range:
 *
 * ```ts
 * const { result } = await exportOrdersWorkflow(container)
 * .run({
 *   input: {
 *     select: ["*"],
 *     filter: {
 *       created_at: {
 *         $gte: "2024-01-01T00:00:00Z",
 *         $lte: "2024-01-31T23:59:59Z"
 *       }
 *     }
 *   }
 * })
 * ```
 *
 * @summary
 *
 * Export orders with filtering capabilities.
 */
exports.exportOrdersWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.exportOrdersWorkflowId, (input) => {
    const file = (0, steps_1.exportOrdersStep)(input).config({
        async: true,
        backgroundExecution: true,
    });
    const failureNotification = (0, workflows_sdk_1.transform)({ input }, (data) => {
        return [
            {
                // We don't need the recipient here for now, but if we want to push feed notifications to a specific user we could add it.
                to: "",
                channel: "feed",
                template: "admin-ui",
                data: {
                    title: "Order export",
                    description: `Failed to export orders, please try again later.`,
                },
            },
        ];
    });
    (0, notification_1.notifyOnFailureStep)(failureNotification);
    const fileDetails = (0, common_1.useRemoteQueryStep)({
        fields: ["id", "url"],
        entry_point: "file",
        variables: { id: file.id },
        list: false,
    });
    const notifications = (0, workflows_sdk_1.transform)({ fileDetails, file }, (data) => {
        return [
            {
                // We don't need the recipient here for now, but if we want to push feed notifications to a specific user we could add it.
                to: "",
                channel: "feed",
                template: "admin-ui",
                data: {
                    title: "Order export",
                    description: "Order export completed successfully!",
                    file: {
                        filename: data.file.filename,
                        url: data.fileDetails.url,
                        mimeType: "text/csv",
                    },
                },
            },
        ];
    });
    (0, notification_1.sendNotificationsStep)(notifications);
});
//# sourceMappingURL=export-orders.js.map