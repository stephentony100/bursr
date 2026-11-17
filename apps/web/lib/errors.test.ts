import { describe, expect, it } from "vitest";
import { friendlyError } from "./errors";

describe("errors in plain words", () => {
  it("keeps Bursr's own plain messages", () => {
    expect(friendlyError(new Error("Add their name."))).toBe("Add their name.");
  });

  it("never shows [object Object]: a wallet's error object becomes a sentence", () => {
    expect(friendlyError({ message: "User rejected the request" })).toMatch(/closed your wallet before confirming/);
    expect(friendlyError({})).toMatch(/Something went wrong/);
    expect(friendlyError({ error: { message: "Wallet not found" } })).toMatch(/couldn't find a wallet/);
  });

  it("translates network trouble, service codes and developer messages", () => {
    expect(friendlyError(new TypeError("Failed to fetch"))).toMatch(/couldn't reach the network/);
    expect(friendlyError({ code: "spend_budget_exceeded", status: 400 })).toMatch(/weekly limit/);
    expect(friendlyError(new Error("Invalid input: expected boolean, received undefined"))).toMatch(/Something went wrong/);
    expect(friendlyError(new Error("e is not a function"))).toMatch(/Something went wrong/);
    expect(friendlyError(new Error("Signature not accepted: bad key"))).toMatch(/sign in again/);
  });

  it("a closed passkey prompt is not a network problem", () => {
    const closed = Object.assign(new Error("The operation either timed out or was not allowed. See: https://www.w3.org/TR/webauthn-2/#sctn-privacy-considerations-client."), { name: "NotAllowedError" });
    expect(friendlyError(closed)).toMatch(/closed the passkey prompt/);
    expect(friendlyError({ error: { code: "signer_mismatch", message: "x" } })).toMatch(/isn't the one that controls/);
  });
});
