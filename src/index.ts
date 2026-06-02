/**
 * @umbra/sdk — client for the Umbra Intelligence backend.
 *
 *   import { Umbra } from "@umbra/sdk";
 *   const umbra = new Umbra({ apiBase: "https://api.umbra.finance", wallet });
 *   const { answer } = await umbra.chat("Analyze competitor X");
 *
 * Prompts are encrypted in-process before they are sent; the answer is decrypted
 * locally. The wallet pays per query from its on-chain credits balance.
 */

import { PublicKey } from "@solana/web3.js";
import { seal, open, Envelope } from "./crypto";

export interface Tier {
  level: number;
  name: string;
  threshold: number;
  price: number;
  discount: number;
}

export interface Balance {
  deposited: number;
  devGranted: number;
  spent: number;
  withdrawn: number;
  available: number;
  refundable: number;
  queries: number;
  staked: number;
  tier: Tier | null;
}

export interface Attestation {
  sessionId: string;
  teeProvider: string;
  mode: string;
  promptHash: string;
  paramsHash: string;
  timestamp: string;
  solanaTx: string | null;
  status: string;
  note: string;
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

export interface ChatResult {
  answer: string;
  cost: number;
  model: string;
  balance: Balance;
  attestation: Attestation;
}

/** A wallet input: a base58 address, a web3.js PublicKey, or anything with one
 *  (e.g. a Keypair or wallet adapter). Only the public key is used today. */
export type WalletInput = string | PublicKey | { publicKey: PublicKey };

export class UmbraError extends Error {
  code: string;
  status: number;
  constructor(status: number, body: any) {
    super(body?.message || body?.error || `request failed (${status})`);
    this.name = "UmbraError";
    this.code = body?.error || "error";
    this.status = status;
  }
}

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
    if (!res.ok) throw new UmbraError(res.status, body);
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

  /** This wallet's credit balance + staking tier. */
  balance(): Promise<Balance & { wallet: string }> {
    return this.getJson(`/api/balance/${this.wallet.toBase58()}`);
  }

  /** Send an encrypted prompt and get the decrypted answer. Charges per query. */
  async chat(prompt: string, opts: { model?: string } = {}): Promise<ChatResult> {
    if (!prompt?.trim()) throw new Error("prompt is empty");
    const sk = await this.serverKey();
    const sealed = await seal(sk.publicKey, this.wallet.toBytes(), prompt);

    const res = await fetch(`${this.apiBase}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        wallet: this.wallet.toBase58(),
        model: opts.model ?? "",
        envelope: sealed.envelope as Envelope,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new UmbraError(res.status, body);

    const answer = await open(sealed.key, body.encryptedResponse);
    return {
      answer,
      cost: body.cost,
      model: body.model,
      balance: body.balance,
      attestation: body.attestation,
    };
  }

  /** Withdraw unspent credits back to the wallet (backend-signed). */
  withdraw(): Promise<{ ok: boolean; tx?: string; amount?: number }> {
    return fetch(`${this.apiBase}/api/withdraw`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: this.wallet.toBase58() }),
    }).then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new UmbraError(res.status, body);
      return body;
    });
  }
}

export default Umbra;
