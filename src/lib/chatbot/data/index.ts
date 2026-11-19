/**
 * src/lib/chatbot/data/index.ts
 *
 * Builds the fake provider over the demo data. The Supabase provider (Backend) is wired in
 * src/app/api/chat/deps.ts, so this module never imports Supabase.
 */

import { demoSeed, type DemoDataset } from './fakeData';
import { FakeDataProvider } from './fakeProvider';
import type { ChatbotDataProvider } from './provider';

export function createFakeDataProvider(
  dataset: DemoDataset = 'default',
  now: Date = new Date(),
): ChatbotDataProvider {
  return new FakeDataProvider(demoSeed(dataset, now));
}
