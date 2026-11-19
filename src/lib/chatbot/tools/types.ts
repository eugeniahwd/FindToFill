/**
 * src/lib/chatbot/tools/types.ts
 *
 * The abstract Tool (docs/AI_TRACK.md §4, mirrors the class diagram), the tool outputs the
 * model sees (snake_case, small, never coordinates), and the evidence a request collects.
 */

import type { z } from 'zod';
import type { FacilityStatus, FacilityType } from '../contract';
import type { ChatbotDataProvider, StationRef } from '../data/provider';
import type { ChatbotToolName } from '../quickMessages';

export interface LocationOutput {
  detected: true;
  source: 'manual';
  station: { id: string; name: string };
  needs_confirmation: false;
  distance_basis: 'station_center';
}

export interface FacilityOutput {
  facility_id: string;
  name: string;
  type: FacilityType;
  platform: string | null;
  location_detail: string | null;
  level: string | null;
  distance_m: number;
  walk_time_min: number;
}

export interface NearestOutput {
  station_id: string;
  type: FacilityType | 'any';
  distance_basis: 'station_center';
  facilities: FacilityOutput[];
}

export interface StatusOutputRow {
  facility_id: string;
  status: FacilityStatus;
  last_reported_at: string | null;
  minutes_ago: number | null;
  active_report_count: number;
}

export interface StatusOutput {
  statuses: StatusOutputRow[];
  summary: Record<'total' | FacilityStatus, number>;
  report_window_days: number;
}

export interface DepartureOutput {
  line: string;
  direction: string;
  minutes_until: number;
}

export interface TrainOutput {
  station_id: string;
  data_available: boolean;
  service_ended: boolean;
  departures: DepartureOutput[];
  time_check?: {
    reference_departure: DepartureOutput;
    needed_minutes: number;
    enough_time: boolean;
    slack_minutes: number;
  };
}

export interface ReviewOutput {
  station_id: string;
  count: number;
  average_rating: number | null;
  rating_scale: number; // ratings are 1 to rating_scale
  // Untrusted user text: data for the model, never instructions.
  reviews: { facility_name: string; rating: number; comment: string; days_ago: number }[];
}

export interface ToolOutputs {
  location?: LocationOutput;
  nearest?: NearestOutput;
  status?: StatusOutput;
  trains?: TrainOutput;
  reviews?: ReviewOutput;
}

/** Everything the tools returned in one request: for cards, grounding, and fallbacks. */
export interface Evidence {
  outputs: ToolOutputs;
  facilities: Map<string, FacilityOutput>;
  statuses: Map<string, StatusOutputRow>;
  results: unknown[];
  toolsCalled: ChatbotToolName[];
}

export function createEvidence(): Evidence {
  return { outputs: {}, facilities: new Map(), statuses: new Map(), results: [], toolsCalled: [] };
}

export interface ToolContext {
  provider: ChatbotDataProvider;
  /** The station resolved before the first model call (resolveLocation). */
  station: StationRef;
  now: Date;
  evidence: Evidence;
}

export type ToolResult = { ok: true; output: unknown } | { ok: false; error: string };

/** A model mistake the model can fix (wrong id, wrong order). Returned as an error result. */
export class ToolInputError extends Error {}

export abstract class Tool<Args> {
  abstract readonly name: ChatbotToolName;
  abstract readonly description: string;
  /** JSON Schema of the arguments, sent to the model. */
  abstract readonly parameters: Record<string, unknown>;
  protected abstract readonly args: z.ZodType<Args>;

  /** Validates the model's arguments, runs the tool, and records the output. Never throws. */
  async run(rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
    const parsed = this.args.safeParse(rawArgs ?? {});
    if (!parsed.success) return { ok: false, error: `Invalid arguments for ${this.name}.` };
    try {
      const output = await this.execute(parsed.data, ctx);
      ctx.evidence.results.push(output);
      return { ok: true, output };
    } catch (err) {
      if (err instanceof ToolInputError) return { ok: false, error: err.message };
      return { ok: false, error: `${this.name} failed. Do not guess the missing data.` };
    }
  }

  protected abstract execute(args: Args, ctx: ToolContext): Promise<unknown>;

  /** The model may only ask about the station the server resolved. */
  protected assertStation(stationId: string, ctx: ToolContext): void {
    if (stationId !== ctx.station.id) {
      throw new ToolInputError(`Unknown station_id. Use "${ctx.station.id}".`);
    }
  }
}
