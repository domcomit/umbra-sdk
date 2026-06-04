/**
 * Run against a local backend:  UMBRA_API=http://localhost:8080 npm run example
 * (On a dev backend with UMBRA_MOCK_BALANCE>0, any wallet gets free credits.)
 */
import { Keypair } from "@solana/web3.js";
import { Umbra } from "./src";

async function main() {
  const wallet = Keypair.generate(); // replace with your funded wallet
  const umbra = new Umbra({
    apiBase: process.env.UMBRA_API || "http://localhost:8080",
    wallet,
  });

  console.log("wallet:", wallet.publicKey.toBase58());
  console.log("balance:", await umbra.balance());

  const { answer, cost, attestation } = await umbra.chat("Say hi in exactly three words.");
  console.log("\nanswer:", answer);
  console.log("cost:", cost, "USDC   solana_tx:", attestation.solanaTx ?? "(none)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
