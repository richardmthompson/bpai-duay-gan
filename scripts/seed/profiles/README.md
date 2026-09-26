# Demo profiles seed

`demo-profiles.json` holds 24 fictional profiles (12 `local`, 12 `foreigner`) for the demo and for ranking tests. Owner: role 5 (Marc). Consumer: whoever writes the seed runner (Shivam, role 1, unless reassigned). There is no runner here yet because `packages/db` didn't exist when this was written.

**Tag slugs are placeholders.** `tag_slugs` lists the 12 slugs used. Reconcile them with Lutz's tag seed (from Richard's `tag-taxonomy.md`) before running. Renaming a slug means a find-and-replace in this file.

## Format

Top level: `_note`, `version`, `tag_slugs`, `event_refs`, `profiles[]`. Each profile:

| field | goes to |
|---|---|
| `email`, `display_name` | Auth.js `users` (`email`, `name`). Create the user first; its id becomes `user_id`. Don't add columns to `users`. |
| `display_name`, `community`, `interface_language`, `speaks_language`, `politeness_register`, `interests_text`, `avatar_url` | `profiles`, same names. Set `onboarding_complete = true`. |
| `give[]` | `profile_tags` rows with `direction = 'give'` |
| `learn[]` | `profile_tags` rows with `direction = 'learn'` |
| `going_event_refs[]` | `event_attendance`. `seed:<slug>` resolves to the event with `source = 'seed'` and `external_id = '<slug>'`. Skip it with a warning if the event is missing. |
| `ref`, `demo_role` | Seed-only labels. Not stored. |

`interests_text` is in the person's own language (`speaks_language`), so the embedding runs on it as-is. Insert profiles in file order so `created_at` tie-breaks are predictable. Better still, set `created_at` explicitly so that within a tie the first in the file ranks first (the tie-break is `created_at` desc).

## Event refs Lutz must seed (`source = 'seed'`)

| external_id | suggested real event |
|---|---|
| `akha-songs-stories` | "Tales My Ancestors Taught Me", Akha songs and stories. Sat 3 Oct 2026, 16:00–17:00, Chiang Mai City Craft Space, 280 Tha Phae Rd. https://culturalcrossroadsasia.org/events/ **The stage pair shares this one.** |
| `sunday-walking-street` | Sunday Walking Street, Tha Phae Gate / Ratchadamnoen (weekly, from about 16:00) |
| `eco-printing-bua-bhat` | Eco printing with artisan Wilai, 28–30 Sep 2026, Bua Bhat Factory, Buak Khang. https://www.airbnb.com.sg/experiences/6258108 |
| `ai-news-meetup` | AI News Community Meetup, Sun 27 Sep 2026, 11:00–12:00, Pa Rang Cafe & Art Stay, Old City. https://createwith.com/event/chiang-mai-ai-news-community-meetup-sep-2026-2 |

If Lutz picks other ids, rename the refs here.

## Demo design

- **Stage pair.** Nok (local, Thai UI, `female`) runs a khao soi shop in Chang Phueak. She gives cooking, street food and scooter, and learns English. Sam (foreigner, English UI, `male`) has been in Chiang Mai four months and teaches English. He learns scooter and street food. That's three complementary matches, and both are going to `seed:akha-songs-stories`. Each ranks first in the other's list.
- **Ranking rule.** Shared events first, then complementary tag matches, then same-side overlap, then newest first. Anyone going to the same event as the viewer ranks above every tag-only match, however many tags overlap.
- **Nok's list** (shared events, then complementary matches): Sam 1 event + 3 tags, then Marco (event only), then a tie of Emma, Lukas and Aisha at 2 tags, then a medium tie of Hana and Olivia at 1, then five people with no overlap (Kenji, Chloé, Dev, Tom, Mei).
- **Sam's list**: Nok 1 event + 3 tags, then Ton (event only), then a tie of Beam, Fah and Lek at 2 tags, then a medium tie of Golf and Pim at 1, then no overlap (Mild, Arm, Kwan, Som, Nam).
- **Edge cases**: Mild is a local who chose an English UI. Kenji is a foreigner who chose a Thai UI and writes in Thai. Kwan and Dev use the `neutral` register.
- Logging in as a demo user depends on role 1's auth choice. Seeded users have no Google account linked; to use one on stage, sign in with Google using the seeded email or change the email here.
