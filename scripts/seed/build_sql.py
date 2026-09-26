"""Checks the seed against one tag taxonomy, then regenerates the derived seed artefacts.

Run after editing any seed JSON:  python3 scripts/seed/build_sql.py

The single upstream tag source is docs/drafts/tag-taxonomy-proposal.json. This script regenerates:
  - tags/tags.sql            from tags/tags.json and tag-id-map.json (the database's tag shape)
  - events/events.sql        from events/events.json and events/event-tags.json
  - reference/tag-taxonomy.md from the taxonomy proposal (tables only; do not edit it by hand)
The SQL files load straight into Postgres (psql -f), for when the admin upsert route isn't up.
They replace rather than add: tags.sql moves selections and event links on retired tag ids to the tag
that tag-id-map.json names, then deletes every selection, event link and tag outside tags.json;
events.sql makes each seeded event's tag links exactly event-tags.json. Loading tags.sql then
events.sql over a database seeded from an older tag list converges on this seed.

Before writing anything it checks that every tag id resolves: tags.json holds exactly the
proposal's ids, and every give/learn id in the 24-person cast and the 100-person roster and every
event -> tag link is in tags.json. Any failure exits non-zero, names the offending id and where it
is used, and writes nothing.
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
PROPOSAL = ROOT / "docs/drafts/tag-taxonomy-proposal.json"
ID_MAP = HERE / "tag-id-map.json"
REFERENCE = ROOT / "reference/tag-taxonomy.md"
EVENT_COLUMNS = ["source", "external_id", "source_url", "title_en", "title_th", "description_en", "description_th",
                 "starts_at", "ends_at", "venue_name", "address", "price_text", "image_url"]

# The reference table's columns are a contract: the deployed tag board parsed cells one to five
# of each row as id, English, Thai, core mark and direction. Keep this order.
REFERENCE_HEADER = "| Tag id | English | Thai | Core | Usual direction |"
DIRECTION = {"local": "Local gives", "foreigner": "Foreigner gives", "either": "Either"}


def q(v):
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def fail(problems):
    sys.exit("✗ seed does not resolve against one taxonomy:\n" + "\n".join(f"  - {p}" for p in problems))


def check_taxonomy(tag_ids, proposal):
    """tags.json must hold exactly the proposal's ids, in both directions."""
    proposal_ids = {t["id"] for t in proposal["tags"]}
    problems = [f"tags.json holds '{t}', which the taxonomy proposal does not" for t in sorted(tag_ids - proposal_ids)]
    problems += [f"the taxonomy proposal holds '{t}', which tags.json does not" for t in sorted(proposal_ids - tag_ids)]
    return problems


def check_id_map(tag_ids, id_map):
    """Every retired id maps to a tag in tags.json or to null, and no live id is retired."""
    problems = [f"tag-id-map.json maps '{old}' to '{new}', which is not in tags.json"
                for old, new in id_map.items() if new is not None and new not in tag_ids]
    problems += [f"tag-id-map.json retires '{old}', which tags.json still holds" for old in id_map if old in tag_ids]
    return problems


def check_profiles(tag_ids, cast_doc, roster):
    """Every give/learn id of every demo person must be in tags.json."""
    problems = []
    for source, people in (("profiles/demo-profiles.json", cast_doc["profiles"]),
                           ("demo-people/profiles.json", roster)):
        for person in people:
            who = f"{person.get('ref') or person.get('id')} ({person['display_name']})"
            for key in ("give", "learn"):
                for tag_id in person[key]:
                    if tag_id not in tag_ids:
                        problems.append(f"{source}: profile {who} has {key} id '{tag_id}', which is not in tags.json")

    used = {t for person in cast_doc["profiles"] for t in person["give"] + person["learn"]}
    slugs = cast_doc["tag_slugs"]
    problems += [f"profiles/demo-profiles.json: tag_slugs names '{t}', which is not in tags.json"
                 for t in slugs if t not in tag_ids]
    if set(slugs) != used or len(slugs) != len(set(slugs)):
        problems.append("profiles/demo-profiles.json: tag_slugs does not list exactly the ids the 24 profiles use")
    return problems


def check_event_tags(tag_ids, events, links):
    ids = {e["external_id"] for e in events}
    problems = [f"event-tags.json names unknown event '{e}'" for e in sorted(set(links) - ids)]
    problems += [f"event-tags.json names an unknown tag: event '{e}' links '{t}', which is not in tags.json"
                 for e, ts in links.items() for t in ts if t not in tag_ids]
    return problems


def render_reference(tag_ids, proposal):
    """Render reference/tag-taxonomy.md from the proposal: one section per category, one row per tag."""
    labels = {c["id"]: c for c in proposal["categories"]}
    groups = {}
    for tag in proposal["tags"]:
        groups.setdefault(tag["category"], []).append(tag)
    problems = [f"the taxonomy proposal has no label for category '{c}'" for c in groups if c not in labels]
    problems += [f"tag '{t['id']}' has a '|' in a label, which would break the table"
                 for t in proposal["tags"] if "|" in t["label_en"] + t["label_th"]]
    problems += [f"tag '{t['id']}' has unknown typical_giver '{t.get('typical_giver')}'"
                 for t in proposal["tags"] if t.get("typical_giver") not in DIRECTION]
    if problems:
        fail(problems)

    lines = ["# Tag Taxonomy", "",
             "<!-- Generated by scripts/seed/build_sql.py from docs/drafts/tag-taxonomy-proposal.json. "
             "Do not edit by hand. -->"]
    for category, tags in groups.items():
        label = labels[category]
        lines += ["", f"## {label['label_en']} · {label['label_th']}", "", REFERENCE_HEADER, "|---|---|---|---|---|"]
        for t in tags:
            core = "✓" if t.get("core") else ""
            lines.append(f"| {t['id']} | {t['label_en']} | {t['label_th']} | {core} | {DIRECTION[t['typical_giver']]} |")

    # The rendered rows must be exactly the tag seed: one row per tag, nothing else.
    row_ids = [line.split("|")[1].strip() for line in lines
               if line.startswith("| ") and line != REFERENCE_HEADER]
    if len(row_ids) != len(set(row_ids)) or set(row_ids) != tag_ids:
        fail(["reference/tag-taxonomy.md rows do not match tags.json one for one"])
    return "\n".join(lines) + "\n"


def tags_sql(rows, id_map):
    values = ",\n".join(f"  ({q(r['id'])}, {q(r['label_en'])}, {q(r['label_th'])}, {r['sort_order']})" for r in rows)
    keep = ",\n".join(f"  ({q(r['id'])})" for r in rows)
    moves = ",\n".join(f"  ({q(old)}, {q(new)})" for old, new in id_map.items())
    return (f"-- Tags seed ({len(rows)}). Idempotent. Generated by build_sql.py from tags.json and tag-id-map.json.\n"
            "-- Replaces the tag vocabulary in one transaction: upsert these tags; move selections and event links\n"
            "-- on retired ids to their mapped tag (a null mapping drops them); then delete every selection, event\n"
            "-- link and tag not in this list. Selections and links go before tags, so no foreign key is violated.\n"
            "begin;\n\n"
            f"insert into tags (id, label_en, label_th, sort_order) values\n{values}\n"
            "on conflict (id) do update set label_en = excluded.label_en, label_th = excluded.label_th, "
            "sort_order = excluded.sort_order;\n\n"
            f"create temporary table seed_tag_ids (id text primary key) on commit drop;\n"
            f"insert into seed_tag_ids (id) values\n{keep};\n\n"
            f"create temporary table retired_tag_map (old_id text primary key, new_id text) on commit drop;\n"
            f"insert into retired_tag_map (old_id, new_id) values\n{moves};\n\n"
            "-- selections and event links remapped onto the merged tag\n"
            "insert into profile_tags (user_id, tag_id, direction)\n"
            "select p.user_id, m.new_id, p.direction from profile_tags p\n"
            "join retired_tag_map m on m.old_id = p.tag_id where m.new_id is not null\n"
            "on conflict do nothing;\n"
            "insert into event_tags (event_id, tag_id)\n"
            "select e.event_id, m.new_id from event_tags e\n"
            "join retired_tag_map m on m.old_id = e.tag_id where m.new_id is not null\n"
            "on conflict do nothing;\n\n"
            "-- everything outside the seed: the remapped originals, null-mapped and unknown ids\n"
            "delete from profile_tags where tag_id not in (select id from seed_tag_ids);\n"
            "delete from event_tags where tag_id not in (select id from seed_tag_ids);\n"
            "delete from tags where id not in (select id from seed_tag_ids);\n\n"
            "commit;\n")


def events_sql(events, links):
    values = ",\n".join("  (" + ", ".join(q(e[c]) for c in EVENT_COLUMNS) + ")" for e in events)
    updates = ",\n  ".join(f"{c} = excluded.{c}" for c in EVENT_COLUMNS if c not in ("source", "external_id"))
    pairs = ",\n".join(f"  ({q(eid)}, {q(t)})" for eid, ts in links.items() for t in ts)
    return (f"-- Events seed ({len(events)}). Generated by build_sql.py from events.json and event-tags.json.\n"
            "-- Idempotent on (source, external_id); needs the contract's unique index on that pair.\n"
            "-- Each seeded event's tag links become exactly event-tags.json: missing links are added, others deleted.\n"
            "-- Load tags/tags.sql first.\n"
            "begin;\n\n"
            f"insert into events ({', '.join(EVENT_COLUMNS)}) values\n{values}\n"
            f"on conflict (source, external_id) where external_id is not null do update set\n  {updates};\n\n"
            "-- event_tags\n"
            f"insert into event_tags (event_id, tag_id)\nselect e.id, v.tag_id from (values\n{pairs}\n) as v(external_id, tag_id)\n"
            "join events e on e.source = 'seed' and e.external_id = v.external_id\non conflict do nothing;\n\n"
            "delete from event_tags t using events e\n"
            "where e.id = t.event_id and e.source = 'seed'\n"
            f"  and (e.external_id, t.tag_id) not in (values\n{pairs}\n);\n\n"
            "commit;\n")


def main():
    rows = json.loads((HERE / "tags/tags.json").read_text())["tags"]
    tag_ids = {r["id"] for r in rows}
    proposal = json.loads(PROPOSAL.read_text())
    cast_doc = json.loads((HERE / "profiles/demo-profiles.json").read_text())
    roster = json.loads((HERE / "demo-people/profiles.json").read_text())
    events = json.loads((HERE / "events/events.json").read_text())["events"]
    links = json.loads((HERE / "events/event-tags.json").read_text())["event_tags"]
    id_map = json.loads(ID_MAP.read_text())["map"]

    problems = (check_taxonomy(tag_ids, proposal) + check_id_map(tag_ids, id_map)
                + check_profiles(tag_ids, cast_doc, roster)
                + check_event_tags(tag_ids, events, links))
    if problems:
        fail(problems)
    reference = render_reference(tag_ids, proposal)

    (HERE / "tags/tags.sql").write_text(tags_sql(rows, id_map))
    (HERE / "events/events.sql").write_text(events_sql(events, links))
    REFERENCE.write_text(reference)
    people = len(cast_doc["profiles"]) + len(roster)
    n_links = sum(len(ts) for ts in links.values())
    print(f"{len(tag_ids)} tags, {len(events)} events, {n_links} event-tag links; "
          f"all ids resolve across {people} people and the event links; reference/tag-taxonomy.md regenerated")


if __name__ == "__main__":
    main()
