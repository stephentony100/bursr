import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";

// Scripts run from apps/web (npm -w). The one .env lives at the repo root.
const rootEnv = path.resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) config({ path: rootEnv, quiet: true });
