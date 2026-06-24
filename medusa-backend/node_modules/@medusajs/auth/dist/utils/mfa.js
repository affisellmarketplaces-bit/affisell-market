"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptSecret = encryptSecret;
exports.decryptSecret = decryptSecret;
exports.generateRecoveryCode = generateRecoveryCode;
exports.hashRecoveryCode = hashRecoveryCode;
exports.verifyRecoveryCodeHash = verifyRecoveryCodeHash;
const node_crypto_1 = __importDefault(require("node:crypto"));
const scrypt_kdf_1 = __importDefault(require("scrypt-kdf"));
const ENCRYPTION_VERSION = "v1";
const RECOVERY_CODE_HASH_CONFIG = { logN: 15, r: 8, p: 1 };
function encryptSecret(secret, encryptionKey) {
    const iv = node_crypto_1.default.randomBytes(12);
    const cipher = node_crypto_1.default.createCipheriv("aes-256-gcm", deriveKey(encryptionKey), iv);
    const encrypted = Buffer.concat([
        cipher.update(secret, "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
        ENCRYPTION_VERSION,
        iv.toString("base64url"),
        tag.toString("base64url"),
        encrypted.toString("base64url"),
    ].join(":");
}
function decryptSecret(payload, encryptionKey) {
    const [version, iv, tag, encrypted] = payload.split(":");
    if (version !== ENCRYPTION_VERSION || !iv || !tag || !encrypted) {
        throw new Error("Invalid encrypted MFA secret");
    }
    const decipher = node_crypto_1.default.createDecipheriv("aes-256-gcm", deriveKey(encryptionKey), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
        decipher.update(Buffer.from(encrypted, "base64url")),
        decipher.final(),
    ]).toString("utf8");
}
function generateRecoveryCode() {
    return node_crypto_1.default
        .randomBytes(16)
        .toString("hex")
        .match(/.{1,4}/g)
        .join("-");
}
async function hashRecoveryCode(code) {
    const hash = await scrypt_kdf_1.default.kdf(normalizeRecoveryCode(code), RECOVERY_CODE_HASH_CONFIG);
    return hash.toString("base64");
}
async function verifyRecoveryCodeHash(hash, code) {
    return await scrypt_kdf_1.default.verify(Buffer.from(hash, "base64"), normalizeRecoveryCode(code));
}
function deriveKey(encryptionKey) {
    return node_crypto_1.default.createHash("sha256").update(encryptionKey).digest();
}
function normalizeRecoveryCode(code) {
    return code.trim().toLowerCase();
}
//# sourceMappingURL=mfa.js.map