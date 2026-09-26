#!/usr/bin/env python3
"""Move the seed data onto one taxonomy: the draft.

Decision (operator, 2026-09-27): the draft taxonomy wins. Until now the 24-profile cast and the
event/tag links used the 35 Core ids while the 100-person roster used the 56 draft ids, so the two
sets shared no tag ids and never matched each other — a hundred photographed people read as
"nothing shared yet" and sat below the cast everywhere.

This script:
  1. rewrites scripts/seed/tags/tags.json from the draft, so it is the single tag source;
  2. repoints the cast's give/learn ids through MAP below;
  3. repoints the event -> tag links the same way.

It only touches tag ids: names, intros, photos, events and orderings are untouched. Run
scripts/seed/build_sql.py afterwards to regenerate tags.sql and events.sql.
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
DRAFT = HERE.parent.parent / "docs/drafts/tag-taxonomy-proposal.json"
TAGS = HERE / "tags/tags.json"
CAST = HERE / "profiles/demo-profiles.json"
EVENT_TAGS = HERE / "events/event-tags.json"

# Every id the cast and the event links use -> its draft equivalent. Semantic, not mechanical:
# `cooking` becomes northern-thai-cooking because the roster offers that, and so on.
MAP = {
    "english": "english-conversation",
    "thai-language": "thai-basics",
    "cooking": "northern-thai-cooking",
    "street-food": "street-food-spots",
    "scooter": "scooter-driving-license",
    "bureaucracy": "visa-immigration",
    "temples": "temples-etiquette",
    "music": "music-jamming",
    "tech": "web-tech",
    # unchanged, listed so the mapping is complete and auditable
    "design": "design",
    "hiking": "hiking",
    "muay-thai": "muay-thai",
}


def main() -> None:
    draft = json.loads(DRAFT.read_text())
    draft_tags = draft["tags"]
    draft_ids = {t["id"] for t in draft_tags}

    # 1. tags.json becomes the draft, in its own order.
    out = []
    for index, tag in enumerate(draft_tags):
        out.append({
            "id": tag["id"],
            "label_en": tag["label_en"],
            "label_th": tag["label_th"],
            "sort_order": tag.get("sort_order", (index + 1) * 10),
        })
    TAGS.write_text(json.dumps({
        "_note": ("The draft taxonomy, promoted to the single tag source (operator decision "
                  "2026-09-27). Supersedes the 35 Core tags; scripts/seed/migrate-to-draft-"
                  "taxonomy.py repointed the cast and the event links through its MAP. "
                  "Regenerate tags.sql with scripts/seed/build_sql.py. Thai labels still need a "
                  "native speaker's check."),
        "tags": out,
    }, ensure_ascii=False, indent=2) + "\n")
    print(f"tags.json  : {len(out)} tags written from the draft")

    # 2. the cast's ids.
    cast = json.loads(CAST.read_text())
    changed = 0
    for person in cast["profiles"]:
        for key in ("give", "learn"):
            mapped = []
            for tag_id in person[key]:
                new = MAP.get(tag_id, tag_id)
                if new != tag_id:
                    changed += 1
                if new not in mapped:
                    mapped.append(new)
            person[key] = mapped
    CAST.write_text(json.dumps(cast, ensure_ascii=False, indent=2) + "\n")
    print(f"cast       : {changed} tag references repointed")

    # 3. the event links.
    links = json.loads(EVENT_TAGS.read_text())
    relinked = 0
    for slug, ids in links["event_tags"].items():
        mapped = []
        for tag_id in ids:
            new = MAP.get(tag_id, tag_id)
            if new != tag_id:
                relinked += 1
            if new not in mapped:
                mapped.append(new)
        links["event_tags"][slug] = mapped
    EVENT_TAGS.write_text(json.dumps(links, ensure_ascii=False, indent=2) + "\n")
    print(f"event links: {relinked} tag references repointed")

    # Everything left over must exist in the draft, or the seed will not load.
    stragglers = set()
    for person in cast["profiles"]:
        stragglers |= {t for t in person["give"] + person["learn"] if t not in draft_ids}
    for ids in links["event_tags"].values():
        stragglers |= {t for t in ids if t not in draft_ids}
    if stragglers:
        raise SystemExit(f"✗ ids still outside the draft taxonomy: {sorted(stragglers)}")
    print("✓ every id now resolves against the draft taxonomy")


if __name__ == "__main__":
    main()
