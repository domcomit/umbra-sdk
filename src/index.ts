/**
 * @umbra/sdk — client for the Umbra Intelligence backend.
 *
 *   import { Umbra } from "@umbra/sdk";
 *   const umbra = new Umbra({ apiBase: "https://api.umbra.finance", wallet });
 *
 * Prompts are encrypted in-process before they are sent; the answer is decrypted
 * locally. The wallet pays per query from its on-chain credits balance.
 */

import { PublicKey } from "@solana/web3.js";

export interface Tier {
  level: number;
  name: string;
  threshold: number;
  price: number;
  discount: number;
}

export interface ModelInfo {
  id: string;
  label: string;
  price: number;
}

export interface ServerConfig {
  cluster: string;
  creditsProgramId: string;
  paymentMint: string;
  paymentDecimals: number;
  stakingProgramId: string;
  umbraMint: string;
  umbraDecimals: number;
  basePrice: number;
  tiers: Tier[];
  models: ModelInfo[];
  mockBalance: number;
  mode: string;
}

/** A wallet input: a base58 address, a web3.js PublicKey, or anything with one
 *  (e.g. a Keypair or wallet adapter). Only the public key is used today. */
export type WalletInput = string | PublicKey | { publicKey: PublicKey };

function resolvePubkey(w: WalletInput): PublicKey {
  if (typeof w === "string") return new PublicKey(w);
  if (w instanceof PublicKey) return w;
  if (w && (w as any).publicKey) return (w as any).publicKey as PublicKey;
  throw new Error("wallet must be a base58 string, PublicKey, or have a .publicKey");
}

export interface UmbraOptions {
  /** Base URL of the Umbra backend, e.g. https://api.umbra.finance */
  apiBase: string;
  /** The wallet whose balance pays for queries (base58 / PublicKey / Keypair). */
  wallet: WalletInput;
}

export class Umbra {
  readonly apiBase: string;
  readonly wallet: PublicKey;

  constructor(opts: UmbraOptions) {
    if (!opts?.apiBase) throw new Error("apiBase is required");
    this.apiBase = opts.apiBase.replace(/\/+$/, "");
    this.wallet = resolvePubkey(opts.wallet);
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${this.apiBase}${path}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.message || body?.error || `request failed (${res.status})`);
    return body as T;
  }

  /** Public backend config (cluster, mints, tiers, models, base price). */
  config(): Promise<ServerConfig> {
    return this.getJson<ServerConfig>("/api/config");
  }

  /** The service ECDH public key prompts are encrypted to. */
  serverKey(): Promise<{ publicKey: string; curve: string; mode: string }> {
    return this.getJson("/api/server-key");
  }
}

export default Umbra;
