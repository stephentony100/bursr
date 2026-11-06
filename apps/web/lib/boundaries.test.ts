import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// AGENTS.md rule 4: only the owner changes payees or payout addresses; no code
// path lets the agent do it. The agent side of Bursar (reading invoices,
// checks, planning, paying) must never import the owner-only modules.

const LIB = import.meta.dirname;
const OWNER_ONLY = ["owner-actions", "owner"];

/** Agent-side modules: everything the AI and the payment loop run. */
const AGENT_SIDE = ["agent-account", "agent-account.ts", "checks", "reader.ts", "reader-schema.ts", "invoices.ts", "plan.ts", "pay.ts", "oneclick.ts"];

function files(p: string): string[] {
  const full = path.join(LIB, p);
  try {
    if (statSync(full).isFile()) return [full];
  } catch {
    return []; // not built yet
  }
  return readdirSync(full, { recursive: true })
    .map((f) => path.join(full, String(f)))
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts"));
}

describe("module boundaries", () => {
  const agentFiles = AGENT_SIDE.flatMap(files);

  it("finds the agent-side modules", () => {
    expect(agentFiles.length).toBeGreaterThan(3);
  });

  it.each(agentFiles.map((f) => [path.relative(LIB, f), f]))("%s does not import owner-only code", (_name, file) => {
    const src = readFileSync(file, "utf8");
    for (const mod of OWNER_ONLY) {
      expect(src).not.toMatch(new RegExp(`from\\s+["'][./]*(lib/)?${mod}["']`));
    }
  });
});
