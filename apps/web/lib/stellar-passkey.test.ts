import { randomBytes } from "node:crypto";
import { Address, Keypair, nativeToScVal, xdr } from "@stellar/stellar-sdk";
// Not in the package exports: read the kit's own helpers straight from its build.
import { DEFAULT_DEPLOYER_PUBLIC_KEY, deriveContractAddress } from "../../../node_modules/smart-account-kit/dist/utils.js";
import { describe, expect, it } from "vitest";
import { checkDeploy, KIT_DEPLOYER_PUBLIC_KEY, passkeyAccountAddress, StellarPasskeyError } from "./stellar-passkey";
import { STELLAR_NETWORKS } from "./stellar-network";

const WASM = STELLAR_NETWORKS.testnet.accountWasmHash;

describe("passkey account address", () => {
  it("uses the kit's shared deployer", () => {
    expect(KIT_DEPLOYER_PUBLIC_KEY).toBe(DEFAULT_DEPLOYER_PUBLIC_KEY);
  });

  it("matches smart-account-kit's deriveContractAddress on both networks", () => {
    for (const net of [STELLAR_NETWORKS.testnet, STELLAR_NETWORKS.mainnet]) {
      const id = randomBytes(32);
      expect(passkeyAccountAddress(id, net.passphrase)).toBe(deriveContractAddress(id, DEFAULT_DEPLOYER_PUBLIC_KEY, net.passphrase));
    }
  });
});

function deploy(wasmHex: string, point: Buffer): string {
  const fn = xdr.HostFunction.hostFunctionTypeCreateContractV2(
    new xdr.CreateContractArgsV2({
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({ address: Address.fromString(Keypair.random().publicKey()).toScAddress(), salt: randomBytes(32) }),
      ),
      executable: xdr.ContractExecutable.contractExecutableWasm(Buffer.from(wasmHex, "hex")),
      constructorArgs: [nativeToScVal(Buffer.concat([point, Buffer.from("cred")]))],
    }),
  );
  return fn.toXdr("base64");
}

describe("checkDeploy", () => {
  const point = Buffer.concat([Buffer.from([4]), randomBytes(64)]);

  it("accepts Bursr's account code with this passkey's key", () => {
    expect(() => checkDeploy(deploy(WASM, point), WASM, point)).not.toThrow();
  });

  it("refuses other account code", () => {
    expect(() => checkDeploy(deploy("00".repeat(32), point), WASM, point)).toThrow(StellarPasskeyError);
  });

  it("refuses an account controlled by another key", () => {
    const other = Buffer.concat([Buffer.from([4]), randomBytes(64)]);
    expect(() => checkDeploy(deploy(WASM, other), WASM, point)).toThrow(/controlled by your passkey/);
  });

  it("refuses something that isn't a deploy", () => {
    expect(() => checkDeploy("not-xdr", WASM, point)).toThrow(StellarPasskeyError);
  });
});
