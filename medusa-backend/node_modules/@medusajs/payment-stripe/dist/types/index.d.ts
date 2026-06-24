export interface StripeOptions {
    /**
     * The API key for the Stripe account
     */
    apiKey: string;
    /**
     * The webhook secret used to verify webhooks
     */
    webhookSecret: string;
    /**
     * Use this flag to capture payment immediately (default is false)
     */
    capture?: boolean;
    /**
     * set `automatic_payment_methods` on the intent request to `{ enabled: true }`
     */
    automaticPaymentMethods?: boolean;
    /**
     * Set a default description on the intent if the context does not provide one
     */
    paymentDescription?: string;
    /**
     * Set the number of days before an OXXO payment expires
     */
    oxxoExpiresDays?: number;
}
export interface PaymentIntentOptions {
    capture_method?: "automatic" | "manual";
    setup_future_usage?: "on_session" | "off_session";
    payment_method_types?: string[];
    payment_method_options?: {
        oxxo?: {
            expires_after_days?: number;
        };
    };
}
export declare const ErrorCodes: {
    PAYMENT_INTENT_UNEXPECTED_STATE: string;
    CHARGE_ALREADY_REFUNDED: string;
};
export declare const ErrorIntentStatus: {
    SUCCEEDED: string;
    CANCELED: string;
};
export declare const PaymentProviderKeys: {
    STRIPE: string;
    OXXO: string;
    BAN_CONTACT: string;
    BLIK: string;
    GIROPAY: string;
    IDEAL: string;
    PRZELEWY_24: string;
    PROMPT_PAY: string;
};
//# sourceMappingURL=index.d.ts.map