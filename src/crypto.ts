/**
 * Client-side end-to-end crypto, identical to the Umbra browser/backend scheme:
 * ECDH (P-256) to the service key, HKDF-SHA256 (salt = wallet public key),
 * AES-256-GCM. The same derived key encrypts the prompt and decrypts the answer.
 * Uses Node's WebCrypto, so it runs anywhere Node 18+ runs.
 */

import { webcrypto as wc } from "crypto";

const INFO = new TextEncoder().encode("umbra-chat");

const b64 = (b: ArrayBuffer | Uint8Array) =>
  Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64");
const b64d = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

export interface Envelope {
  ephemeralPubKey: string;
  nonce: string;
  ciphertext: string;
}

export interface Sealed {
  envelope: Envelope;
  key: CryptoKey;
}

async function deriveKey(
  serverPubRawB64: string,
  ephemeralPriv: CryptoKey,
  saltBytes: Uint8Array
): Promise<CryptoKey> {
  const serverPub = await wc.subtle.importKey(
    "raw",
    b64d(serverPubRawB64),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const shared = await wc.subtle.deriveBits(
    { name: "ECDH", public: serverPub },
    ephemeralPriv,
    256
  );
  const hkdf = await wc.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  return wc.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: saltBytes as BufferSource, info: INFO },
    hkdf,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt a prompt to the service key. saltBytes = wallet publicKey.toBytes(). */
export async function seal(
  serverPubRawB64: string,
  saltBytes: Uint8Array,
  plaintext: string
): Promise<Sealed> {
  const ephem = (await wc.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  )) as CryptoKeyPair;
  const key = await deriveKey(serverPubRawB64, ephem.privateKey, saltBytes);
  const nonce = wc.getRandomValues(new Uint8Array(12));
  const ct = await wc.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    new TextEncoder().encode(plaintext)
  );
  const ephemPubRaw = await wc.subtle.exportKey("raw", ephem.publicKey);
  return {
    key,
    envelope: { ephemeralPubKey: b64(ephemPubRaw), nonce: b64(nonce), ciphertext: b64(ct) },
  };
}

/** Decrypt the answer using the key kept from seal(). */
export async function open(
  key: CryptoKey,
  resp: { nonce: string; ciphertext: string }
): Promise<string> {
  const pt = await wc.subtle.decrypt(
    { name: "AES-GCM", iv: b64d(resp.nonce) },
    key,
    b64d(resp.ciphertext)
  );
  return new TextDecoder().decode(pt);
}
