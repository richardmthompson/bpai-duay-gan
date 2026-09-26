# Demo people (100)

Made-up profiles for the demo: 50 Thai locals (`l01`–`l50`) and 50 foreigners (`f01`–`f50`). Live view: https://chiangmaievent.florbase.com/profiles

- `profiles.json` — the seed. Each profile has name, age, occupation, neighbourhood, a short intro (Thai + English for locals), `give` and `learn` tag ids, and `photo`.
- `portraits/` — 400×400 JPEG portraits, AI-generated with Cloudflare Workers AI (`@cf/black-forest-labs/flux-1-schnell`). Not real people.
- `data.mjs` — the hand-written source rows. Edit here, then run `node build.mjs` to regenerate `profiles.json`.

Tag ids come from `docs/drafts/tag-taxonomy-proposal.json`, the single 85-tag taxonomy that `scripts/seed/tags/tags.json` and `reference/tag-taxonomy.md` are generated from. `build.mjs` fails if a profile uses an unknown tag, and `scripts/seed/build_sql.py` checks the same across all 124 demo people.

This is separate from `scripts/seed/profiles/demo-profiles.json` (the 24-profile seed with the Nok/Sam stage pair).
