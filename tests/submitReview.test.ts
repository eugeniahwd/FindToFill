/**
 * @jest-environment node
 */
import { listStationReviews, submitReview } from '@/lib/data/reviews';
import type { ReviewRow } from '@/lib/data/mappers';
import { fakeSupabase, type FakeResult } from './helpers/fakeSupabase';

const USER = '11111111-1111-4111-8111-111111111111';
const FACILITY = '22222222-2222-4222-8222-222222222222';
const STATION = '33333333-3333-4333-8333-333333333333';
const input = { facilityId: FACILITY, rating: 4, comment: 'Airnya dingin dan bersih' };

function reviewRow(over: Partial<ReviewRow> = {}): ReviewRow {
  return {
    id: 'rev-1', facility_id: FACILITY, user_id: USER, rating: 4, comment: input.comment,
    created_at: '2026-11-05T08:00:00Z', updated_at: '2026-11-05T08:00:00Z', removed_at: null, removed_by: null,
    ...over,
  };
}

// The user session only reads the facility. Clients have no insert or update on reviews
// (RLS), so the lookup, insert, and update use the service role.
function setup(over: Partial<Record<string, () => FakeResult>> = {}, vector: number[] | null = [0.6, 0.8]) {
  const db = fakeSupabase({
    'facilities.select': () => ({ data: { id: FACILITY, name: 'Water Station Concourse L2' } }),
    ...over,
  });
  const admin = fakeSupabase({
    'rate_limit_events.select': () => ({ count: 0 }),
    'rate_limit_events.insert': () => ({}),
    'stamps.upsert': () => ({ data: [{ user_id: USER }] }),
    'reviews.select': () => ({ data: null }),
    'reviews.insert': () => ({ data: reviewRow() }),
    'reviews.update': () => ({ data: reviewRow({ rating: 2 }) }),
    ...over,
  });
  const embed = jest.fn(async () => vector);
  return { db, admin, embed, deps: { db: db.client, admin: admin.client, embed } };
}

const existingReview = { 'reviews.select': () => ({ data: { id: 'rev-1', removed_at: null } }) };

describe('submitReview', () => {
  it('creates the first review with its embedding and awards the stamp', async () => {
    const { admin, embed, deps } = setup();
    const result = await submitReview(deps, { userId: USER, input });

    expect(embed).toHaveBeenCalledWith(input.comment, 'document');
    expect(admin.find('reviews.insert')[0].payload).toEqual({
      facility_id: FACILITY, user_id: USER, rating: 4, comment: input.comment, embedding: '[0.6,0.8]',
    });
    expect(admin.find('stamps.upsert')).toHaveLength(1);
    expect(admin.find('rate_limit_events.insert')[0].payload).toEqual({ key: USER, action: 'review' });
    expect(result).toMatchObject({ created: true, stampAwarded: true });
    expect(result.review).toMatchObject({ id: 'rev-1', facilityName: 'Water Station Concourse L2', rating: 4 });
    expect(result.review).not.toHaveProperty('embedding');
  });

  it('edits the existing review with an update (not an upsert) and awards no stamp', async () => {
    const { admin, deps } = setup(existingReview);
    const result = await submitReview(deps, { userId: USER, input: { ...input, rating: 2 } });

    const [update] = admin.find('reviews.update');
    // Only the review content: never the owner, facility, or moderation columns.
    expect(update.payload).toEqual({ rating: 2, comment: input.comment, embedding: '[0.6,0.8]' });
    expect(update.filters).toEqual([['eq', 'id', 'rev-1']]);
    expect(admin.find('reviews.insert')).toHaveLength(0);
    expect(admin.find('stamps.upsert')).toHaveLength(0);
    expect(result).toMatchObject({ created: false, stampAwarded: false });
  });

  it('looks up only the signed-in user’s review for this facility', async () => {
    const { admin, deps } = setup();
    await submitReview(deps, { userId: USER, input });
    expect(admin.find('reviews.select')[0].filters).toEqual([
      ['eq', 'user_id', USER],
      ['eq', 'facility_id', FACILITY],
    ]);
  });

  it('returns 409 and changes nothing when a moderator removed the user’s review', async () => {
    const { admin, embed, deps } = setup({
      'reviews.select': () => ({ data: { id: 'rev-1', removed_at: '2026-11-20T08:00:00Z' } }),
    });
    await expect(submitReview(deps, { userId: USER, input })).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
    expect(admin.find('reviews.update')).toHaveLength(0);
    expect(admin.find('reviews.insert')).toHaveLength(0);
    expect(embed).not.toHaveBeenCalled();
  });

  it('still saves the review with a null embedding when embedding fails', async () => {
    const { admin, deps } = setup({}, null);
    const result = await submitReview(deps, { userId: USER, input });
    expect(admin.find('reviews.insert')[0].payload).toMatchObject({ embedding: null });
    expect(result.created).toBe(true);
  });

  it('clears the old vector when an edit cannot be embedded', async () => {
    const { admin, deps } = setup(existingReview, null);
    await submitReview(deps, { userId: USER, input });
    expect(admin.find('reviews.update')[0].payload).toMatchObject({ embedding: null });
  });

  it('returns 404 for a missing or inactive facility before embedding', async () => {
    const { embed, deps } = setup({ 'facilities.select': () => ({ data: null }) });
    await expect(submitReview(deps, { userId: USER, input })).rejects.toMatchObject({ status: 404 });
    expect(embed).not.toHaveBeenCalled();
  });

  it('returns 429 when the hourly review limit is reached, before embedding', async () => {
    const { embed, deps } = setup({ 'rate_limit_events.select': () => ({ count: 10 }) });
    await expect(submitReview(deps, { userId: USER, input })).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED' });
    expect(embed).not.toHaveBeenCalled();
  });

  it('returns 409 when a concurrent insert wins the one-review-per-facility race', async () => {
    const { deps } = setup({ 'reviews.insert': () => ({ error: { code: '23505', message: 'duplicate' } }) });
    await expect(submitReview(deps, { userId: USER, input })).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
  });

  it('still succeeds when the stamp step fails after the review is saved', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { deps } = setup({ 'stamps.upsert': () => ({ error: { code: 'XX000', message: 'boom' } }) });
    const result = await submitReview(deps, { userId: USER, input });
    expect(result).toMatchObject({ created: true, stampAwarded: false });
  });
});

describe('listStationReviews', () => {
  it('returns non-removed reviews of the station facilities with facility names', async () => {
    const db = fakeSupabase({
      'facilities.select': () => ({ data: [{ id: FACILITY, name: 'Water Station Concourse L2' }] }),
      'reviews.select': () => ({ data: [reviewRow()] }),
    });
    const reviews = await listStationReviews(db.client, STATION);

    expect(db.find('facilities.select')[0].filters).toEqual([['eq', 'station_id', STATION]]);
    expect(db.find('reviews.select')[0].filters).toEqual([
      ['in', 'facility_id', [FACILITY]],
      ['is', 'removed_at', null],
    ]);
    expect(reviews).toEqual([expect.objectContaining({ id: 'rev-1', facilityName: 'Water Station Concourse L2' })]);
  });

  it('skips the reviews query for a station without facilities', async () => {
    const db = fakeSupabase({ 'facilities.select': () => ({ data: [] }) });
    expect(await listStationReviews(db.client, STATION)).toEqual([]);
    expect(db.find('reviews.select')).toHaveLength(0);
  });
});
