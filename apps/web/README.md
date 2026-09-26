# apps/web

The Next.js PWA: every screen, Thai and English strings, and the client for `/v1` and `/ws`. Owner: role 3 (screens).

## Run

```bash
cd apps/web
npm install
npm run dev            # http://localhost:3000, mock backend
```

With `NEXT_PUBLIC_API_BASE` unset, the app runs against an in-browser mock (`src/lib/api/mock.ts`) seeded from Marc's demo profiles. Each browser tab signs in as a different person and realtime frames cross tabs, so the two-window demo works without the API: open one tab as Nok, another as Sam.

Set `NEXT_PUBLIC_API_BASE=https://<DOMAIN>` and `NEXT_PUBLIC_WS_URL=wss://<DOMAIN>/ws` to use the real backend (`src/lib/api/http.ts`). `NEXT_PUBLIC_USE_MOCK=1` forces the mock anyway.

## Layout

| Path | What |
|---|---|
| `src/lib/contract.ts` | Shapes from CONTRACT.md. Moves to `packages/shared` when it exists |
| `src/lib/api/` | One `Api` interface, two implementations (http, mock) |
| `src/i18n/en.ts`, `th.ts` | Every visible string. `th` is typed against `en`, so a missing key fails the build |
| `src/app/(app)/` | Signed-in screens behind the bottom nav: browse, people, events, requests, chats, me |
| `src/app/sign-in`, `src/app/onboarding` | Before the nav |

## Assumptions the backend needs to confirm

These aren't spelled out in CONTRACT.md. The screens rely on them, so tell role 3 if any is wrong.

1. **JSON is camelCase** (`displayName`, `interfaceLanguage`), matching the WebSocket payloads.
2. **`/v1` auth is `Authorization: Bearer <token from /api/ws-token>`**. The Node API can't read the Auth.js cookie, and the contract only specifies the token for `/ws`. `/api/ws-token` returns `{ token, expiresIn }` (seconds).
3. **`GET /v1/me`** returns the profile plus `give: string[]`, `learn: string[]`, `email`. It returns 401 when nobody is signed in.
4. **`GET /v1/browse`** items carry `matchedTags: { tagId, side: "theyGive" | "youGive" }[]`, `sharedEvents: EventSummary[]`, `give`, `learn`, `interestsText`. Paging uses `{ items, nextCursor }`.
5. **`GET /v1/users/:id`** adds `goingEvents` and a `relationship` (`none` | `requestSent` | `requestReceived` | `matched`, with ids). The contract doesn't have `relationship`; the profile button needs it.
6. **Accept and decline** return the updated `MatchRequest`, including `matchId` after an accept. `GET /v1/match-requests` items carry `direction`, `other` (a person summary) and `event`.
7. **`GET /v1/matches`** items are `{ id, other, lastMessage, unreadCount }`.
8. **`GET /v1/events`** items carry `going` and `goingCount` for the caller. `GET /v1/events/:id` adds `attendees`, meaning people from the other community.
9. **`POST /v1/blocks`** takes `{ userId }`. **`POST /v1/reports`** takes `{ userId, reason, matchId? }`. **`POST /v1/notifications/read`** takes `{ ids }` or `{ all: true }`.
10. **Politeness register is asked only of people who write in English.** Thai writers choose their own particles, so they save `politenessRegister: null`.
