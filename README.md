# FindToFill

> **"Find it. Fill it."**
> A mobile-first web app for KRL Commuter Line passengers (Jabodetabek) to quickly find working water refill dispensers and charging stations inside stations.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router, Strict TypeScript)
- **Styling**: Tailwind CSS (Mobile-first responsive design, Inter font)
- **Icons**: Lucide React
- **Maps**: Leaflet & React-Leaflet with OpenStreetMap tiles
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

Fill in the values from your Supabase project and Google AI Studio (see **Backend & Database** below). Without them the app still runs, but login and API routes report that the server is not configured.

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

When a migration is added later, run only the new file. Keep `src/lib/supabase/database.types.ts` in sync with the schema.

### Production Build

```bash
npm run build
npm run start
```
