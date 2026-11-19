/**
 * src/lib/chatbot/tools/facilityStatusTool.ts
 *
 * get_facility_status (docs/AI_TRACK.md §7, tool 3): current status from the last 7 days, with
 * minutes_ago and a precomputed summary so the model never counts.
 */

import { z } from 'zod';
import { MAX_NEAREST_LIMIT, REPORT_WINDOW_DAYS } from '../config';
import type { FacilityStatus } from '../contract';
import {
  Tool,
  ToolInputError,
  type StatusOutput,
  type StatusOutputRow,
  type ToolContext,
} from './types';

const args = z.object({
  facility_ids: z.array(z.string()).min(1).max(MAX_NEAREST_LIMIT),
});

const STATUSES: FacilityStatus[] = ['available', 'empty', 'broken', 'under_maintenance', 'unknown'];

export class FacilityStatusTool extends Tool<z.infer<typeof args>> {
  readonly name = 'get_facility_status' as const;
  readonly description =
    'Status of facilities from get_nearest_facility: last report time and a summary.';
  readonly parameters = {
    type: 'object',
    properties: {
      facility_ids: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: MAX_NEAREST_LIMIT,
        description: 'facility_id values from get_nearest_facility.',
      },
    },
    required: ['facility_ids'],
    additionalProperties: false,
  };
  protected readonly args = args;

  protected async execute(
    { facility_ids }: z.infer<typeof args>,
    ctx: ToolContext,
  ): Promise<StatusOutput> {
    // Only facilities a tool already returned: the model cannot introduce new ids.
    const known = [...new Set(facility_ids)].filter((id) => ctx.evidence.facilities.has(id));
    if (known.length === 0) {
      throw new ToolInputError('Unknown facility_ids. Call get_nearest_facility first.');
    }

    const rows = new Map(
      (await ctx.provider.getFacilityStatuses(known)).map((row) => [row.facilityId, row]),
    );
    const statuses: StatusOutputRow[] = known.map((id) => {
      const row = rows.get(id);
      const lastReportedAt = row?.lastReportedAt ?? null;
      return {
        facility_id: id,
        status: row?.status ?? 'unknown',
        last_reported_at: lastReportedAt,
        minutes_ago:
          lastReportedAt === null
            ? null
            : Math.max(0, Math.floor((ctx.now.getTime() - Date.parse(lastReportedAt)) / 60_000)),
        active_report_count: row?.activeReportCount ?? 0,
      };
    });

    const summary = { total: statuses.length } as StatusOutput['summary'];
    for (const status of STATUSES) {
      summary[status] = statuses.filter((s) => s.status === status).length;
    }

    const output: StatusOutput = { statuses, summary, report_window_days: REPORT_WINDOW_DAYS };
    for (const status of statuses) ctx.evidence.statuses.set(status.facility_id, status);
    ctx.evidence.outputs.status = output;
    return output;
  }
}
