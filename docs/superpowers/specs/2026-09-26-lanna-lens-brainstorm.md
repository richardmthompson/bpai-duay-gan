---
project: bpai-duay-gan
type: brainstorm-archive
status: parked
session: f3ce30af-a09f-41f9-9f85-0b344227485e
updated: 2026-09-26
tags: [project/bpai-duay-gan, type/brainstorm-archive, lanna, tai-tham, kham-mueang]
up: "[[STATE]]"
---

# Parked brainstorm — Lanna script + lexicon direction (pre-build, 2026-09-26)

Parked 2026-10-08 at operator direction. This is the pre-build idea
exploration that ran in session `f3ce30af` on 2026-09-26 (the night before
the build). The built product went a different way — the swipe-deck +
translation app documented in
[2026-09-26-bpai-duay-gan-design.md](2026-09-26-bpai-duay-gan-design.md) —
but the session reached conclusions the team may want for a future Lanna /
Tai Tham / Kham Mueang language-revival project. Extracted verbatim from the
session transcript; nothing was built.

## The core architectural idea

**The model never produces Lanna.** Thai→English glossing is the only LLM
hop, because Thai is high-resource and safe. The low-resource language is
*only* ever produced by retrieval or induced rules. That single rule is the
answer to "how do you know it isn't hallucinating" — and it makes the
technical story defensible against a room of judges.

Data flow:

```
Thai text ─► script engine (rules ← gold pairs) ─► Tai Tham + confidence
    │
    └─► lexicon lookup ─► Kham Mueang + IPA/tone + gloss + source
                              └─► LLM glosses Thai→English   (safe hop only)
```

Error handling as honesty-as-a-feature:

- Unknown character → mark the span unverified, never guess.
- Word not in lexicon → "not attested in our sources", never invent.
- Per-output confidence shown. The gap list is generated from the data, not
  written by hand — it's evidence, not copy.

## The four surface options, scored

Scored against the event rubric at the time (day-one ×2 / product / idea /
demo, 5 = best). Judgements from the session, not measurements.

| Surface | Day-one ×2 | Product | Idea | Demo | Verdict |
|---|---|---|---|---|---|
| **Sueb Lanna** (script + lexicon) | 3 | 4 | **5** | **5** | Only one with real depth and an unfakeable wow |
| **Market lens** (point → know → say) | **5** | **5** | 3 | 4 | Highest immediacy, most app-shaped |
| **Merged city calendar** (events) | **5** | 4 | 2 | 3 | Real data tonight, no technical story |
| **Arrival PWA** (visitor bundle) | 3 | 2 | 2 | 2 | Bundle, off-umbrella, hard to demo |

Session evaluations worth keeping:

- **Merged calendar** — the instinct (real data, immediately) is right, and
  it maps onto the brief's own "event listings and cross-listings" theme.
  Weaknesses: scraping Luma/Meetup/Facebook is against their terms and
  brittle; it's aggregation rather than depth — every team can build it —
  and a calendar doesn't make a room go quiet. Dies on idea and demo.
- **Arrival PWA** — a bundle, not a product: no answer to "do people get it
  the first time?" and off-umbrella (serves visitors, and the municipality
  was judging). Its one good kernel worth extracting: *photo + place → a
  specific answer for exactly where you're standing* ("you're on Wualai
  Road, it's Saturday, this is the Walking Street market…").
- **Recommended fusion at the time:** Sueb Lanna's engine with the market
  lens as its surface. The engine (induced script rules + cited lexicon +
  measured benchmark) is what nobody can copy in a night; the market lens
  is what makes it immediately obvious why anyone cares.

## The sharper four (after the "too generalized" feedback)

Each describable in one sentence with no "and".

- **S1 — Lanna Lens.** *Point your camera at Chiang Mai and see the city in
  the script it was written in.* Thai text in the world → correct Tai Tham
  rendered in place, with the Kham Mueang name and pronunciation. AR is the
  sizzle; the script engine is the substance. Measured fact from the
  session: a frontier model transliterated Thai→Tai Tham at only ~20%
  correctness — that gap is the moat. Honest weakness: reading Lanna is not
  a mass need — this is revival and pride, not accessibility, and should be
  said out loud. Robust version is camera → snapshot → sign re-rendered
  (true perspective-tracked AR is risky in one night, and the snapshot
  version looks the same and cannot fail).
- **S2 — The Sign Project.** *We put Lanna script back on Chiang Mai
  shopfronts, today.* The lens generates; two people print + laminate by
  7pm; by the demo there are photographs of real signs that did not exist
  that morning. The most concrete day-one claim available — a photo, not a
  promise. Time-box: two people, two hours; if the print shop fails it
  costs nothing.
- **S3 — Kad Luang.** *Warorot Market, entirely.* Not "markets in Chiang
  Mai" — one market to saturation: every stall type, its Lanna and Kham
  Mueang name, the script, what it's for, how to ask. Depth by exhaustion
  instead of breadth. Sharp and easy to demo; small audience.
- **S4 — The Missing Thousand.** *We added the N words no Lanna dictionary
  in the world contains.* A finite, named, verifiable deliverable.
  Strongest idea artifact on the list, weakest product — a result, not
  something a person picks up.
- **Session recommendation:** S1 with S2 as its proof. One sentence covers
  both: *"we built a lens that shows Chiang Mai in Lanna script — and here
  are the signs we put up with it tonight."* Depth, novelty, and a
  photograph.

## Demo shape (for the fused direction)

| Time | Beat |
|---|---|
| 0:00–0:45 | The stake — the municipality's Learning City mandate; the language and the script |
| 0:45–2:15 | **The live bake-off** — a judge picks Thai words; the model's attempt vs ours side by side, dictionary as verdict, score on screen |
| 2:15–3:15 | The archive — a word with its script, IPA, a real recording, its source. Then the gap: *the best open Lanna dictionary doesn't contain "twenty"* |
| 3:15–4:00 | Everyone in the room types their name → Lanna script |
| 4:00–5:00 | Handover — what the partners get, corpus licence flagged openly, limitations, next steps |

## Verification bar the session set

- **Engine:** exact match on held-out pairs, reported as measured. "If it's
  55%, we say 55% — an honest number beats a claim."
- **Lexicon:** every entry resolves to a source; gap list is
  machine-generated.
- **Demo:** rehearse against a fixed word list, with a live-from-the-room
  fallback if the judge picks something brutal.

## Why it was parked

The build window was ~17 hours at the end of the session, and the team went
with the swipe-deck + translation product instead (that build is documented
in the design spec and STATE). The open question this archive keeps alive:
the frontier-model 20% Tai Tham transliteration measurement and the
retrieval-only-for-low-resource rule are both reusable if anyone picks the
Lanna direction up later.
