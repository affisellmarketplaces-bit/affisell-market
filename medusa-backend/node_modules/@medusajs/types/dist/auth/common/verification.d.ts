import { BaseFilterable } from "../../dal";
export type AuthVerificationDTO = {
    id?: string;
    entity_id: string;
    auth_identity_id: string;
    entity_type: string;
    code_provider: string;
    provider_metadata?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    verified_at?: Date | null;
    requested_at: Date;
};
export type RequestAuthVerificationDTO = {
    entity_id: string;
    auth_identity_id: string;
    entity_type: string;
    code_provider: string;
    metadata?: Record<string, unknown> | null;
};
export type RequestAuthVerificationResponse = AuthVerificationDTO & {
    code?: string;
    expires_at?: Date;
};
export type ConfirmAuthVerificationDTO = {
    auth_identity_id?: string;
    code: string;
    code_provider?: string;
};
export type ConfirmAuthVerificationResponse = AuthVerificationDTO;
export interface FilterableAuthVerificationProps extends BaseFilterable<FilterableAuthVerificationProps> {
    id?: string[];
    auth_identity_id?: string;
    entity_id?: string;
    entity_type?: string;
    code_provider?: string;
}
//# sourceMappingURL=verification.d.ts.map