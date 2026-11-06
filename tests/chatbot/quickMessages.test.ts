import { QUICK_MESSAGE_IDS } from '@/lib/chatbot/contract';
import { getQuickMessage, QUICK_MESSAGES } from '@/lib/chatbot/quickMessages';

describe('quick message allowlist', () => {
  it.each(QUICK_MESSAGE_IDS)('returns the fixed definition for %s', (id) => {
    const definition = getQuickMessage(id);
    expect(definition?.id).toBe(id);
    expect(definition?.text).toBe(QUICK_MESSAGES[id].text);
  });

  it.each(['unknown_id', '', 'constructor', 'toString', '__proto__', 'NEAREST_WATER'])(
    'rejects %p, including keys inherited from Object',
    (id) => {
      expect(getQuickMessage(id)).toBeNull();
    },
  );

  it('allows only the tools listed in docs/AI_TRACK.md §6', () => {
    const facilityTools = ['get_user_location', 'get_nearest_facility', 'get_facility_status'];
    expect(QUICK_MESSAGES.nearest_water.allowedTools).toEqual(facilityTools);
    expect(QUICK_MESSAGES.nearest_charging.allowedTools).toEqual(facilityTools);
    expect(QUICK_MESSAGES.facility_working.allowedTools).toEqual(facilityTools);
    expect(QUICK_MESSAGES.time_to_refill.allowedTools).toEqual([...facilityTools, 'get_next_train']);
    expect(QUICK_MESSAGES.review_summary.allowedTools).toEqual([
      'get_user_location',
      'search_reviews',
    ]);
  });
});
