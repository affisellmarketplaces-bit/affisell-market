export declare function encryptSecret(secret: string, encryptionKey: string): string;
export declare function decryptSecret(payload: string, encryptionKey: string): string;
export declare function generateRecoveryCode(): string;
export declare function hashRecoveryCode(code: string): Promise<string>;
export declare function verifyRecoveryCodeHash(hash: string, code: string): Promise<boolean>;
//# sourceMappingURL=mfa.d.ts.map