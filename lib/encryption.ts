/**
 * AES-256-GCM token encryption — re-exports lib/crypto.ts for supplier sync.
 * Requires ENCRYPTION_KEY (64 hex chars or ≥32 char passphrase).
 */
export {
  decryptString as decrypt,
  encryptString as encrypt,
  getEncryptionKey,
  hasEncryptionKey,
  ENCRYPTION_KEY_MISSING,
  EncryptionKeyError,
} from "@/lib/crypto"
