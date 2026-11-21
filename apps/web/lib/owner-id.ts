// Owner IDs, safe for the browser and the server. A NEAR owner is their account
// ID (`alice.near`); other wallet families carry a prefix (`sui:0x…`, `stellar:G…`).

export type OwnerChain = "near" | "sui" | "stellar";

/** Which wallet family an owner ID belongs to. NEAR IDs carry no prefix. */
export function ownerChain(accountId: string): OwnerChain {
  if (accountId.startsWith("sui:")) return "sui";
  if (accountId.startsWith("stellar:")) return "stellar";
  return "near";
}

/** The wallet address inside a prefixed owner ID (a NEAR ID is its own address). */
export function ownerAddress(accountId: string): string {
  const chain = ownerChain(accountId);
  return chain === "near" ? accountId : accountId.slice(chain.length + 1);
}

/** How the owner is shown on screen: a NEAR account as is, other addresses shortened. */
export function ownerLabel(accountId: string): string {
  const chain = ownerChain(accountId);
  if (chain === "near") return accountId;
  const a = ownerAddress(accountId);
  return `${chain === "sui" ? "Sui" : "Stellar"} · ${a.slice(0, 6)}…${a.slice(-4)}`;
}
