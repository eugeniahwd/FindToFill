/**
 * src/lib/chatbot/tools/locationTool.ts
 *
 * get_user_location (docs/AI_CHATBOT.md tool 1). No model arguments: the server resolved the
 * station from the request (GPS position or stationId) before the first model call, so this only
 * reports it. The result never contains coordinates, only the distance to the station center.
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
    const location = ctx.location;
    const output: LocationOutput = {
      detected: true,
      source: location?.source ?? 'manual',
      station: { id: ctx.station.id, name: ctx.station.name },
      needs_confirmation: location?.needsConfirmation ?? false,
      distance_basis: location?.distanceBasis ?? 'station_center',
    };
    if (location?.distanceToStationM != null) {
      output.distance_to_station_m = location.distanceToStationM;
    }
    ctx.evidence.outputs.location = output;
    return output;
  }
}
