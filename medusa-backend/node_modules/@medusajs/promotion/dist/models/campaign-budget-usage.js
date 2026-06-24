"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const campaign_budget_1 = __importDefault(require("./campaign-budget"));
/**
 * @since 2.11.0
 */
const CampaignBudgetUsage = utils_1.model
    .define({
    name: "CampaignBudgetUsage",
    tableName: "promotion_campaign_budget_usage",
}, {
    id: utils_1.model.id({ prefix: "probudgus" }).primaryKey(),
    attribute_value: utils_1.model.text(), // e.g. "cus_123" | "john.smith@gmail.com"
    used: utils_1.model.bigNumber().default(0),
    budget: utils_1.model.belongsTo(() => campaign_budget_1.default, {
        mappedBy: "usages",
    }),
})
    .indexes([
    {
        on: ["attribute_value", "budget_id"],
        unique: true,
        where: "deleted_at IS NULL",
    },
]);
exports.default = CampaignBudgetUsage;
//# sourceMappingURL=campaign-budget-usage.js.map