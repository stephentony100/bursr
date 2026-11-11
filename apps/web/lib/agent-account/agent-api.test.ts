import { describe, expect, it } from "vitest";
import { apiIdempotencyKey } from "./agent-api";

describe("Agent API idempotency keys", () => {
  it("turns Bursr's step key into a stable UUID (v5), different per step", () => {
    const a = apiIdempotencyKey("item-1:withdraw");
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(apiIdempotencyKey("item-1:withdraw")).toBe(a);
    expect(apiIdempotencyKey("item-1:swap")).not.toBe(a);
  });
});
