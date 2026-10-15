# Build Plan (one sprint = one agent task)

General Definition of Done for every sprint: lint, type check, and tests pass; the manual check is described; README updated; no secrets committed; changes summarized with manual steps for me.

## Sprint 0: Setup
Scaffold Next.js (TypeScript, Tailwind, App Router, src dir), ESLint, Prettier, Jest, folder layout, src/lib/config.ts, .env.example, Supabase client helpers (browser, server, service role), README with MANUAL STEPS for me (create Supabase project, copy keys, create Gemini API key in Google AI Studio, create Vercel project).

## Sprint 1: Database and Auth (TC-01, TC-02)
Migrations for all tables, view, match_reviews, is_admin, profile trigger, RLS policies, storage buckets. Seed CSV templates and seed script with demo data. Login, Register, Guest flow. Tests for RLS-relevant logic and role protection.

## Sprint 2: Locator (TC-03, TC-04)
geo.ts (haversine, walk time), station detection, nearest facilities API, Home page with Leaflet map, filter chips, manual station picker, StatusBadge and FacilityCard. Unit tests for geo and detection radius.

## Sprint 3: Live Report (TC-05, TC-06, TC-07, TC-17)
Report form, canvas photo compression, server upload route with validation, rate limiting helper, report insert, facility_status integration, View photo via signed URL, stamp on first report. Tests for the 7-day rule, required photo, and rate limit.

## Sprint 4: Reviews, Favorites, Stamps, Layout (TC-08, TC-09)
Review upsert with embedding, favorites toggle, stamp on first review, Community page (Reviews, Favorites, Stamp Map), Station Layout view with level tabs and markers from layout_x and layout_y.

## Sprint 5: Chatbot (TC-10 to TC-14)
Quick messages, five tools as classes, orchestrator loop, system prompt, Gemini client, structured final output, validation, answer card, fallbacks, chat logs, eval script and sample_questions.json. Show the eval result.

## Sprint 6: Admin, Hardening, Deploy (TC-15, TC-16 and regression)
Admin page (reports, reviews, stations), soft delete, admin-only checks in UI, API, and RLS. Security review of RLS and secrets, Lighthouse check on mobile, error states, deploy to Vercel Hobby, final README.
