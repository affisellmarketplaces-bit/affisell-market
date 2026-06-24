import StripeBase from "../core/stripe-base";
import { PaymentIntentOptions } from "../types";
declare class OxxoProviderService extends StripeBase {
    static identifier: string;
    constructor(_: any, options: any);
    get paymentIntentOptions(): PaymentIntentOptions;
}
export default OxxoProviderService;
//# sourceMappingURL=stripe-oxxo.d.ts.map