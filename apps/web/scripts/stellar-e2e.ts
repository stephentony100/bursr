// End-to-end check of the Stellar edition on the Stellar TEST network (no real money).
// Fresh throwaway keys every run (made here, funded by friendbot), so it needs no
// secrets. It walks the money path the app uses: the owner creates a vault with
// limits and one payee, adds test USDC, the agent pays, and the vault refuses
// everything outside the rules. Run: npm run stellar:e2e
import { Keypair, type Transaction } from "@stellar/stellar-sdk";
import { StellarVaultAccount } from "../lib/agent-account/stellar";
import { STELLAR_USDC, STELLAR_USDC_CONTRACT, stellarExpertContract, stellarExpertTx } from "../lib/stellar-vault";
import { fundWithFriendbot, prepareCall, prepareDeployVault, prepareGetTestUsdc, sc, submit, usdcBalance, waitForTx } from "../lib/stellar";
import type { Policy } from "@near-intents-agent-api/sdk";

const USDC = (dollars: number) => BigInt(Math.round(dollars * 1e7));

async function send(tx: Transaction, signer: Keypair, what: string): Promise<unknown> {
  tx.sign(signer);
  const hash = await submit(tx);
  const r = await waitForTx(hash, 40);
  if (r.state !== "done") throw new Error(`${what}: ${r.state}`);
  console.log(`  ✓ ${what}  ${stellarExpertTx(hash)}`);
  return r.returnValue;
}

function check(cond: boolean, what: string) {
  if (!cond) throw new Error(`FAILED: ${what}`);
  console.log(`  ✓ ${what}`);
}

async function main() {
  const owner = Keypair.random();
  const agent = Keypair.random();
  const payee = Keypair.random();
  const stranger = Keypair.random();
  console.log("1. Fresh test wallets, funded with test XLM by friendbot");
  await Promise.all([owner, agent, payee, stranger].map((k) => fundWithFriendbot(k.publicKey())));
  for (const k of [payee, stranger]) await send((await prepareGetTestUsdc(k.publicKey(), USDC(1))).tx, k, "payee wallet can hold USDC");

  console.log("2. The owner gets $40 of test USDC");
  await send((await prepareGetTestUsdc(owner.publicKey(), USDC(40))).tx, owner, "owner bought test USDC with test XLM");

  console.log("3. The owner creates the vault: $10 per payment, $25 a week, one approved payee");
  const vaultId = String(
    await send(await prepareDeployVault({ owner: owner.publicKey(), agent: agent.publicKey(), perPaymentCap: USDC(10), weeklyCap: USDC(25), payees: [payee.publicKey()] }), owner, "vault created"),
  );
  console.log(`  vault ${stellarExpertContract(vaultId)}`);

  console.log("4. The owner adds $35");
  await send(await prepareCall(owner.publicKey(), STELLAR_USDC_CONTRACT, "transfer", [sc.address(owner.publicKey()), sc.address(vaultId), sc.i128(USDC(35))]), owner, "owner added $35");

  const policy = { frozen: false, destinations: { mode: "only", list: [] }, limits: { per_transaction: {} }, budget: { weekly_usd: "25" } } as unknown as Policy;
  const account = new StellarVaultAccount({ vaultId, agentSecret: agent.secret(), policy, policyRevision: 1 });
  const pay = (to: string, dollars: number, key: string) =>
    account.execute({ kind: "withdraw", asset: STELLAR_USDC.assetId, amount: USDC(dollars), chain: "stellar", recipient: to, memo: null }, key);

  console.log("5. The agent pays inside the rules");
  const before = await usdcBalance(payee.publicKey());
  const first = await pay(payee.publicKey(), 5, "e2e:1");
  check(first.status === "accepted", "agent paid the approved payee $5");
  if (first.status === "accepted") {
    const r = await waitForTx(first.correlationId, 40);
    check(r.state === "done", `payment landed  ${stellarExpertTx(first.correlationId)}`);
  }
  check((await usdcBalance(payee.publicKey())) - before === USDC(5), "payee received exactly $5");
  const again = await pay(payee.publicKey(), 5, "e2e:1");
  check(again.status === "accepted" && again.correlationId.startsWith("already-paid:"), "same payment key again: not paid twice");

  console.log("6. The vault refuses everything outside the rules");
  const stranger1 = await pay(stranger.publicKey(), 1, "e2e:2");
  check(stranger1.status === "refused" && stranger1.refusal.code === "policy_destination_denied", `not on the list → refused (${stranger1.status === "refused" ? stranger1.refusal.message : ""})`);
  const big = await pay(payee.publicKey(), 15, "e2e:3");
  check(big.status === "refused" && big.refusal.code === "policy_transaction_limit_exceeded", `over $10 per payment → refused (${big.status === "refused" ? big.refusal.message : ""})`);
  const second = await pay(payee.publicKey(), 10, "e2e:4");
  if (second.status === "accepted") await waitForTx(second.correlationId, 40);
  check(second.status === "accepted", "a second payment of $10 is fine ($15 this week)");
  const third = await pay(payee.publicKey(), 10, "e2e:5");
  if (third.status === "accepted") await waitForTx(third.correlationId, 40);
  check(third.status === "accepted", "a third payment of $10 is fine: exactly $25, the weekly limit");
  const week = await pay(payee.publicKey(), 1, "e2e:7");
  check(week.status === "refused" && week.refusal.code === "spend_budget_exceeded", `$1 more would pass $25 a week → refused (${week.status === "refused" ? week.refusal.message : ""})`);

  console.log("7. The owner pauses payments; the agent can't pay; the owner can still take money out");
  await send(await prepareCall(owner.publicKey(), vaultId, "update", [sc.i128(USDC(10)), sc.i128(USDC(25)), sc.bool(true), sc.addresses([]), sc.addresses([])]), owner, "owner paused payments");
  const paused = await pay(payee.publicKey(), 1, "e2e:6");
  check(paused.status === "refused" && paused.refusal.code === "wallet_frozen", "paused → refused");
  // Simulation only lists the signatures a call needs; the network checks them. So send it, signed by the agent alone.
  let agentRefused = false;
  try {
    const tx = await prepareCall(agent.publicKey(), vaultId, "update", [sc.i128(USDC(1000)), sc.i128(USDC(1000)), sc.bool(false), sc.addresses([agent.publicKey()]), sc.addresses([])]);
    tx.sign(agent);
    const r = await waitForTx(await submit(tx), 40);
    agentRefused = r.state !== "done";
  } catch {
    agentRefused = true;
  }
  check(agentRefused, "the agent's own attempt to lift the limits and unpause is rejected by the network");
  check((await account.status()).frozen, "still paused");
  await send(await prepareCall(owner.publicKey(), vaultId, "withdraw", [sc.address(owner.publicKey()), sc.i128(USDC(5))]), owner, "owner took $5 back while paused");
  const s = await account.status();
  check(s.frozen && s.balances[STELLAR_USDC.assetId] === USDC(5), "vault: paused, $5 left ($35 − $5 − $10 − $10 − $5)");

  console.log("\nAll checks passed on Stellar testnet.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
