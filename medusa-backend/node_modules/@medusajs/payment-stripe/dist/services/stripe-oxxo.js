"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const stripe_base_1 = __importDefault(require("../core/stripe-base"));
const types_1 = require("../types");
class OxxoProviderService extends stripe_base_1.default {
    constructor(_, options) {
        super(_, options);
    }
    get paymentIntentOptions() {
        return {
            payment_method_types: ["oxxo"],
            capture_method: "automatic",
            payment_method_options: {
                oxxo: {
                    expires_after_days: this.options.oxxoExpiresDays || 3,
                },
            },
        };
    }
}
OxxoProviderService.identifier = types_1.PaymentProviderKeys.OXXO;
exports.default = OxxoProviderService;
//# sourceMappingURL=stripe-oxxo.js.map