// Owner IDs, safe for the browser and the server. A NEAR owner is their account
// ID (`alice.near`); other wallet families carry a prefix (`sui:0x…`).

export type OwnerChain = "near" | "sui";

/** Which wallet family an owner ID belongs to. NEAR IDs carry no prefix. */
export function ownerChain(accountId: string): OwnerChain {
  return accountId.startsWith("sui:") ? "sui" : "near";
}

/** How the owner is shown on screen: a NEAR account as is, a Sui address shortened. */
export function ownerLabel(accountId: string): string {
  if (ownerChain(accountId) === "sui") {
    const a = accountId.slice(4);
    return `Sui · ${a.slice(0, 6)}…${a.slice(-4)}`;
  }
  return accountId;
}
