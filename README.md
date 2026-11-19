# FindToFill

> **"Find it. Fill it."**
> A mobile-first web app for KRL Commuter Line passengers (Jabodetabek) to quickly find working water refill dispensers and charging stations inside stations.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router, Strict TypeScript)
- **Styling**: Tailwind CSS (Mobile-first responsive design, Inter font)
- **Icons**: Lucide React
- **Maps**: Leaflet & React-Leaflet with OpenStreetMap tiles
- **Backend**: Next.js Route Handlers + Supabase (PostgreSQL + pgvector, Auth, Storage, RLS)
- **AI chatbot**: Groq API (`groq-sdk`, tool calling)
- **Review embeddings**: Gemini API (`@google/genai`, `gemini-embedding-001`, 768-d). Groq has no embedding models
- **Testing**: Jest & React Testing Library

---

## Getting Started

### Prerequisites

- Node.js **22 or newer** (24 LTS recommended). Supabase's client needs the built-in WebSocket that Node 20 lacks.
- npm / pnpm / yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/eugeniahwd/FindToFill.git
cd FindToFill

# Install dependencies
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in the values from your Supabase project, the Groq console, and Google AI Studio (see **Backend & Database** below). Without them the app still runs, but login and API routes report that the server is not configured.

### Development Server

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser (open DevTools and toggle mobile device toolbar at 390×844 or 360×640).

### Running Tests

```bash
# Run unit and integration tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Type Checking & Linting

```bash
# Lint code
npm run lint

# TypeScript check
npx tsc --noEmit
```

### Backend & Database

Supabase (free plan) provides PostgreSQL + pgvector, Auth, and Storage. Backend code lives in Next.js Route Handlers (`src/app/api`).

| Path | What it is |
| --- | --- |
| `supabase/migrations/` | Schema, `facility_status` view (7-day window), `match_reviews`, `is_admin()`, RLS policies, storage buckets |
| `supabase/seed/*.csv` | Pilot stations, facilities, schedules. Placeholder rows are demo data (`is_demo_data = true`, schedule directions end in `(DEMO)`) |
| `scripts/seed.ts` | Idempotent seed script (`npm run db:seed`) |
| `src/lib/supabase/` | `client.ts` (browser), `server.ts` (route handlers, RLS), `admin.ts` (service role, server-only), `middleware.ts` (session refresh), `database.types.ts` |
| `src/lib/api/errors.ts` | Standard `{ error: { code, message } }` responses |
| `src/lib/auth/` | `requireUser` / `requireAdmin` guards |
| `GET /api/health` | Checks the database is reachable (also wakes a paused free project before a demo) |
| `GET /api/me` | Current user and role, or `{ user: null }` for guests |
| `GET /api/stations` | All stations with center coordinates |
| `GET /api/stations/:id` | One station and its layouts |
| `GET /api/stations/:id/facilities` | Active facilities with current status (7-day window). No distances: the browser adds them with `rankFacilities()` from `src/lib/utils/locator.ts`, so GPS coordinates never reach the server |
| `GET /api/facilities/:id` | One active facility with current status |
| `POST /api/reports` | Live report (multipart: `facilityId`, `status`, `note` ≤ 140, `photo` JPEG/PNG/WebP ≤ 5 MB). Login required, 5 per user per hour, awards the first stamp. Returns `201 { report, stampAwarded }` |
| `GET /api/me/reports` | The signed-in user's 10 latest reports (Profile page) |
| `GET /api/stations/:id/reviews` | Public: non-removed reviews of the station's facilities, newest first (max 50). No author names (profiles are private) |
| `POST /api/reviews` | JSON `{ facilityId, rating 1-5, comment ≤ 500 }`. Login required, 10 per user per hour. One review per user per facility: posting again edits it. The comment is embedded with Gemini (768-d); if that fails the review is saved with a null embedding. Returns `201` (new, may award the first stamp) or `200` (edit) with `{ review, created, stampAwarded }` |
| `GET /api/me/favorites` | The signed-in user's favorite station ids |
| `PUT`, `DELETE /api/me/favorites/:stationId` | Favorite or unfavorite a station (both safe to repeat) |
| `GET /api/me/stamps` | The signed-in user's stamps with each facility's station (Stamp Map) |
| `PATCH /api/admin/facilities/:id`, `PATCH /api/admin/stations/:id` | Admin edits (checked in the API and by RLS) |
| `GET /api/admin/reports?stationId=&status=&limit=` | Admin: recent reports (removed included) with signed photo thumbnails, facility, station, reporter name |
| `GET /api/admin/reviews?stationId=&limit=` | Admin: recent reviews (removed included), never the embedding |
| `DELETE /api/admin/reports/:id`, `DELETE /api/admin/reviews/:id` | Admin **Remove** = soft delete (`removed_at`, `removed_by`); safe to repeat. Removed reports stop counting for the facility status; removed reviews leave public lists and the chatbot search. No restore (SPEC 4.7) |
| `POST /api/admin/stations`, `POST /api/admin/facilities` | Admin adds a station or facility (new rows are not demo data) |
| `GET /api/admin/stations/:id/facilities` | Admin: every facility of a station with its status, **inactive ones included** (listed last), so a switched-off facility can be turned back on. Public routes and the chatbot only see active facilities |
| `GET`, `POST /api/admin/stations/:id/schedules`, `DELETE /api/admin/schedules/:id` | Admin timetable: list (optional `dayType`), add one departure `{ line, direction, dayType, departureTime: "HH:MM" }`, delete one. Bulk changes: `schedules.csv` + `npm run db:seed`. Layout image upload is on hold |
| `src/lib/rate-limit.ts` | Sliding-window limits stored in `rate_limit_events` (reports now, chat later) |
| `src/lib/data/` | Server data access (`stations.ts`, `reviews.ts`, signed photo URLs in `photos.ts`), reusable by the chatbot tools |
| `src/lib/gemini/embeddings.ts` | `embedText(text, 'document' \| 'query')`: 768-d unit vector or `null` (never throws). Also for the `search_reviews` tool |
| `src/lib/groq/client.ts` | `getGroqClient()` (server-only, no retries, 10 s timeout; `null` without a key) and `getChatModel()` for the chatbot |
| `src/lib/data/schedules.ts` | `getNextTrains(db, stationId, { line?, walkTimeMin? })` for `get_next_train`: WIB clock, weekday/weekend timetable, next 2 per line and direction, `timeCheck` (2 × walk + 1 min). `dataAvailable: false` when there is no timetable |
| `searchStationReviews()` in `src/lib/data/reviews.ts` | For `search_reviews`: `match_reviews` with a query vector (`embedQueryCached()` caches the fixed query), falls back to the 5 latest reviews. Comments max 300 chars, URLs removed |
| `src/lib/data/chatLogs.ts` | `logChat(admin, entry)`: writes `chat_logs` with only allowed fields (no coordinates, no review text); never throws. `normalizeSessionId()` |
| `chatRateLimitKey()`, `consumeRateLimit()` in `src/lib/rate-limit.ts` | Chat limit 20/hour: user id when logged in, otherwise an HMAC of the IP (`IP_HASH_SALT`), so raw IPs are never stored |

**Manual setup (once per team):**

1. Create a project at [supabase.com](https://supabase.com) on the **Free** plan (no payment card). Region: Southeast Asia (Singapore).
2. Project Settings → API: copy the URL, the `anon` key, and the `service_role` key into `.env.local`.
3. SQL Editor: run the files in `supabase/migrations/` **in filename order** (`...0001`, `...0002`, `...0003`).
4. Authentication → Sign In / Providers → Email: for the prototype, turn **off** "Confirm email" (otherwise new users must click the email link before logging in).
5. Check the CSV files, then run `npm run db:seed -- --dry-run` (validation only) and `npm run db:seed`.
6. Register an account in the app, then make it admin in the SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'YOUR_EMAIL');
   ```
7. Open `/api/health` and expect `{ "ok": true, "stations": 3 }`.
8. Create a free API key in [Google AI Studio](https://aistudio.google.com/apikey) in the **Default Gemini Project** (Free tier, no billing) and put it in `GEMINI_API_KEY`. It is used only for review embeddings. Without it, reviews still save but have no embedding (the chatbot then falls back to the latest reviews).
9. Create a free API key in the [Groq console](https://console.groq.com/keys) (no payment card) and put it in `GROQ_API_KEY`. It runs the chatbot. Without it, the chatbot answers with the "assistant unavailable" fallback.

10. Put a long random string in `IP_HASH_SALT` (for example the output of `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). It hashes guest IPs for the chat rate limit. Local dev works without it; production requires it.

Restart `npm run dev` after editing `.env.local`. Each teammate should create their own free keys instead of sharing one.

When a migration is added later, run only the new file. Keep `src/lib/supabase/database.types.ts` in sync with the schema.

### Production Build

```bash
npm run build
npm run start
```

---

## Chatbot API (Frontend integration)

`POST /api/chat` with the header `Content-Type: application/json`. The types live in [`src/lib/chatbot/contract.ts`](src/lib/chatbot/contract.ts); import them instead of redefining them. Every status code returns a `ChatResponse` body.

```ts
import type { ChatRequest, ChatResponse } from '@/lib/chatbot/contract';

// selectedStation comes from LocationContext: detected in the browser or picked by the user.
const body: ChatRequest = { quickMessageId, stationId: selectedStation.id, sessionId };

const res = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const data = (await res.json()) as ChatResponse;
```

Request rules (anything else gets `400 rejected`):

- `quickMessageId`: one of `QUICK_MESSAGE_IDS`. Take the button texts from `QUICK_MESSAGES` in [`src/lib/chatbot/quickMessages.ts`](src/lib/chatbot/quickMessages.ts); the server never reads client text.
- `stationId`: the station the app shows, detected in the browser from GPS or picked by the user. GPS coordinates never go to the server: a request with `lat` or `lng` gets a 400. Without `stationId`, the reply asks the user to pick a station.
- `sessionId` (optional): `crypto.randomUUID()`, kept for the browser session.
- No other fields and no `null` values; omit a field instead.

| HTTP | `outcome` | Show |
|---|---|---|
| 200 | `answered` | `message`, then up to 3 `cards`. If `scheduleReminder`, show "Perhatikan papan informasi stasiun untuk jadwal kedatangan KRL terkini." |
| 200 | `fallback_no_data` | `message`. If `needsStationSelection`, open the station picker. |
| 200 | `fallback_ai_unavailable` | `message` and a link to the map |
| 400 | `rejected` | `message`. The request broke a rule above. |
| 429 | `rejected` | `message`. Retry after `retryAfterSec` seconds (also in the `Retry-After` header). |
| 500 | `fallback_ai_unavailable` | `message` and a link to the map |

Each card has `name`, `platform`, `locationDetail`, `distanceM`, `walkTimeMin`, `status` (`unknown` means "No recent report"), and `lastReportedAt` / `minutesAgo`. The server never has the user's position, so `distanceM` is measured from the station center and `distanceIsApproximate` is always true: show it as approximate. `detectedStation.name` is the station the answer is about.

**Pilot stations:** 3, as in the seed data: Manggarai, Sudirman, and Tebet. `docs/SPEC.md` §3 still names 5; SPEC lets the team change the list, and the seed data is the source.

**Which answers you get** depends on `CHATBOT_MODE` (details in [AI module handoff](#ai-module-handoff)). With the defaults (`stub`), only `stationId: "station-manggarai"` has data. With `CHATBOT_MODE=fake`, the three demo pilot stations `station-manggarai`, `station-sudirman`, and `station-tebet` answer. Any other `stationId`, including real database ids before `CHATBOT_DATA=supabase` is wired, gets the no-data fallback with the station picker.

**Rate limit:** 20 requests per hour per client. The key comes from Backend's `chatRateLimitKey()`: the user id when signed in (supabase mode), otherwise an HMAC of the IP with `IP_HASH_SALT`. Production must set `IP_HASH_SALT`; without it every chat request returns 500. With `CHATBOT_DATA=fake` the count is kept in memory per server instance, so restarting `npm run dev` or a Vercel cold start resets it. With `CHATBOT_DATA=supabase` it is stored in `rate_limit_events`.

---

## AI module handoff

The chatbot answers only the 5 quick messages. Every fact (station, facility, status, distance, time) comes from a tool result; the server checks the model's answer and replaces it with a fixed-template answer built from the same data when it fails a check. See [docs/AI_TRACK.md](docs/AI_TRACK.md) for the full design.

### Modes

| `CHATBOT_MODE` | Who answers | Needs |
|---|---|---|
| `stub` (default) | Canned answers from `src/lib/chatbot/stub.ts` | Nothing |
| `fake` | The real orchestrator with a rule-based fake model | Nothing (no network) |
| `live` | The real orchestrator with Groq | `GROQ_API_KEY`, `GROQ_MODEL` |

| `CHATBOT_DATA` | Data, rate limit, logs |
|---|---|
| `fake` (default) | Demo data for the 3 pilot stations, in-memory rate limit, one `[chat]` console line per request |
| `supabase` | Backend's provider, `rate_limit_events`, `chat_logs`. Needs the Supabase keys. Answers `fallback_ai_unavailable` until the provider below is plugged in. |

An unknown value in either variable gives `fallback_ai_unavailable`, never demo data under another name. Logs hold only the question id, outcome, latency, tool names, and (in `chat_logs`) the station id: no coordinates, review text, or keys.

### Plugging in SupabaseDataProvider (Backend)

1. Implement `ChatbotDataProvider` from [`src/lib/chatbot/data/provider.ts`](src/lib/chatbot/data/provider.ts) outside `src/lib/chatbot` (that folder never imports Supabase).
2. Run the shared contract tests against it: call `runProviderContractTests('SupabaseDataProvider', (seed) => ...)` from [`tests/chatbot/provider.contract.ts`](tests/chatbot/provider.contract.ts) in a test file of your own, as [`tests/chatbot/fakeProvider.test.ts`](tests/chatbot/fakeProvider.test.ts) does. The factory gets a `ProviderSeed` and returns a provider over exactly that data.
3. Return it from `createSupabaseProvider()` in [`src/app/api/chat/deps.ts`](src/app/api/chat/deps.ts). Nothing else changes: the rate limiter and the chat logger are already wired for `CHATBOT_DATA=supabase`.

### Evaluation

```bash
npm run eval:chatbot -- --mode fake            # 20 cases, no keys, no network
npm run eval:chatbot -- --mode live --replay   # replays recorded Groq answers, no key needed
npm run eval:chatbot -- --mode live --only nw-manggarai --record   # real Groq, saves answers
```

The cases are in [`docs/eval/sample_questions.json`](docs/eval/sample_questions.json): 3 per quick message plus no report in 7 days, unknown station, no schedule, AI unavailable, and a prompt injection inside a review. The pass bar is at least 18 of 20 and zero invented facts. Live runs spend the free Groq quota (8K tokens per minute, about two cases per minute; a full run uses about 70K of the 200K tokens per day), so keep them small; the script waits and retries on a 429. Results and known gaps: [`docs/eval/README.md`](docs/eval/README.md).
