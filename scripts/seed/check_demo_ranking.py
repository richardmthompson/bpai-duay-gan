#!/usr/bin/env python3
"""Checks the stage pair still ranks first for each other, scoring from the JSON seeds alone.

    python3 scripts/seed/check_demo_ranking.py

The demo opens on Nok and Sam each seeing the other at the top of Browse. This reads
profiles/demo-profiles.json and events/events.json and applies the ranking rule documented in
profiles/README.md — shared events first, then complementary tag matches (tags one gives that the
other learns, either way), then same-side overlap, then file order — over the 24-person cast. It
imports nothing from apps/api or apps/web on purpose: it tests the data, not the ranking code.

Exits non-zero unless Sam is first in Nok's list and Nok first in Sam's, each strictly ahead of
the runner-up on the ranking keys (not by file order alone), with exactly three complementary
matches between them.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
cast = json.loads((HERE / "profiles/demo-profiles.json").read_text())["profiles"]
seeded = {e["external_id"] for e in json.loads((HERE / "events/events.json").read_text())["events"]}
by_ref = {p["ref"]: p for p in cast}


def going(person):
    # The seed runner skips refs to events that are not seeded, so they cannot be shared.
    return {r.removeprefix("seed:") for r in person.get("going_event_refs", [])} & seeded


def complementary(viewer, other):
    return len(set(other["give"]) & set(viewer["learn"])) + len(set(other["learn"]) & set(viewer["give"]))


def keys(viewer, other):
    shared = len(going(viewer) & going(other))
    same_side = len(set(other["give"]) & set(viewer["give"])) + len(set(other["learn"]) & set(viewer["learn"]))
    return shared, complementary(viewer, other), same_side


def ranked(viewer):
    candidates = [(i, p) for i, p in enumerate(cast) if p["community"] != viewer["community"]]
    scored = [(keys(viewer, p), i, p) for i, p in candidates]
    scored.sort(key=lambda s: (-s[0][0], -s[0][1], -s[0][2], s[1]))
    return [(k, p) for k, _, p in scored]


def main():
    nok, sam = by_ref["nok"], by_ref["sam"]
    failures = []
    for viewer, expected in ((nok, sam), (sam, nok)):
        order = ranked(viewer)
        print(f"{viewer['display_name']}'s top five (shared events, complementary, same side):")
        for (shared, comp, same), p in order[:5]:
            print(f"  {p['ref']:<8} {p['display_name']:<10} {shared} {comp} {same}")
        if order[0][1] is not expected:
            failures.append(f"{expected['display_name']} is not first in {viewer['display_name']}'s list")
        elif len(order) > 1 and order[0][0] == order[1][0]:
            failures.append(f"{expected['display_name']} leads {viewer['display_name']}'s list only on file order")

    matches = complementary(nok, sam)
    print(f"Nok and Sam share {matches} complementary tag matches")
    if matches != 3 or complementary(sam, nok) != 3:
        failures.append(f"expected 3 complementary matches between Nok and Sam, found {matches}")
    if failures:
        sys.exit("✗ " + "; ".join(failures))
    print("✓ the stage pair ranks first for each other")


if __name__ == "__main__":
    main()
