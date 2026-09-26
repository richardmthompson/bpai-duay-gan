#!/usr/bin/env python3
"""Move the seed data onto one taxonomy: the merged 85-tag list.

docs/drafts/tag-taxonomy-proposal.json is the merged list (role 5, Marc): the 85-row reference
table and the 56-id draft folded into one, keeping the reference table's id wherever both lists
held the same concept. The 100-person roster already uses it. The 24-person cast and the event ->
tag links still used the 56-id draft ids, so they could not match the roster.

This script:
  1. rewrites scripts/seed/tags/tags.json from the proposal, in the database's four-column shape,
     renumbering sort_order 10, 20, 30... in the proposal's own order (the proposal's hundreds
     collide across categories);
  2. repoints the cast's give/learn ids through MAP below, and regenerates the cast's tag_slugs
     from the result;
  3. repoints the event -> tag links the same way.

MAP is the previous migration's map read backwards, because that map came from the reference
table's ids. It must be one-to-one: ranking counts matched tags, so two source ids collapsing onto
one target would quietly drop a person's tag and change the stage demo's order. The script asserts
that before writing anything. Rerunning it is a no-op once the ids are repointed.

It only touches tag ids and the notes that describe them: names, intros, photos, events and
orderings are untouched. Run scripts/seed/build_sql.py afterwards; it regenerates tags.sql,
events.sql and reference/tag-taxonomy.md and fails if any id does not resolve.
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROPOSAL = HERE.parent.parent / "docs/drafts/tag-taxonomy-proposal.json"
TAGS = HERE / "tags/tags.json"
CAST = HERE / "profiles/demo-profiles.json"
EVENT_TAGS = HERE / "events/event-tags.json"

# Every id the cast and the event links used -> its merged equivalent.
MAP = {
    "english-conversation": "english",
    "thai-basics": "thai-language",
    "northern-thai-cooking": "cooking",
    "street-food-spots": "street-food",
    "scooter-driving-license": "scooter",
    "visa-immigration": "bureaucracy",
    "temples-etiquette": "temples",
    "music-jamming": "music",
    "web-tech": "tech",
    # unchanged, listed so the mapping is complete and auditable
    "design": "design",
    "hiking": "hiking",
    "muay-thai": "muay-thai",
}

CAST_NOTE = ("Every give/learn id resolves against scripts/seed/tags/tags.json, the merged 85-tag "
             "taxonomy; scripts/seed/build_sql.py fails if one does not. tag_slugs lists the ids the "
             "profiles use. Event refs are 'seed:<external_id>' and must match events seeded with "
             "source='seed'. All people and emails are fictional.")


def dump(path, data):
    # Same layout as the files already on disk, so the diff touches only the changed lines.
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def repoint(ids, where):
    mapped = [MAP.get(tag_id, tag_id) for tag_id in ids]
    if len(set(mapped)) != len(mapped):
        raise SystemExit(f"✗ {where}: repointing {ids} would merge two tags into one: {mapped}")
    return mapped, sum(a != b for a, b in zip(ids, mapped))


def main() -> None:
    if len(set(MAP.values())) != len(MAP):
        raise SystemExit("✗ MAP is not one-to-one: two source ids share a target")

    proposal_tags = json.loads(PROPOSAL.read_text())["tags"]
    proposal_ids = {t["id"] for t in proposal_tags}
    unknown_targets = sorted(set(MAP.values()) - proposal_ids)
    if unknown_targets:
        raise SystemExit(f"✗ MAP targets missing from the taxonomy proposal: {unknown_targets}")

    # 1. tags.json becomes the proposal, in its own order, renumbered.
    out = [{"id": t["id"], "label_en": t["label_en"], "label_th": t["label_th"], "sort_order": (i + 1) * 10}
           for i, t in enumerate(proposal_tags)]

    # 2. the cast's ids.
    cast = json.loads(CAST.read_text())
    changed = 0
    for person in cast["profiles"]:
        for key in ("give", "learn"):
            person[key], n = repoint(person[key], f"{person['ref']} {key}")
            changed += n
    used = []
    for person in cast["profiles"]:
        for tag_id in person["give"] + person["learn"]:
            if tag_id not in used:
                used.append(tag_id)
    # Keep the existing order for ids still used, so the list only changes where the ids do.
    cast["tag_slugs"] = ([t for t in cast["tag_slugs"] if t in used]
                         + [t for t in used if t not in cast["tag_slugs"]])
    cast["_note"] = CAST_NOTE

    # 3. the event links.
    links = json.loads(EVENT_TAGS.read_text())
    relinked = 0
    for slug, ids in links["event_tags"].items():
        links["event_tags"][slug], n = repoint(ids, f"event {slug}")
        relinked += n

    # Everything left over must exist in the proposal, or the seed will not load.
    stragglers = set()
    for person in cast["profiles"]:
        stragglers |= {t for t in person["give"] + person["learn"] if t not in proposal_ids}
    for ids in links["event_tags"].values():
        stragglers |= {t for t in ids if t not in proposal_ids}
    if stragglers:
        raise SystemExit(f"✗ ids still outside the merged taxonomy: {sorted(stragglers)}")

    dump(TAGS, {
        "_note": ("Generated from docs/drafts/tag-taxonomy-proposal.json by scripts/seed/migrate-to-"
                  "draft-taxonomy.py; edit tags there, not here. The database's column shape only: "
                  "id, label_en, label_th, sort_order. Regenerate tags.sql with scripts/seed/build_sql.py."),
        "tags": out,
    })
    dump(CAST, cast)
    dump(EVENT_TAGS, links)
    print(f"tags.json  : {len(out)} tags written from the taxonomy proposal")
    print(f"cast       : {changed} tag references repointed")
    print(f"event links: {relinked} tag references repointed")
    print("✓ every id now resolves against the merged taxonomy")


if __name__ == "__main__":
    main()
