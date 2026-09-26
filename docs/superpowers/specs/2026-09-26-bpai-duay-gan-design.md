---
feature: Bpai Duay Gan — locals and nomads matching on skills and events
date: 2026-09-26
status: shipped (see the banner below — parts of this plan were overtaken on the night)
session: nw-doorway (Shivam, role 1)
supersedes: /root/DESIGN-BRIEF-bpai-duay-gan.md.md (Richard's /grill-me brief)
---

> **Status at 2026-09-27 01:00 ICT — what actually shipped, where this differs:**
> - The web app is **role 3's** (`e5b0667`, "every screen in Thai and English, running on a mock
>   backend"), wired to the api on the night. An earlier web app in this repo was removed. The
>   contract of record is `apps/web/src/lib/contract.ts`, not §5 of this document.
> - **No Docker** (`d94ca02`): the box runs apt packages and systemd. See `deploy/README.md`.
> - Auth.js is not used; sign-in is a small magic-link flow plus a guarded one-click login for the
>   seeded cast. See `CONTRACT.md`.
> - Ranking puts shared events first, then tag overlap, computed in `apps/api/src/store.ts` (issue #3).
>   That order is the one §7 was corrected to; the seed data settles it.
> - Translation also returns a **cultural note** per message, which the chat UI renders as its own
>   card. That is Challenge 01's "cultural confidence" idea, made visible.
> - Live at **https://bpai.drdos.shivamsaluja.com**.

# Design — Bpai Duay Gan (ไปด้วยกัน)

A Chiang Mai PWA that pairs Thai locals with nomads and expats on **events and skill swaps**,
with chat that translates across the language line. Built by six for the Claude Community
Hackathon; judged after lunch 2026-09-27.

This spec is the corrected version of Richard's design brief. Where the brief and the repo
disagreed, this document records what is true as of 2026-09-26 22:30 IST — verified against
the live judging slides, the repo, and the deploy box.

## 1. Scoring context (verified from the judging slide)

| Criterion | Weight | Question it asks |
|---|---|---|
| Day-one Impact | **COUNTS DOUBLE** | Could people use it right away, and would it make a real difference? |
| Product | 1× | Is it easy to use? Do people get it the first time? |
| Idea | 1× | However far you got, how creative and useful is the idea? |
| Demo | 1× | Are the problem, the user and the outcome clear from your presentation? |

Format: 4–6 minutes per team, each criterion 0–5. Code must be pushed to a public repo.

**Consequence for the build:** double-weighted Day-one Impact means a *working, reachable,
immediately usable* app outranks a broader unfinished one. Cut features, never the golden path.

## 2. Both challenges — and the mapping slide

The team addresses **Challenge 01** ("Open up nomad events to locals") and **Challenge 02**
("Navigate Chiang Mai's cultural layers"). The deck ends with this table, and the demo is
scripted so every row is *shown*, not claimed:

| Slide idea | Feature that answers it |
|---|---|
| C01·1 Live translation | Translated chat — each side writes their own language |
| C01·2 Local-language listings | Events feed rendered in the reader's language |
| C01·3 Cultural confidence | Politeness register + cultural notes inside the translation prompt |
| C02·1 Languages (Thai, Kham Mueang, English, Chinese) | Bilingual UI, plus **Kham Mueang** and **Chinese** as exchange tags |
| C02·2 Cultural know-how | Market / street-food / northern-cooking tags — the slide's own khao-soi example |
| C02·3 Icebreakers | A match request that carries a *reason* (shared tag, or a shared event) |

⚠ **Confirmed gap (2026-09-26 23:36 ICT):** the shipped 12-tag taxonomy
(`scripts/seed/tags/tags.json`) has **no Kham Mueang and no Chinese** entry, while the public
README promises "Locals offer Kham Mueang basics" and Challenge 02 names both. Marc's 39-tag
draft has `kham-mueang` and `chinese-conversation`. Adding those two is a tags.json edit plus a
`build_sql.py` regen — and it is what makes the C02·1 row true rather than implied.

## 3. Product

1. **Onboard** — join as `local` or `foreigner`; pick interface language (th/en); choose Give
   and Learn tags from the curated list; add free-text interests in your own words; pick a
   politeness register (female / male / neutral).
2. **Browse** — see only the other community, ranked, with the shared reasons shown on each card.
3. **Request → accept** — ask to match, optionally citing an event you are both attending.
   The other person accepts or declines. In-app notification on both events.
4. **Chat** — matched pair only, text only. Each message is shown in the reader's language;
   the original is one tap away.
5. **Events** — bilingual feed; "I'm going" appears on the profile and feeds the ranking.
6. **Safety** — block (hides both directions) and report (writes a row).

### Explicitly out of scope
Event group chat, voice, images, post-event follow-up, attendance tracking, moderation queue,
ID verification, Chinese or Northern Thai interface, organiser-posted events.

## 4. Demo script (4 minutes)

Two browser profiles on one laptop: **Sam** (foreigner, English UI) and **Nok** (local, Thai UI)
— the stage pair already designed in `scripts/seed/profiles/`.

1. Sam opens **Events** → the Akha event reads in English → taps *I'm going*. *(C01·2)*
2. Sam opens **Browse** → Nok is first, card reads *"you teach English · she teaches cooking &
   scooter · you're both going to Tales My Ancestors Taught Me"*. *(C02·3)*
3. Sam requests a match, naming that event. *(C02·3)*
4. Nok's phone/UI shows the request → she accepts → chat opens. *(C02·3)*
5. Sam types English → Nok reads Thai with the right particle. *(C01·1, C01·3, C02·1)*
6. Nok replies Thai → Sam reads English.
7. Close on the mapping slide (§2).

## 5. Architecture

```
apps/web         Next.js PWA (:3000) — Auth.js, pages, th/en strings, service worker
apps/api         Node HTTP + WebSocket (:4000) — profiles, ranking, match state, chat, translate, events, admin ingest
packages/db      schema, migrations, client (Postgres 17 + pgvector)
packages/shared  the frozen contract — types + zod schemas used by web and api
scripts/seed     tags, events, demo profiles → DB (landed; SQL + JSON, see §9)
scripts/extract-events  Meetup extractor + Claude-written Thai/English copy (landed)
```

⚠ `infra/compose/` was **deleted** in `d94ca02` ("team is not using Docker"). The deploy
mechanism is undecided (§9).

One TypeScript codebase, npm workspaces. Web calls the API over HTTPS; holds a WebSocket for
chat and in-app notifications. Postgres is the single store.

**Design rules**
- `packages/shared` is the only place a request/response shape is defined. Web and api both
  import it; neither redefines it.
- The api owns every table. The web app never queries Postgres directly.
- Every endpoint returns `reasons[]` where the UI shows *why*.

## 6. Data model

| Table | Notes |
|---|---|
| `users` | Auth.js-owned (`id`, `email`, `name`, …). **Do not add columns.** |
| `profiles` | `user_id`, `community` (`local`/`foreigner`), `interface_language`, `speaks_language`, `politeness_register`, `interests_text`, `avatar_url`, `onboarding_complete` |
| `tags` | `id`, `label_en`, `label_th`, `sort_order` |
| `profile_tags` | `user_id`, `tag_id`, `direction` (`give`/`learn`) |
| `events` | `source` (`seed`/`scrape`), `external_id`, `title_th`, `title_en`, `starts_at`, `venue`, `url` |
| `event_attendance` | `user_id`, `event_id` |
| `match_requests` | `from_user`, `to_user`, `event_id?`, `message?`, `status` (`pending`/`accepted`/`declined`/`withdrawn`) |
| `matches` | `a_user`, `b_user`, `created_at` |
| `messages` | `match_id`, `sender_id`, `body`, `source_lang`, `translated_body`, `target_lang` |
| `blocks`, `reports` | safety |
| `profiles.interests_embedding` | `vector`, nullable. Column exists; **values are deferred** (§8) |

## 7. Ranking — the "why we matched" engine

For viewer V looking at community C, ordered (corrected 2026-09-26 — see the note below):

1. **Complementary tags** — `V.learn ∩ other.give` + `V.give ∩ other.learn`, descending.
2. **Shared event** — both marked *going* to the same event.
3. **Same-side tags** — give↔give, learn↔learn (weak).
4. **No overlap** — everyone else, so the list never runs empty.

⚠ **This order is the reverse of the first draft, and the seed data settles it.**
`scripts/seed/profiles/README.md` documents Nok's expected list as: Sam 3+1, then Emma/Lukas/Aisha
at 2, then Hana/Olivia at 1, then **Marco — event only**, then five with no overlap. Marco has a
shared event but no tag overlap, and he ranks *below* people with one tag and no event. So tags
lead and a shared event is the bonus beneath them. Ranking an event above a tag match would have
reproduced a different order than the one written down, and the demo is judged on that list.

Tie-break: `created_at desc` (matches the seed design; keeps the demo deterministic).
Blocked or already-matched pairs are excluded. Each card returns `reasons[]` strings.

**This is testable and must be tested.** The seed README states the expected order for Nok's and
Sam's lists (Nok first for Sam; Sam first for Nok; then the documented ties). That becomes the
ranking test — it protects the exact thing the judge sees.

## 8. Translation

- Model: `claude-haiku-4-5`, `max_tokens` ~1024, **no thinking** (latency is the point).
- The system prompt carries: direction (th→en / en→th), the **author's** register
  (ค่ะ / ครับ / neutral), and "output only the translation; keep names, places and times verbatim".
- **Never block the send on translation.** Persist the original, push it over the socket
  immediately, translate asynchronously and push the translation when ready. A Claude outage
  degrades to "original shown, retry offered" instead of a frozen chat.
- Sonnet 5 stays available behind an env switch (per RD-9); Haiku is the default.
- Embeddings (RD-4's hybrid) are **deferred, not deleted**: the column and an `embedProfile()`
  hook exist, `VOYAGE_API_KEY` is unset. Tag+event overlap carries the demo.

## 9. Deploy — verified facts (these correct the runbook)

Target: **149.56.37.29**, a blank OVH box dedicated to this hackathon.

| Fact | Status |
|---|---|
| OS | **Ubuntu 24.04.3 LTS** — the runbook says 26.04; fix it |
| Virt | OpenVZ (ploop) — nested containers were a risk |
| Docker | available and proven (29.1.3, overlayfs, `hello-world` OK) — but the team removed `infra/compose/` at 23:24 ICT, so **Docker is not the plan**. Deploy mechanism re-opened. |
| Port 80 | **apache2 holds it** — `systemctl disable --now apache2` before Caddy |
| Port 443 | free |
| Resources | 2 vCPU / 6 GB / 148 GB — builds are slow; keep `output: 'standalone'` |

**DNS:** `*.drdos.shivamsaluja.com` is a **Cloudflare wildcard → 152.53.67.253**, so
`bpai.drdos.shivamsaluja.com` currently resolves to the wrong server. Required: an **explicit
A record `bpai → 149.56.37.29`, set to DNS-only (grey cloud)** — proxied breaks Caddy's
HTTP-01 challenge. Verify resolution *before* starting Caddy.

**Secrets:** one `.env` on a shared box, `chmod 600`, never committed (`.gitignore` already
covers it). Rotate the root password after the weekend — it was shared over chat.

## 10. Auth

Auth.js in the web app, Postgres adapter.

- **Email magic link** (primary; SMTP is ready) for real signups.
- **Google**, then **LINE**, later in the cut order. Same-email linking across providers needs
  `allowDangerousEmailAccountLinking` — acceptable here, and required by the brief's
  "social login lands on the same profile" scenario. LINE returns **no email**, so a LINE-only
  user must never be linked by email.
- **Seeded demo accounts use a guarded dev-login** (decision 2026-09-26): magic link is for real
  signups; the 24 seeded profiles log in with one click, gated by an env flag so it cannot be
  used in production. Rationale: `nok.demo@example.com` cannot receive mail, and the stage demo
  must not depend on an inbox.
- ⚠ Implementation risk to verify against Auth.js docs before writing it: the Credentials
  provider only works with **JWT** sessions, while the magic-link provider needs an adapter.
  The supported combination is adapter + `session.strategy = "jwt"` + Credentials. Confirm, or
  fall back to a dev-login route that mints a session row directly.

## 11. Realtime

One `/ws` endpoint on the api. The web mints a short-lived token at `/api/ws-token`
(`WS_TOKEN_SECRET`, shared by web and api) and the api verifies it on upgrade.
Carries chat messages and in-app notifications (request received / accepted).
Fallback if it costs more than ~30 minutes: poll every 2 s on the same endpoints.

## 12. Cut order (adjusted for the double-weighted criteria)

1. Profile (tags, free text, language, register)
2. Browse ranked + reasons
3. Request / accept + in-app notification
4. Translated chat
5. Events feed + going
6. Block / report
7. Google login
8. Web push
9. LINE (login + messaging)
10. Embeddings

**Code freeze 2026-09-27 11:00 IST.** Final 90 minutes: deck, video, rehearsal. Nothing ships
after the freeze that has not been demoed end-to-end.

## 13. Open items

| # | Item | Owner |
|---|---|---|
| 1 | Explicit DNS A record, DNS-only, before Caddy | Shivam |
| 2 | Confirm Kham Mueang + Chinese exist in the 12-tag taxonomy | Richard / Lutz |
| 3 | Reconcile the seed's placeholder tag slugs with the real taxonomy | Lutz |
| 4 | GitHub push credentials for this box (none present) | Shivam |
| 5 | Anthropic API key into the box's `.env` | Shivam |
| 6 | SMTP credentials for magic link | Shivam |
| 7 | Thai register review — no native speaker on the team; do not claim it on stage | — |
| 8 | No CONTRACT.md or PRP in the repo; §5 + `CONTRACT.md` replace it | Shivam |

## 14. Corrections carried from the brief review (2026-09-26)

Recorded so the team stops re-deriving them:

- The brief never named the challenge; it is **both** (§2).
- Tag taxonomy is **owned and authoritative** (Richard's 12), not "open, no owner".
- Embedding provider is not Voyage-or-nothing; **embeddings are deferred** (§8).
- Hosting is **not** "a teammate's unnamed box" — it is the dedicated OVH box (§9), and the
  runbook's "Ubuntu 26.04" and the 80/443 clash are both wrong for it.
- Auth is magic-link-first; the brief's "email or phone OTP" is now magic-link + dev-login (§10).
- Events landed at 23:36 ICT as **24** real events (26 Sep – 3 Oct, Thai + English), including the
  four the demo profiles reference. The seed README's "four events" was the minimum, not the goal.
- The tag taxonomy shipped, and it **kept the demo profiles' slugs** — the "reconcile placeholder
  slugs" item is closed. The Kham Mueang / Chinese gap above is the residue.
- The public README's team list misspells **Shivam** as "Shavab".
- The README leads with *Event Buddy* while the brief led tags-first. Both challenges are in
  play, so the README keeps both but must not imply per-event matching is the only path.
