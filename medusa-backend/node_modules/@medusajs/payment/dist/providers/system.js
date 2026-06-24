"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemPaymentProvider = void 0;
const crypto_1 = __importDefault(require("crypto"));
const utils_1 = require("@medusajs/framework/utils");
class SystemPaymentProvider extends utils_1.AbstractPaymentProvider {
    async getStatus(_) {
        return "authorized";
    }
    async getPaymentData(_) {
        return {};
    }
    async initiatePayment(input) {
        return { data: {}, id: crypto_1.default.randomUUID() };
    }
    async getPaymentStatus(input) {
        throw new Error("Method not implemented.");
    }
    async retrievePayment(input) {
        return {};
    }
    async authorizePayment(input) {
        return { data: {}, status: utils_1.PaymentSessionStatus.AUTHORIZED };
    }
    async updatePayment(input) {
        return { data: {} };
    }
    async deletePayment(input) {
        return { data: {} };
    }
    async capturePayment(input) {
        return { data: {} };
    }
    async retrieveAccountHolder(input) {
        return { id: input.id };
    }
    async createAccountHolder(input) {
        return { id: input.context.customer.id };
    }
    async deleteAccountHolder(input) {
        return { data: {} };
    }
    async refundPayment(input) {
        return { data: {} };
    }
    async cancelPayment(input) {
        return { data: {} };
    }
    async getWebhookActionAndData(data) {
        return { action: utils_1.PaymentActions.NOT_SUPPORTED };
    }
}
exports.SystemPaymentProvider = SystemPaymentProvider;
SystemPaymentProvider.identifier = "system";
exports.default = SystemPaymentProvider;
//# sourceMappingURL=system.js.map