/**
 * src/lib/chatbot/tools/nearestFacilityTool.ts
 *
 * get_nearest_facility (docs/AI_CHATBOT.md tool 2): active facilities of the station, sorted by
 * distance from the user's GPS position (distance_basis user_position) or, without a usable
 * position, from the station center (station_center, approximate).
 */

import { z } from 'zod';
import { MAX_NEAREST_LIMIT } from '../config';
import { distanceMeters, walkMinutes } from '../geo';
import { Tool, type FacilityOutput, type NearestOutput, type ToolContext } from './types';

const DEFAULT_LIMIT = 3;

const args = z.object({
  station_id: z.string(),
  type: z.enum(['water', 'charging', 'any']),
  limit: z.coerce.number().int().min(1).max(MAX_NEAREST_LIMIT).optional(),
});

export class NearestFacilityTool extends Tool<z.infer<typeof args>> {
  readonly name = 'get_nearest_facility' as const;
  readonly description =
    'Lists facilities at the station, nearest first, with distance_m and walk_time_min.';
  readonly parameters = {
    type: 'object',
    properties: {
      station_id: { type: 'string', description: 'The station id from get_user_location.' },
      type: { type: 'string', enum: ['water', 'charging', 'any'] },
      limit: { type: 'integer', minimum: 1, maximum: MAX_NEAREST_LIMIT },
    },
    required: ['station_id', 'type'],
    additionalProperties: false,
  };
  protected readonly args = args;

  protected async execute(
    { station_id, type, limit }: z.infer<typeof args>,
    ctx: ToolContext,
  ): Promise<NearestOutput> {
    this.assertStation(station_id, ctx);
    const origin = ctx.location?.origin ?? ctx.station;
    const rows = await ctx.provider.listFacilities(ctx.station.id, type);
    const facilities: FacilityOutput[] = rows
      .map((row) => {
        const distance_m = distanceMeters(origin, row);
        return {
          facility_id: row.id,
          name: row.name,
          type: row.type,
          platform: row.platform ?? null,
          location_detail: row.locationDetail ?? null,
          level: row.level ?? null,
          distance_m,
          walk_time_min: walkMinutes(distance_m),
        };
      })
      .sort((a, b) => a.distance_m - b.distance_m || a.name.localeCompare(b.name))
      .slice(0, limit ?? DEFAULT_LIMIT);

    const output: NearestOutput = {
      station_id: ctx.station.id,
      type,
      distance_basis: ctx.location?.distanceBasis ?? 'station_center',
      facilities,
    };
    for (const facility of facilities) ctx.evidence.facilities.set(facility.facility_id, facility);
    ctx.evidence.outputs.nearest = output;
    return output;
  }
}
