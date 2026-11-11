// Runs once when the Next.js server starts: Bursr's agent starts working in
// the background (lib/agent/loop.ts). BURSAR_AGENT=off turns it off.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAgentLoop } = await import("./lib/agent/loop");
    startAgentLoop();
  }
}
