import type { PayoutToken, Rules } from "./domain";
import { ownerChain } from "./owner-id";
import { findPayoutToken, payoutTokens } from "./tokens";

// "Home": the owner's own wallet, where "Move money back to my wallet" sends
// money. It is always worked out from the owner's sign-in ID (never from
// anything the agent says) and sits on the destination list the owner signs.
// - NEAR owner: their NEAR account, in the treasury token.
// - Sui owner: their Sui address, in USDC on Sui (the agent exchanges, then sends).

export interface OwnerHome {
  chain: string;
  address: string;
  token: PayoutToken;
}

/** Pure part: the home for an owner ID, given the USDC-on-Sui token (when known). */
export function homeFor(rules: Rules, ownerAccountId: string, suiUsdc: PayoutToken | null): OwnerHome | null {
  const chain = ownerChain(ownerAccountId);
  if (chain === "near") return { chain: rules.treasury.chain, address: ownerAccountId, token: rules.treasury };
  if (chain === "sui" && suiUsdc) return { chain: "sui", address: ownerAccountId.slice("sui:".length), token: suiUsdc };
  return null;
}

/** The owner's home, looking USDC on Sui up in the token list (never typed by hand). */
export async function ownerHome(rules: Rules, ownerAccountId: string | null | undefined): Promise<OwnerHome | null> {
  if (!ownerAccountId) return null;
  const suiUsdc = ownerChain(ownerAccountId) === "sui" ? findPayoutToken(await payoutTokens(), "USDC", "sui") : null;
  return homeFor(rules, ownerAccountId, suiUsdc);
}
