"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinerConfig = void 0;
const utils_1 = require("@medusajs/framework/utils");
const _models_1 = require("./models");
exports.joinerConfig = (0, utils_1.defineJoinerConfig)(utils_1.Modules.PAYMENT, {
    linkableKeys: {
        payment_id: _models_1.Payment.name,
        payment_collection_id: _models_1.PaymentCollection.name,
        payment_provider_id: _models_1.PaymentProvider.name,
        refund_reason_id: _models_1.RefundReason.name,
        account_holder_id: _models_1.AccountHolder.name,
    },
    alias: [
        {
            name: ["payment_method", "payment_methods"],
            entity: "PaymentMethod",
            args: {
                methodSuffix: "PaymentMethods",
            },
        },
    ],
});
//# sourceMappingURL=joiner-config.js.map