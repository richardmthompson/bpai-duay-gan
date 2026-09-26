// Copies the team's seed files into src/mocks so mock mode shows the same tags, events and people as the database.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const seed = join(web, "../../scripts/seed");
const out = join(web, "src/mocks/seed");
mkdirSync(out, { recursive: true });
for (const [from, to] of [
  ["tags/tags.json", "tags.json"],
  ["events/events.json", "events.json"],
  ["profiles/demo-profiles.json", "demo-profiles.json"],
]) {
  copyFileSync(join(seed, from), join(out, to));
}
