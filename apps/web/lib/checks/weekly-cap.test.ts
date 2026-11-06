import { describe, expect, it } from "vitest";
import { ctx, inv } from "./test-helpers";
import { weeklyCap } from "./weekly-cap";

describe("weekly cap", () => {
  it("passes when it fits exactly under the weekly limit", () => {
    // 907 already committed + 93 = 1000, the limit
    expect(weeklyCap(inv(), ctx({ committedThisWeekUsd: 907_000_000n })).status).toBe("pass");
  });

  it("defers to next week when it would go over", () => {
    const r = weeklyCap(inv(), ctx({ committedThisWeekUsd: 950_000_000n }));
    expect(r.status).toBe("defer");
    expect(r.reason).toContain("more than the $50.00 left under your weekly limit of $1,000.00");
  });
});
