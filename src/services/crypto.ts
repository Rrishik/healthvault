// HealthVault — Web Crypto utilities (AES-256-GCM via PBKDF2)

import { LS_KEYS } from '../constants';

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

/**
 * Derive an AES-256-GCM key from a passphrase using PBKDF2.
 * Returns the key and the random salt used.
 */
export async function deriveKey(
  passphrase: string,
  salt?: Uint8Array,
): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  const enc = new TextEncoder();
  const usedSalt = salt ?? crypto.getRandomValues(new Uint8Array(SALT_BYTES));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(usedSalt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  return { key, salt: usedSalt };
}

/**
 * Encrypt a string with AES-256-GCM.
 * Returns a base-64 string containing salt + IV + ciphertext.
 */
export async function encrypt(
  plaintext: string,
  passphrase: string,
): Promise<string> {
  const { key, salt } = await deriveKey(passphrase);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const enc = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  );

  // Combine: salt (16) + iv (12) + ciphertext
  const combined = new Uint8Array(
    salt.byteLength + iv.byteLength + ciphertext.byteLength,
  );
  combined.set(salt, 0);
  combined.set(iv, salt.byteLength);
  combined.set(new Uint8Array(ciphertext), salt.byteLength + iv.byteLength);

  return uint8ToBase64(combined);
}

/**
 * Decrypt a base-64 string produced by `encrypt()`.
 */
export async function decrypt(
  encoded: string,
  passphrase: string,
): Promise<string> {
  const combined = base64ToUint8(encoded);

  const salt = combined.slice(0, SALT_BYTES);
  const iv = combined.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ciphertext = combined.slice(SALT_BYTES + IV_BYTES);

  const { key } = await deriveKey(passphrase, salt);

  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plainBuf);
}

// ---------- Base64 helpers ----------

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ---------- Device-bound config encryption ----------
// Encrypts provider configs at rest in IndexedDB.
// Key is derived from a fixed app constant + a random per-device salt in localStorage.
// This prevents casual inspection of API keys in IndexedDB/DevTools.

const CONFIG_SALT_KEY = LS_KEYS.CONFIG_SALT;
const CONFIG_PASSPHRASE = 'healthvault-device-config-key-v1';

function getOrCreateDeviceSalt(): Uint8Array {
  const stored = localStorage.getItem(CONFIG_SALT_KEY);
  if (stored) {
    return new Uint8Array(JSON.parse(stored));
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  localStorage.setItem(CONFIG_SALT_KEY, JSON.stringify(Array.from(salt)));
  return salt;
}

/**
 * Encrypt provider config data for storage in IndexedDB.
 * Uses a device-bound key (app constant + localStorage salt).
 */
export async function encryptConfigData(
  data: Record<string, Record<string, string>>,
): Promise<string> {
  const plaintext = JSON.stringify(data);
  const salt = getOrCreateDeviceSalt();
  const { key } = await deriveKey(CONFIG_PASSPHRASE, salt);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const enc = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  );

  // Store IV + ciphertext (salt is in localStorage)
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return uint8ToBase64(combined);
}

/**
 * Decrypt provider config data from IndexedDB.
 */
export async function decryptConfigData(
  encoded: string,
): Promise<Record<string, Record<string, string>>> {
  const salt = getOrCreateDeviceSalt();
  const { key } = await deriveKey(CONFIG_PASSPHRASE, salt);
  const combined = base64ToUint8(encoded);

  const iv = combined.slice(0, IV_BYTES);
  const ciphertext = combined.slice(IV_BYTES);

  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );

  return JSON.parse(new TextDecoder().decode(plainBuf));
}
