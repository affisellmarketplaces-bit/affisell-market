"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTotpSecret = generateTotpSecret;
exports.generateTotpCode = generateTotpCode;
exports.verifyTotpCode = verifyTotpCode;
exports.generateTotpUri = generateTotpUri;
const core_1 = require("@otplib/core");
const plugin_crypto_node_1 = require("@otplib/plugin-crypto-node");
const totp_1 = require("@otplib/totp");
const uri_1 = require("@otplib/uri");
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const base32 = (0, core_1.createBase32Plugin)({
    name: "medusa-base32",
    encode: encodeBase32,
    decode: decodeBase32,
});
/**
 * Creates a Base32-encoded shared secret suitable for authenticator apps.
 */
function generateTotpSecret(size = 20) {
    return (0, core_1.generateSecret)({
        crypto: plugin_crypto_node_1.crypto,
        base32,
        length: size,
    });
}
/**
 * Generates an RFC 6238 TOTP code for the current time step.
 */
function generateTotpCode({ secret, digits = 6, period = 30, timestamp = Date.now(), }) {
    return (0, totp_1.generateSync)({
        secret,
        crypto: plugin_crypto_node_1.crypto,
        base32,
        digits,
        period,
        epoch: Math.floor(timestamp / 1000),
    });
}
/**
 * Verifies a TOTP code across the configured time-step window.
 */
function verifyTotpCode({ secret, code, digits = 6, period = 30, window = 1, timestamp = Date.now(), }) {
    if (!code || !/^\d+$/.test(code) || code.length !== digits) {
        return false;
    }
    return (0, totp_1.verifySync)({
        secret,
        crypto: plugin_crypto_node_1.crypto,
        base32,
        token: code,
        digits,
        period,
        epoch: Math.floor(timestamp / 1000),
        epochTolerance: window * period,
    }).valid;
}
/**
 * Builds the otpauth URI consumed by authenticator apps and QR codes.
 */
function generateTotpUri({ issuer, accountName, secret, digits = 6, period = 30, }) {
    return (0, uri_1.generateTOTP)({
        issuer,
        label: accountName,
        secret,
        algorithm: "sha1",
        digits,
        period,
    });
}
function encodeBase32(buffer) {
    let bits = 0;
    let value = 0;
    let output = "";
    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            const index = (value >> (bits - 5)) & 31;
            output += BASE32_ALPHABET[index];
            bits -= 5;
            value &= (1 << bits) - 1;
        }
    }
    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
}
function decodeBase32(secret) {
    const normalized = secret
        .replace(/=+$/g, "")
        .replace(/\s+/g, "")
        .toUpperCase();
    let bits = 0;
    let value = 0;
    const bytes = [];
    for (const char of normalized) {
        const index = BASE32_ALPHABET.indexOf(char);
        if (index === -1) {
            throw new Error("Invalid TOTP secret");
        }
        value = (value << 5) | index;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >> (bits - 8)) & 255);
            bits -= 8;
            value &= (1 << bits) - 1;
        }
    }
    return Uint8Array.from(bytes);
}
//# sourceMappingURL=totp.js.map