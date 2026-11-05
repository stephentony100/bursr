import { describe, expect, it } from "vitest";
import { isDryRun, readEnv } from "./env";

describe("readEnv", () => {
  it("defaults to dry-run with no variables set", () => {
    const env = readEnv({});
    expect(env.BURSAR_MODE).toBe("dry-run");
    expect(isDryRun(env)).toBe(true);
    expect(env.ONECLICK_BASE_URL).toBe("https://1click.chaindefuser.com");
  });

  it("treats empty strings as unset and strips inline comments", () => {
    const env = readEnv({ NEAR_AI_API_KEY: "", AGENT_ACCOUNT_BACKEND: "agent-api   # agent-api | vault" });
    expect(env.NEAR_AI_API_KEY).toBeUndefined();
    expect(env.AGENT_ACCOUNT_BACKEND).toBe("agent-api");
  });

  it("rejects an unknown mode", () => {
    expect(() => readEnv({ BURSAR_MODE: "yolo" })).toThrow();
  });
});
