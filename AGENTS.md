# AGENTS.md: FindToFill

## Project
FindToFill is a mobile-first web app for KRL Commuter Line passengers (Jabodetabek). It shows water refill dispensers and charging stations inside KRL stations with distance in meters, live status reported by passengers (photo required), station layouts, water reviews, favorites, stamps, and an AI quick-message chatbot. It is a 3-person university prototype. Specs live in /docs. Read the relevant spec before working on a feature:
- docs/SPEC.md (features, business rules, defaults)
- docs/DATA_MODEL.md (tables, view, RLS, storage)
- docs/AI_CHATBOT.md (quick messages, 5 tools, orchestration, guardrails, evaluation)
- docs/UI_SPEC.md (design tokens, pages, states)
- docs/BUILD_PLAN.md (sprints and definitions of done)

## Hard constraints
1. Budget under IDR 100,000: free plans only. Never add a paid service, never ask for or use a payment card. If something needs billing, stop and tell me.
2. Scope: build only what docs/SPEC.md lists. Do not add features (see "Out of scope").
3. The stack is fixed. Do not swap or add frameworks or major libraries without asking.
4. Secrets: never commit or print keys. Use .env.local and keep .env.example updated. SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY are server-only, never NEXT_PUBLIC_.
5. The chatbot must never invent a station, facility, status, distance, or time. Facts come only from tool results.
6. Do not create cloud accounts, projects, or API keys yourself. List the manual steps for me and wait.
7. Ask before destructive actions (dropping tables, force pushes, deleting files outside the task) and before anything that runs against a remote database.

## Stack (fixed)
- Next.js (App Router) + TypeScript (strict) + Tailwind CSS, deployed on Vercel Hobby
- Backend: Next.js Route Handlers in src/app/api (no separate Express server)
- Supabase free plan: PostgreSQL + pgvector, Auth (email and password), Storage, Row Level Security on every table
- Map: Leaflet (react-leaflet) with OpenStreetMap tiles, client-only (dynamic import, ssr false). No Google Maps.
- AI: Gemini API via the official @google/genai SDK (function calling and embeddings). Model IDs come from env vars GEMINI_MODEL and GEMINI_EMBEDDING_MODEL. Check current Google docs for model names and the embedding dimension before coding.
- Validation: zod on every API input. Unit tests: Jest. Icons: lucide-react.

## Repo layout
src/app (pages, api), src/components, src/lib (supabase, gemini, geo, rate-limit, config), src/lib/chatbot (quickMessages, tools, orchestrator, prompts), supabase/migrations, supabase/seed, tests, docs.

## Coding conventions
- TypeScript strict, no any, small functions, named exports.
- Server-only modules start with import 'server-only'. Never import the service role client in client components.
- API errors return { error: { code, message } } with the right HTTP status. Never leak stack traces.
- Put constants in src/lib/config.ts: walking speed, station detection radius, 7-day window, rate limits, KAI contact number.
- No cron jobs. The 7-day report window is a query filter.
- Never store GPS coordinates. Resolve them to a station id and discard them.
- Never log personal data, coordinates, review text, or keys.

## UI rules
- Mobile-first (360 px), touch targets at least 44 px, bottom navigation on mobile.
- Follow the tokens in docs/UI_SPEC.md. A status is always shown with color, text label, and icon together.
- Only the four reportable statuses plus a neutral "No recent report" state exist.

## Workflow for every task
1. Read this file and the relevant doc. Write a short plan (files to touch, risks) before coding.
2. Work in small steps. After each step run lint, type check, and tests, and fix failures.
3. Never call a task done without evidence (test output, or a manual check you describe).
4. End each task with: what changed, how to run or verify it, manual steps for me, open questions.
5. If a spec is ambiguous or conflicts with another, ask in at most 3 short questions and state your default.
6. Do not edit files in /docs unless I ask. Propose changes instead.

## Out of scope (do not build)
Native app, free-text chat input, push notifications, integration with KAI systems, stations outside the pilot, QR scanning, points or levels, water quality lab data, voice notes, technician dispatch, batch moderation, an approve queue.
