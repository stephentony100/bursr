// End-to-end check, on the Stellar TEST network (no real money), of the way
// Bursr sends a passkey owner's actions: Bursr's fee account is the
// transaction source and pays, and the owner signs only their own approval.
// A passkey needs a person at a device, so a throwaway Stellar key stands in
// for the owner's passkey account here: the fee-paid path (lib/stellar.ts
// prepareFeePaid / submitFeePaid) is the same for both. Fresh keys every run,
// funded by friendbot. Run: npm run stellar:fee-e2e
import { authorizeEntry, Keypair, xdr } from "@stellar/stellar-sdk";
import { Contract, Operation } from "@stellar/stellar-sdk";

process.env.STELLAR_NETWORK = "testnet";
const fee = Keypair.random();
process.env.STELLAR_FEE_SECRET = fee.secret();

const { entriesFor, fundWithFriendbot, prepareCall, prepareDeployVault, prepareFeePaid, prepareGetTestUsdc, readContract, rpcServer, sc, sendFeePaid, startAccount, stellarConfig, submit, submitFeePaid, waitForTx } = await import("../lib/stellar");
const { stellarExpertContract, stellarExpertTx } = await import("../lib/stellar-vault");

const USDC = (dollars: number) => BigInt(Math.round(dollars * 1e7));

function check(cond: boolean, what: string) {
  if (!cond) throw new Error(`FAILED: ${what}`);
  console.log(`  ✓ ${what}`);
}

async function sign(entries: string[], who: Keypair): Promise<string[]> {
  const until = (await rpcServer().getLatestLedger()).sequence + 60;
  const out: string[] = [];
  for (const e of entries) out.push((await authorizeEntry(xdr.SorobanAuthorizationEntry.fromXdr(e, "base64"), who, until, stellarConfig().passphrase)).toXdr("base64"));
  return out;
}

async function refused(p: Promise<unknown>): Promise<boolean> {
  try {
    await p;
    return false;
  } catch {
    return true;
  }
}

async function main() {
  const owner = Keypair.random();
  const agent = Keypair.random();
  const payee = Keypair.random();
  console.log("Stellar testnet: fee-paid owner actions");
  await Promise.all([fundWithFriendbot(fee.publicKey()), fundWithFriendbot(owner.publicKey()), fundWithFriendbot(payee.publicKey())]);
  await startAccount(agent.publicKey());

  // 1. The vault deploy is sent and paid by the fee account; the owner signs only the constructor.
  const deploy = await prepareDeployVault({ owner: owner.publicKey(), agent: agent.publicKey(), perPaymentCap: USDC(10), weeklyCap: USDC(50), payees: [payee.publicKey()], deployer: fee.publicKey() });
  const asks = entriesFor(deploy, owner.publicKey());
  check(asks.length === 1, "the vault's setup asks the owner (not the fee account) for one approval");
  check(await refused(submitFeePaid(deploy, owner.publicKey(), [])), "setup without the owner's approval is refused");
  const stranger = Keypair.random();
  check(await refused(submitFeePaid(deploy, owner.publicKey(), await sign(asks, stranger))), "an approval signed by someone else is refused");

  const deploy2 = await prepareDeployVault({ owner: owner.publicKey(), agent: agent.publicKey(), perPaymentCap: USDC(10), weeklyCap: USDC(50), payees: [payee.publicKey()], deployer: fee.publicKey() });
  const hash = await submitFeePaid(deploy2, owner.publicKey(), await sign(entriesFor(deploy2, owner.publicKey()), owner));
  const r = await waitForTx(hash, 40);
  check(r.state === "done", `vault set up with the owner's approval, fee paid by Bursr  ${stellarExpertTx(hash)}`);
  const vault = String((r as { returnValue: unknown }).returnValue);
  console.log(`  vault ${stellarExpertContract(vault)}`);
  const status = await readContract<{ owner: string; per_payment_cap: bigint; max_balance: bigint }>(vault, "status");
  check(status.owner === owner.publicKey(), "the vault's owner is the owner, not the fee account");
  check(status.max_balance === USDC(500), "the vault reports its $500 cap");

  // 2. A rule change: fee-paid, owner-approved.
  const upd = await prepareFeePaid(new Contract(vault).call("update", sc.i128(USDC(20)), sc.i128(USDC(50)), sc.bool(false), sc.addresses([]), sc.addresses([])));
  const updHash = await submitFeePaid(upd, owner.publicKey(), await sign(entriesFor(upd, owner.publicKey()), owner));
  check((await waitForTx(updHash, 40)).state === "done", `owner raised the per-payment limit to $20  ${stellarExpertTx(updHash)}`);
  const after = await readContract<{ per_payment_cap: bigint }>(vault, "status");
  check(after.per_payment_cap === USDC(20), "the new limit is on the vault");

  // 3. The agent's key can't change the rules, even with the fee account paying.
  const bad = await prepareFeePaid(new Contract(vault).call("update", sc.i128(USDC(50)), sc.i128(USDC(50)), sc.bool(false), sc.addresses([agent.publicKey()]), sc.addresses([])));
  check(await refused(submitFeePaid(bad, owner.publicKey(), await sign(entriesFor(bad, owner.publicKey()), agent))), "the agent's key can't approve a rule change");

  // 4. A call that arrives already signed (like the passkey account's deploy from the kit) is sent as is.
  const pre = await prepareFeePaid(new Contract(vault).call("update", sc.i128(USDC(15)), sc.i128(USDC(50)), sc.bool(false), sc.addresses([]), sc.addresses([])));
  const signedAuth = (await sign(entriesFor(pre, owner.publicKey()), owner)).map((b) => xdr.SorobanAuthorizationEntry.fromXdr(b, "base64"));
  const op = pre.operations[0] as unknown as { func: xdr.HostFunction };
  const preHash = await sendFeePaid(Operation.invokeHostFunction({ func: op.func, auth: signedAuth }));
  check((await waitForTx(preHash, 40)).state === "done", `an already-signed call is sent and paid by the fee account  ${stellarExpertTx(preHash)}`);

  // 5. Practice naira in: the fee account buys test USDC and puts it in through the capped deposit.
  const { tx: buy } = await prepareGetTestUsdc(fee.publicKey(), USDC(12));
  buy.sign(fee);
  check((await waitForTx(await submit(buy), 40)).state === "done", "the practice provider bought test USDC");
  const dep = await prepareCall(fee.publicKey(), vault, "deposit", [sc.address(fee.publicKey()), sc.i128(USDC(10))]);
  dep.sign(fee);
  const depHash = await submit(dep);
  check((await waitForTx(depHash, 40)).state === "done", `$10 added to the vault through deposit  ${stellarExpertTx(depHash)}`);

  // 6. Practice naira out: one owner-approved owner_pay to the provider's address, paid once. In practice that is
  // the fee account (it has a USDC trustline from step 5; an address without one is refused by USDC itself).
  const sink = fee.publicKey();
  await new Promise((r) => setTimeout(r, 1000));
  const key = Buffer.alloc(32, 7);
  const cash = await prepareFeePaid(new Contract(vault).call("owner_pay", sc.payouts([{ key, to: sink, amount: USDC(4) }])));
  const cashHash = await submitFeePaid(cash, owner.publicKey(), await sign(entriesFor(cash, owner.publicKey()), owner));
  check((await waitForTx(cashHash, 40)).state === "done", `owner_pay sent $4 to the cash-out address  ${stellarExpertTx(cashHash)}`);
  check((await readContract<boolean>(vault, "paid", [sc.bytes32(key)])) === true, "the cash-out's payment key is marked paid");
  check(await refused(prepareFeePaid(new Contract(vault).call("owner_pay", sc.payouts([{ key, to: sink, amount: USDC(4) }])))), "the same cash-out can't be paid twice");

  console.log("All fee-paid checks passed.");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
