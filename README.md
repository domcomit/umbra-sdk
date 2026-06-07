<div align="center">

# 🌒 @umbra/sdk

**Private, encrypted AI chat on Solana, in three lines of TypeScript.**

[![License](https://img.shields.io/badge/license-MIT-black.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-web3.js-14f195.svg)](https://solana.com)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933.svg)](https://nodejs.org)

</div>

Your prompt is encrypted in your own process before it leaves the machine, and the
answer is decrypted locally. The wallet pays per query from its on-chain credit
balance, with discounts that follow your staking tier.

## Highlights

- 🔒 **End to end encryption.** ECDH P-256 to the service key, HKDF-SHA256, AES-256-GCM. The wire only ever carries ciphertext.
- ⚡ **Three lines to a private prompt.** No key management, no boilerplate.
- 🪙 **Wallet native.** Pay per query straight from an on-chain credit balance.
- 🏷️ **Tiered pricing.** Stake $UMBRA and every query gets cheaper, automatically.
- 🧩 **Tiny, fully typed surface.** One class, five methods, zero config beyond a URL and a wallet.

## Install

```bash
npm install @umbra/sdk @solana/web3.js
```

## Quickstart

```ts
import { Umbra } from "@umbra/sdk";

const umbra = new Umbra({ apiBase: "https://api.umbra.finance", wallet });

const { answer, cost } = await umbra.chat("Give me a competitive teardown of Acme");
console.log(answer);
console.log(`charged ${cost} USDC`);
```

`wallet` accepts any of these, and only ever reads the public key:

| Form | Example |
| --- | --- |
| base58 address | `"7Hw...Q1M"` |
| web3.js `PublicKey` | `new PublicKey("7Hw...Q1M")` |
| `Keypair` or wallet adapter | `Keypair.generate()` |

## API

```ts
const umbra = new Umbra({ apiBase, wallet });
```

| Method | Returns | What it does |
| --- | --- | --- |
| `config()` | `ServerConfig` | Cluster, mints, tiers, models, base price. |
| `balance()` | `Balance` | Available credits, spend, staked amount, current tier. |
| `serverKey()` | `{ publicKey, curve, mode }` | The ECDH key your prompts are sealed to. |
| `chat(prompt, opts?)` | `ChatResult` | Seal, send, open. Charges one query. |
| `withdraw()` | `{ ok, tx?, amount? }` | Refund unspent credits to the wallet. |

A `chat()` call resolves to:

```ts
{
  answer: string;            // decrypted locally
  cost: number;              // charged for this call
  model: string;
  balance: Balance;          // your balance after the charge
  attestation: Attestation;  // session record, with an optional on-chain tx
}
```

Every type ships with the package, so your editor autocompletes the whole surface.

## How it works

1. Fetch the service ECDH public key.
2. Generate an ephemeral P-256 key, derive a shared secret with the service key, run it through HKDF-SHA256 (salt is your wallet public key) and land on an AES-256-GCM key.
3. Seal the prompt under that key and send `{ ephemeralPubKey, nonce, ciphertext }`. Only the holder of the service private key can open it.
4. The answer comes back sealed under the same session key, and the SDK opens it locally.

It is the same scheme the Umbra web app uses, built on Node's WebCrypto, so it runs anywhere Node 18 or newer runs.

## Error handling

Failed calls throw a typed `UmbraError`:

```ts
import { Umbra, UmbraError } from "@umbra/sdk";

try {
  await umbra.chat("...");
} catch (e) {
  if (e instanceof UmbraError) {
    console.error(e.status, e.code, e.message); // e.g. 402 insufficient_balance
  }
}
```

## Good to know

- The wallet needs credits first. Deposit on-chain through the Umbra app, then spend that balance from here. The SDK spends an existing balance, it does not deposit.
- Pricing tracks your staking tier on its own. The more $UMBRA you stake, the less each query costs.
- When `attestation.solanaTx` is set, you can verify the session record on-chain.

## Local development

```bash
npm install
npm run build       # compiles to dist/ (JS + .d.ts)
UMBRA_API=http://localhost:8080 npm run example
```

## License

MIT
