import { describe, expect, it } from "vitest";
import { ctx, inv } from "./test-helpers";
import { urgency } from "./urgency";

describe("urgency wording (AI judgement)", () => {
  it("flags pressure wording, never blocks", () => {
    const r = urgency(inv({ urgencyNote: "Pay today or your account will be closed" }), ctx());
    expect(r.status).toBe("flag");
    expect(r.reason).toContain("Pay today or your account will be closed");
  });

  it("passes when there is none", () => {
    expect(urgency(inv(), ctx()).status).toBe("pass");
    expect(urgency(inv({ urgencyNote: "  " }), ctx()).status).toBe("pass");
  });
});
