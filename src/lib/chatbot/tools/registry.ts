/**
 * src/lib/chatbot/tools/registry.ts
 *
 * The five tools by name, and the declarations the model may see for one quick message.
 */

import type { ChatbotToolName } from '../quickMessages';
import { FacilityStatusTool } from './facilityStatusTool';
import { LocationTool } from './locationTool';
import { NearestFacilityTool } from './nearestFacilityTool';
import { ReviewSearchTool } from './reviewSearchTool';
import { TrainScheduleTool } from './trainScheduleTool';
import type { Tool } from './types';

export interface ToolDeclaration {
  name: ChatbotToolName;
  description: string;
  parameters: Record<string, unknown>;
}

const TOOLS: Readonly<Record<ChatbotToolName, Tool<unknown>>> = {
  get_user_location: new LocationTool(),
  get_nearest_facility: new NearestFacilityTool(),
  get_facility_status: new FacilityStatusTool(),
  get_next_train: new TrainScheduleTool(),
  search_reviews: new ReviewSearchTool(),
};

/** The tool with this name, or null. Own keys only: "constructor" is not a tool. */
export function getTool(name: string): Tool<unknown> | null {
  return Object.prototype.hasOwnProperty.call(TOOLS, name)
    ? TOOLS[name as ChatbotToolName]
    : null;
}

export function toolDeclarations(names: readonly ChatbotToolName[]): ToolDeclaration[] {
  return names.map((name) => {
    const tool = TOOLS[name];
    return { name, description: tool.description, parameters: tool.parameters };
  });
}
