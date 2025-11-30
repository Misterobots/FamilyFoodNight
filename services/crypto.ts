/**
 * Industrial-grade encryption service using Web Crypto API.
 * Uses PBKDF2 for key derivation and AES-GCM for encryption.
 */

const SALT_LEN = 16;
const IV_LEN = 12;
const ITERATIONS = 100000;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// Convert string to Uint8Array
const strToBuf = (str: string) => textEncoder.encode(str);

// Convert buffer to Base64 string for storage
const bufToBase64 = (buf: Uint8Array) => {
  let binary = '';
  const len = buf.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buf[i]);
  }
  return window.btoa(binary);
};

// Convert Base64 string to Uint8Array
const base64ToBuf = (b64: string) => {
  const binary = window.atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

// Derive a CryptoKey from the user's password (Family Code)
const getKeyMaterial = (password: string) => {
  return window.crypto.subtle.importKey(
    "raw",
    strToBuf(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
};

const getKey = (keyMaterial: CryptoKey, salt: Uint8Array) => {
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
};

export const generateFamilyCode = (): string => {
  // Generate a random 6-character alphanumeric code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, 1, O, 0 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code; // e.g., "K9X2M4"
};

export const encryptData = async (data: any, password: string): Promise<string> => {
  try {
    const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LEN));
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_LEN));
    
    const keyMaterial = await getKeyMaterial(password);
    const key = await getKey(keyMaterial, salt);
    
    const encodedData = strToBuf(JSON.stringify(data));
    
    const encryptedContent = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encodedData
    );

    // Pack salt + iv + encryptedData into a single structure
    // We'll return a JSON string of base64 components
    return JSON.stringify({
      salt: bufToBase64(salt),
      iv: bufToBase64(iv),
      data: bufToBase64(new Uint8Array(encryptedContent))
    });
  } catch (e) {
    console.error("Encryption failed", e);
    throw new Error("Failed to encrypt family data.");
  }
};

export const decryptData = async (encryptedPackage: string, password: string): Promise<any> => {
  try {
    const pkg = JSON.parse(encryptedPackage);
    const salt = base64ToBuf(pkg.salt);
    const iv = base64ToBuf(pkg.iv);
    const data = base64ToBuf(pkg.data);

    const keyMaterial = await getKeyMaterial(password);
    const key = await getKey(keyMaterial, salt);

    const decryptedContent = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      data
    );

    const decodedString = textDecoder.decode(decryptedContent);
    return JSON.parse(decodedString);
  } catch (e) {
    console.error("Decryption failed", e);
    throw new Error("Invalid Family Code or Corrupted Data");
  }
};