import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PALETTE } from "@/lib/palette";

// Keeps Bursr's colours in one system (rules in lib/palette.ts and DESIGN.md):
// the CSS tokens and the palette agree, and screens never hard-code a colour.

const web = path.resolve(__dirname, "..");
const css = readFileSync(path.join(web, "app/globals.css"), "utf8");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !f.endsWith(".test.ts") ? [p] : [];
  });
}

describe("colour system", () => {
  it("every palette colour is a CSS token with the same value", () => {
    for (const [name, hex] of Object.entries(PALETTE)) {
      const m = css.match(new RegExp(`--color-${name}: *(#[0-9a-fA-F]{6})`));
      expect(m?.[1]?.toLowerCase(), name).toBe(hex);
    }
  });

  it("screens use tokens, never hard-coded colours", () => {
    const offenders = [...files(path.join(web, "app")), ...files(path.join(web, "components"))].flatMap((f) => {
      const text = readFileSync(f, "utf8");
      return [...text.matchAll(/#[0-9a-fA-F]{6}\b|-\[#[0-9a-fA-F]{3,8}\]/g)].map((m) => `${path.relative(web, f)}: ${m[0]}`);
    });
    expect(offenders).toEqual([]);
  });
});
