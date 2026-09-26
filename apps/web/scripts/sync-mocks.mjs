// Copies the team's seed files into src/mocks so mock mode shows the same tags, events and people as the database.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
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
  ["demo-people/profiles.json", "demo-people-profiles.json"],
]) {
  copyFileSync(join(seed, from), join(out, to));
}

// The 100-person roster's portraits are referenced as /portraits/<id>.jpg by the seeder, so the
// images have to live under public/ to be served at all.
const portraits = join(seed, "demo-people/portraits");
const publicPortraits = join(web, "public/portraits");
mkdirSync(publicPortraits, { recursive: true });
let copied = 0;
for (const name of readdirSync(portraits)) {
  copyFileSync(join(portraits, name), join(publicPortraits, name));
  copied += 1;
}
console.log(`sync-mocks: ${copied} portraits → public/portraits`);
