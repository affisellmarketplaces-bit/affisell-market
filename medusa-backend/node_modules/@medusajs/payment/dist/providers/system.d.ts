import { AuthorizePaymentInput, AuthorizePaymentOutput, CancelPaymentInput, CancelPaymentOutput, CapturePaymentInput, CapturePaymentOutput, RetrieveAccountHolderInput, RetrieveAccountHolderOutput, CreateAccountHolderInput, CreateAccountHolderOutput, DeleteAccountHolderInput, DeleteAccountHolderOutput, DeletePaymentInput, DeletePaymentOutput, GetPaymentStatusInput, GetPaymentStatusOutput, InitiatePaymentInput, InitiatePaymentOutput, ProviderWebhookPayload, RefundPaymentInput, RefundPaymentOutput, RetrievePaymentInput, RetrievePaymentOutput, UpdatePaymentInput, UpdatePaymentOutput, WebhookActionResult } from "@medusajs/framework/types";
import { AbstractPaymentProvider } from "@medusajs/framework/utils";
export declare class SystemPaymentProvider extends AbstractPaymentProvider {
    static identifier: string;
    getStatus(_: any): Promise<string>;
    getPaymentData(_: any): Promise<Record<string, unknown>>;
    initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput>;
    getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput>;
    retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput>;
    authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput>;
    updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput>;
    deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput>;
    capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput>;
    retrieveAccountHolder(input: RetrieveAccountHolderInput): Promise<RetrieveAccountHolderOutput>;
    createAccountHolder(input: CreateAccountHolderInput): Promise<CreateAccountHolderOutput>;
    deleteAccountHolder(input: DeleteAccountHolderInput): Promise<DeleteAccountHolderOutput>;
    refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput>;
    cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput>;
    getWebhookActionAndData(data: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult>;
}
export default SystemPaymentProvider;
//# sourceMappingURL=system.d.ts.map