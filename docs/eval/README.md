# Chatbot evaluation

`docs/eval/sample_questions.json` holds 20 cases (docs/AI_TRACK.md §15): 3 per quick message, plus no report in 7 days, a station outside the pilot, no schedule, the model unavailable, and a prompt injection inside a review. All cases run on the demo data in `src/lib/chatbot/data/fakeData.ts`, so the right answer is known. The pass bar is at least 18 of 20 with zero invented facts.

A case passes when the outcome, the cards, the required facts, the banned phrases, and the tools called all match. A fact matches when any of its `|` alternatives appears in the message. "Invented facts" counts what the answer checks in `src/lib/chatbot/validation.ts` flag in the final message: a number no tool returned, a facility id no tool returned, a working claim about a facility that is not available, or a refill verdict that contradicts the train check.

## How to run

```bash
npm run eval:chatbot -- --mode fake                 # rule-based fake model, no network
npm run eval:chatbot -- --mode live --replay        # recorded Groq answers, no network, no key
npm run eval:chatbot -- --mode live --record --only nw-manggarai   # real Groq, saves answers
```

Other options: `--limit N`, `--verbose` (print every message), `--cases <file>`, `--env-dir <folder with .env.local>`, `--wait-sec 60` (wait after a Groq 429, up to 3 attempts per case). The exit code is 0 when the target is met.

`recordings/` holds every Groq response from the live runs, keyed by a hash of the request. Record mode reuses a saved response when the same request comes again, and calls Groq only for new ones. A change to the system prompt, the tools, or the demo data changes every request, so all cases must be recorded again. A full run costs about 70K of the 200K tokens Groq allows per day on the free tier, and takes 10 to 15 minutes because of the 8K tokens per minute limit.

## Results (2026-11-19, `openai/gpt-oss-20b` on the Groq free tier)

| Run | Passed | Invented facts | Written by the model | Latency p50 / p90 |
|---|---|---|---|---|
| fake | 20/20 | 0 | (the fake model writes the template) | about 1 ms |
| live, first 6 cases, before the fixes below | 4/6 | 0 | 4/6 | 2.2 s / 6.8 s |
| live, all 20 cases, full run | 14/20 | 0 counted, 1 missed (see below) | 18/18 | 1.7 s / 2.8 s |
| live replay of the final recordings, with the fixes | 20/20 | 0 | 15/18 | (replay, not a latency measurement) |

Latency is the time `handleChat` takes, measured in the live runs. The two fallback cases do not call the model and are counted with about 0 ms. `time_to_refill` needs one model call more than the other questions and took 2.4 to 4.9 s, so it is above the 3-second target on its own.

## What the live runs found, and what changed

1. **gpt-oss sometimes sent its final JSON as a call to a tool named `json`.** Groq rejects that with 400 `tool_use_failed`, and the chatbot fell back to the template. Now the server runs `get_user_location` itself before the first model call, and once the evidence for the question is complete, the answer is requested in a call without tools and with the strict JSON schema. That fixed the error and cut one round trip: p90 was 6.8 s over the first 6 cases before the change, and 2.8 s over all 20 cases after it.
2. **The model gave a wrong refill verdict.** At 08:08 (train in 2 minutes, 3 needed) it answered "Anda dapat mengisi air sebelum kereta berikutnya". It happened in two separate runs. The checks did not catch it then, so the full run's "0 invented facts" missed it. Now `time_to_refill` answers must state the same verdict as `time_check.enough_time`, or say that the schedule is missing. Otherwise the deterministic answer is used. This replaced 3 of the 4 `time_to_refill`-type answers in the final recordings. A train check that the model requested with a wrong walk time is not trusted either.
3. **A facility answer without cards.** In the no-reports case the model chose no facility ids. Such an answer now gets the cards the deterministic answer would show.
4. **Review answers said "Laporan terakhir dibuat 0 hari yang lalu".** Prompt rule 8 (report times) now covers facility statuses only. A new rule 13 covers reviews.
5. **Scorer changes after the first full run.** gpt-oss writes non-breaking spaces ("2 menit") and non-breaking hyphens ("rata-rata"), so the scorer normalizes them. Two expectations were loosened to accept correct wording: `fw-tebet` accepts "Water Station" (the only one at Tebet is the available Platform 2 dispenser), and `tr-manggarai-enough` accepts "bisa isi" or "dapat mengisi". `facility_working` facts accept either the count or the names of the available facilities.

## Known gaps

- The model often leaves out the station name, "perkiraan" for distances, or the report time (prompt rules 6 and 8). The answer checks do not enforce these. The cards always show the distance as approximate and show the report time.
- `time_to_refill` is above 3 seconds, and its verdict often has to be replaced. A clearer prompt rule 9 ("enough_time true means masih sempat, false means waktunya tidak cukup") would likely help. It was not tried because it requires recording all 20 cases again.
- Results come from the demo data. Rerun the eval once `CHATBOT_DATA=supabase` has real data, with new expected facts.
