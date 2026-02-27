import path from "path";
import { config } from "dotenv";

/**
 * Load .env from project root then agents/.env.shared (if present) then cwd .env.
 * Used by feedback commands and so the same master keys work from the repo root.
 */
export function loadEnvForCommands(): void {
    config({ path: path.join(process.cwd(), ".env") });
    config({ path: path.join(process.cwd(), "agents", ".env.shared") });
    config();
}
