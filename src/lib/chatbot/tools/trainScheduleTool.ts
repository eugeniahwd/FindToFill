/**
 * src/lib/chatbot/tools/trainScheduleTool.ts
 *
 * get_next_train (docs/AI_TRACK.md §7, tool 4). The provider computes the departures (the
 * Backend's getNextTrains): WIB clock, weekend timetable on Saturday and Sunday, next 2 per line
 * and direction. The time check compares 2 x walk + 1 minute with the soonest departure.
 */

import { z } from 'zod';
import { Tool, type DepartureOutput, type ToolContext, type TrainOutput } from './types';

const args = z.object({
  station_id: z.string(),
  line: z.string().min(1).max(60).optional(),
  walk_time_min: z.coerce.number().int().min(1).max(60).optional(),
});

export class TrainScheduleTool extends Tool<z.infer<typeof args>> {
  readonly name = 'get_next_train' as const;
  readonly description =
    'Next trains at the station. With walk_time_min, also says if there is time to refill.';
  readonly parameters = {
    type: 'object',
    properties: {
      station_id: { type: 'string', description: 'The station id from get_user_location.' },
      line: { type: 'string', description: 'Optional: only this line.' },
      walk_time_min: {
        type: 'integer',
        minimum: 1,
        maximum: 60,
        description: 'walk_time_min of the nearest available water facility.',
      },
    },
    required: ['station_id'],
    additionalProperties: false,
  };
  protected readonly args = args;

  protected async execute(
    { station_id, line, walk_time_min }: z.infer<typeof args>,
    ctx: ToolContext,
  ): Promise<TrainOutput> {
    this.assertStation(station_id, ctx);
    const trains = await ctx.provider.getNextTrains(ctx.station.id, {
      line,
      walkTimeMin: walk_time_min,
    });
    const departures: DepartureOutput[] = trains.departures.map((d) => ({
      line: d.line,
      direction: d.direction,
      minutes_until: d.minutesUntil,
    }));

    const output: TrainOutput = {
      station_id: ctx.station.id,
      data_available: trains.dataAvailable,
      service_ended: trains.serviceEnded,
      departures,
    };
    if (trains.timeCheck && departures[0]) {
      output.time_check = {
        reference_departure: departures[0],
        needed_minutes: trains.timeCheck.neededMinutes,
        enough_time: trains.timeCheck.enoughTime,
        slack_minutes: trains.timeCheck.slackMinutes,
      };
    }
    ctx.evidence.outputs.trains = output;
    return output;
  }
}
