"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const application_method_1 = __importDefault(require("./application-method"));
const campaign_1 = __importDefault(require("./campaign"));
const promotion_rule_1 = __importDefault(require("./promotion-rule"));
const Promotion = utils_1.model
    .define("Promotion", {
    id: utils_1.model.id({ prefix: "promo" }).primaryKey(),
    code: utils_1.model.text().searchable(),
    is_automatic: utils_1.model.boolean().default(false),
    is_tax_inclusive: utils_1.model.boolean().default(false),
    /**
     * @since 2.12.0
     */
    limit: utils_1.model.number().nullable(),
    /**
     * @since 2.12.0
     */
    used: utils_1.model.number().default(0),
    type: utils_1.model.enum(utils_1.PromotionUtils.PromotionType).index("IDX_promotion_type"),
    status: utils_1.model
        .enum(utils_1.PromotionUtils.PromotionStatus)
        .index("IDX_promotion_status")
        .default(utils_1.PromotionUtils.PromotionStatus.DRAFT),
    campaign: utils_1.model
        .belongsTo(() => campaign_1.default, {
        mappedBy: "promotions",
    })
        .nullable(),
    application_method: utils_1.model
        .hasOne(() => application_method_1.default, {
        mappedBy: "promotion",
    })
        .nullable(),
    rules: utils_1.model.manyToMany(() => promotion_rule_1.default, {
        pivotTable: "promotion_promotion_rule",
        mappedBy: "promotions",
    }),
    /**
     * @since 2.12.0
     */
    metadata: utils_1.model.json().nullable(),
})
    .cascades({
    delete: ["application_method"],
})
    .indexes([
    {
        name: "IDX_unique_promotion_code",
        on: ["code"],
        where: "deleted_at IS NULL",
        unique: true,
    },
    {
        name: "IDX_promotion_is_automatic",
        on: ["is_automatic"],
        unique: false,
        where: "deleted_at IS NULL",
    },
]);
exports.default = Promotion;
//# sourceMappingURL=promotion.js.map