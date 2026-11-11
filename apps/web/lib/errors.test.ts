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
});
