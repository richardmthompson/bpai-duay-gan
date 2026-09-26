# Demo people (100)

Made-up profiles for the demo: 50 Thai locals (`l01`–`l50`) and 50 foreigners (`f01`–`f50`). Live view: https://chiangmaievent.florbase.com/profiles

- `profiles.json` — the seed. Each profile has name, age, occupation, neighbourhood, a short intro (Thai + English for locals), `give` and `learn` tag ids, and `photo`.
- `portraits/` — 400×400 JPEG portraits, AI-generated with Cloudflare Workers AI (`@cf/black-forest-labs/flux-1-schnell`). Not real people.
- `data.mjs` — the hand-written source rows. Edit here, then run `node build.mjs` to regenerate `profiles.json`.

Tag ids come from `docs/drafts/tag-taxonomy-proposal.json`; `build.mjs` fails if a profile uses an unknown tag. They do not yet use the 85-tag taxonomy on the `tags/full-taxonomy` branch.

This is separate from `scripts/seed/profiles/demo-profiles.json` (the 24-profile seed with the Nok/Sam stage pair).
