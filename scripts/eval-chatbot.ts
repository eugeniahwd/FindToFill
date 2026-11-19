/**
 * scripts/eval-chatbot.ts
 *
 * Runs docs/eval/sample_questions.json through the real orchestrator (docs/AI_TRACK.md §15).
 *
 *   npm run eval:chatbot -- --mode fake|live [--limit N] [--only id,id] [--record] [--replay]
 *                           [--verbose] [--wait-sec 60] [--env-dir <folder with .env.local>]
 *                           [--cases <file>]
 *
 * fake: FakeLLMClient (policy), no keys, no network.
 * live: Groq with GROQ_API_KEY and GROQ_MODEL from .env.local. --record saves every model
 *       response to docs/eval/recordings; --replay answers from those files without the network.
 * Data is always the demo FakeDataProvider, so expected facts are known. Pass = at least 18 of
 * 20 cases and zero invented facts. Never prints keys.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvConfig } from '@next/env';
import Groq from 'groq-sdk';
import { z } from 'zod';
import { APP_CONFIG } from '../src/lib/config';
import { fixedClock } from '../src/lib/chatbot/clock';
import { QUICK_MESSAGE_IDS, type ChatResponse } from '../src/lib/chatbot/contract';
import { createFakeDataProvider } from '../src/lib/chatbot/data';
import { DEMO_DATASETS } from '../src/lib/chatbot/data/fakeData';
import { FakeLLMClient } from '../src/lib/chatbot/llm/fakeLlmClient';
import { GroqLLMClient } from '../src/lib/chatbot/llm/groqClient';
import { RecordReplayLLMClient } from '../src/lib/chatbot/llm/recordReplay';
import { LLMError, type LLMClient, type LLMRequest, type LLMResponse } from '../src/lib/chatbot/llm/types';
import { InMemoryChatLogger } from '../src/lib/chatbot/logger';
import { handleChat } from '../src/lib/chatbot/orchestrator';
import { InMemoryRateLimiter } from '../src/lib/chatbot/rateLimit';
import type { Evidence } from '../src/lib/chatbot/tools/types';
import { checkAnswer, type AnswerProblem } from '../src/lib/chatbot/validation';

const ROOT = join(__dirname, '..');
const CASES_FILE = join(ROOT, 'docs', 'eval', 'sample_questions.json');
const RECORDINGS = join(ROOT, 'docs', 'eval', 'recordings');
/** 18 of 20; a smaller run (--limit, --only) needs the same share, rounded up. */
const PASS_RATE = 18 / 20;
const MAX_ATTEMPTS = 3;
/** Problems that mean the message states something no tool returned. */
const INVENTED: readonly AnswerProblem[] = ['ungrounded_number', 'unknown_facility_id', 'status_claim'];

const CaseSchema = z
  .object({
    id: z.string().min(1),
    quickMessageId: z.enum(QUICK_MESSAGE_IDS),
    context: z.object({ stationId: z.string().optional(), now: z.iso.datetime().optional() }).strict(),
    dataset: z.enum(DEMO_DATASETS),
    simulate: z.literal('model_rate_limited').optional(),
    expected: z
      .object({
        outcome: z.enum(['answered', 'fallback_no_data', 'fallback_ai_unavailable', 'rejected']),
        mustIncludeFacilityIds: z.array(z.string()),
        mustIncludeFacts: z.array(z.string()),
        mustNotInclude: z.array(z.string()),
        toolsMustInclude: z.array(z.string()),
      })
      .strict(),
  })
  .strict();
const FileSchema = z.object({
  about: z.string(),
  defaultNow: z.iso.datetime(),
  cases: z.array(CaseSchema),
});
type EvalCase = z.infer<typeof CaseSchema>;

interface Options {
  mode: 'fake' | 'live';
  limit: number | null;
  only: string[] | null;
  record: boolean;
  replay: boolean;
  verbose: boolean;
  waitSec: number;
  envDir: string;
  casesFile: string;
}

interface CaseResult {
  id: string;
  pass: boolean;
  reasons: string[];
  invented: number;
  latencyMs: number;
  response: ChatResponse;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    mode: 'fake',
    limit: null,
    only: null,
    record: false,
    replay: false,
    verbose: false,
    waitSec: 60,
    envDir: process.cwd(),
    casesFile: CASES_FILE,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = (): string => {
      const next = argv[++i];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      return next;
    };
    if (arg === '--mode') {
      const mode = value();
      if (mode !== 'fake' && mode !== 'live') throw new Error('--mode must be fake or live');
      options.mode = mode;
    } else if (arg === '--limit') options.limit = Number(value());
    else if (arg === '--only') options.only = value().split(',');
    else if (arg === '--record') options.record = true;
    else if (arg === '--replay') options.replay = true;
    else if (arg === '--verbose') options.verbose = true;
    else if (arg === '--wait-sec') options.waitSec = Number(value());
    else if (arg === '--env-dir') options.envDir = value();
    else if (arg === '--cases') options.casesFile = value();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.record && options.replay) throw new Error('Use --record or --replay, not both.');
  if ((options.record || options.replay) && options.mode !== 'live') {
    throw new Error('--record and --replay need --mode live.');
  }
  return options;
}

/** Notes whether Groq answered 429, so the eval (and only the eval) can wait and retry. */
class QuotaWatch implements LLMClient {
  rateLimited = false;
  constructor(private readonly inner: LLMClient) {}

  async generate(request: LLMRequest): Promise<LLMResponse> {
    try {
      return await this.inner.generate(request);
    } catch (err) {
      if (err instanceof LLMError && err.status === 429) this.rateLimited = true;
      throw err;
    }
  }
}

function liveModel(options: Options): LLMClient {
  if (options.replay) return new RecordReplayLLMClient('replay', RECORDINGS);
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL;
  if (!apiKey || !model) {
    throw new Error('Live mode needs GROQ_API_KEY and GROQ_MODEL in .env.local (see --env-dir).');
  }
  const groq = new Groq({ apiKey, maxRetries: 0, timeout: APP_CONFIG.CHAT_TIMEOUT_MS });
  const client = new GroqLLMClient(groq, { model });
  return options.record ? new RecordReplayLLMClient('record', RECORDINGS, client) : client;
}

async function runCase(testCase: EvalCase, defaultNow: string, model: () => LLMClient) {
  const now = new Date(testCase.context.now ?? defaultNow);
  const watch = new QuotaWatch(
    testCase.simulate === 'model_rate_limited'
      ? new FakeLLMClient({ mode: 'adversarial', attack: 'rate_limited' })
      : model(),
  );
  const body = {
    quickMessageId: testCase.quickMessageId,
    ...(testCase.context.stationId ? { stationId: testCase.context.stationId } : {}),
  };
  const startedAt = performance.now();
  const { response, evidence } = await handleChat(body, {
    answer: 'agent',
    provider: createFakeDataProvider(testCase.dataset, now),
    llm: watch,
    rateLimiter: new InMemoryRateLimiter(),
    logger: new InMemoryChatLogger(),
    clock: fixedClock(now),
    identity: 'eval',
  });
  const latencyMs = performance.now() - startedAt;
  const quotaHit = watch.rateLimited && testCase.simulate === undefined;
  return { response, evidence, latencyMs, quotaHit };
}

function includesAny(message: string, fact: string): boolean {
  const text = message.toLowerCase();
  return fact.split('|').some((alternative) => text.includes(alternative.toLowerCase()));
}

function score(
  testCase: EvalCase,
  response: ChatResponse,
  evidence: Evidence | undefined,
): { reasons: string[]; invented: number } {
  const { expected } = testCase;
  const reasons: string[] = [];
  if (response.outcome !== expected.outcome) {
    reasons.push(`outcome ${response.outcome}, expected ${expected.outcome}`);
  }
  const cardIds = response.cards.map((card) => card.facilityId);
  for (const id of expected.mustIncludeFacilityIds) {
    if (!cardIds.includes(id)) reasons.push(`card ${id} missing`);
  }
  for (const fact of expected.mustIncludeFacts) {
    if (!includesAny(response.message, fact)) reasons.push(`fact "${fact}" missing`);
  }
  for (const banned of expected.mustNotInclude) {
    if (response.message.toLowerCase().includes(banned.toLowerCase())) {
      reasons.push(`says "${banned}"`);
    }
  }
  const tools: readonly string[] = evidence?.toolsCalled ?? [];
  for (const tool of expected.toolsMustInclude) {
    if (!tools.includes(tool)) reasons.push(`tool ${tool} not called`);
  }

  let invented = 0;
  if (response.outcome === 'answered' && evidence) {
    const check = checkAnswer(
      { message: response.message, facilityIds: cardIds },
      testCase.quickMessageId,
      evidence,
    );
    const problems = check.problems.filter((problem) => INVENTED.includes(problem));
    const unknownCards = cardIds.filter((id) => !evidence.facilities.has(id));
    invented = problems.length + unknownCards.length;
    if (problems.length > 0) reasons.push(`invented: ${problems.join(', ')}`);
    if (unknownCards.length > 0) reasons.push(`card not from a tool: ${unknownCards.join(', ')}`);
  }
  return { reasons, invented };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  // Quiet loader: Next prints the env file names; the values are never printed.
  if (options.mode === 'live' && !options.replay) {
    loadEnvConfig(options.envDir, true, { info: () => undefined, error: () => undefined });
  }

  const file = FileSchema.parse(JSON.parse(readFileSync(options.casesFile, 'utf8')));
  let cases = file.cases;
  if (options.only) cases = cases.filter((testCase) => options.only?.includes(testCase.id));
  if (options.limit !== null) cases = cases.slice(0, options.limit);

  const model =
    options.mode === 'fake'
      ? () => new FakeLLMClient({ mode: 'policy' })
      : (() => {
          const live = liveModel(options);
          return () => live;
        })();
  const flag = options.record ? ' (record)' : options.replay ? ' (replay)' : '';
  console.log(`FindToFill chatbot eval: mode=${options.mode}${flag}, ${cases.length} cases, demo data`);

  const results: CaseResult[] = [];
  for (const testCase of cases) {
    let run = await runCase(testCase, file.defaultNow, model);
    for (let attempt = 2; run.quotaHit && attempt <= MAX_ATTEMPTS; attempt++) {
      console.log(`  ${testCase.id}: Groq quota (429), waiting ${options.waitSec} s (attempt ${attempt})`);
      await pause(options.waitSec * 1000);
      run = await runCase(testCase, file.defaultNow, model);
    }
    const { reasons, invented } = score(testCase, run.response, run.evidence);
    if (run.quotaHit) reasons.push('Groq quota (429) on every attempt');
    const result: CaseResult = {
      id: testCase.id,
      pass: reasons.length === 0,
      reasons,
      invented,
      latencyMs: run.latencyMs,
      response: run.response,
    };
    results.push(result);

    const columns = [
      result.pass ? 'PASS' : 'FAIL',
      testCase.id.padEnd(26),
      run.response.outcome.padEnd(24),
      `${Math.round(result.latencyMs)} ms`.padStart(8),
    ];
    const line = columns.join(' ');
    console.log(result.pass ? line : `${line}  ${reasons.join('; ')}`);
    if (options.verbose || !result.pass) console.log(`     "${run.response.message}"`);
  }

  const passed = results.filter((result) => result.pass).length;
  const invented = results.reduce((sum, result) => sum + result.invented, 0);
  const latencies = results.map((result) => result.latencyMs);
  const p50 = Math.round(percentile(latencies, 0.5));
  const p90 = Math.round(percentile(latencies, 0.9));
  const needed = Math.ceil(PASS_RATE * results.length);
  const met = passed >= needed && invented === 0;
  console.log('');
  console.log(`Total: ${passed}/${results.length} passed. Invented facts: ${invented}.`);
  console.log(`Latency: p50 ${p50} ms, p90 ${p90} ms.`);
  console.log(
    `Target (at least ${needed} of ${results.length} and 0 invented facts): ${met ? 'MET' : 'NOT MET'}`,
  );
  process.exitCode = met ? 0 : 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : 'Eval failed.');
  process.exitCode = 1;
});
