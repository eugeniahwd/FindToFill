/**
 * src/lib/chatbot/tools/locationTool.ts
 *
 * get_user_location (docs/AI_TRACK.md §7, tool 1). No model arguments: the server resolved the
 * station from the request before the first model call (resolveLocation), so this only reports it.
 */

import { z } from 'zod';
import { Tool, type LocationOutput, type ToolContext } from './types';

export class LocationTool extends Tool<Record<string, never>> {
  readonly name = 'get_user_location' as const;
  readonly description =
    'Returns the station the passenger is at. Call this first. Takes no arguments.';
  readonly parameters = { type: 'object', properties: {}, additionalProperties: false };
  protected readonly args = z.object({}).transform(() => ({}) as Record<string, never>);

  protected async execute(_args: Record<string, never>, ctx: ToolContext): Promise<LocationOutput> {
    const output: LocationOutput = {
      detected: true,
      source: 'manual',
      station: { id: ctx.station.id, name: ctx.station.name },
      needs_confirmation: false,
      distance_basis: 'station_center',
    };
    ctx.evidence.outputs.location = output;
    return output;
  }
}
