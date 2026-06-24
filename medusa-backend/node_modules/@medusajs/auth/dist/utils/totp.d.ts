export type TotpOptions = {
    secret: string;
    code?: string;
    digits?: number;
    period?: number;
    window?: number;
    timestamp?: number;
};
/**
 * Creates a Base32-encoded shared secret suitable for authenticator apps.
 */
export declare function generateTotpSecret(size?: number): string;
/**
 * Generates an RFC 6238 TOTP code for the current time step.
 */
export declare function generateTotpCode({ secret, digits, period, timestamp, }: TotpOptions): string;
/**
 * Verifies a TOTP code across the configured time-step window.
 */
export declare function verifyTotpCode({ secret, code, digits, period, window, timestamp, }: TotpOptions): boolean;
/**
 * Builds the otpauth URI consumed by authenticator apps and QR codes.
 */
export declare function generateTotpUri({ issuer, accountName, secret, digits, period, }: {
    issuer: string;
    accountName: string;
    secret: string;
    digits?: number;
    period?: number;
}): string;
//# sourceMappingURL=totp.d.ts.map