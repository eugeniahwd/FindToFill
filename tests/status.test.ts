import {
  isReportActive,
  resolveFacilityStatus,
  getStatusBadgeInfo,
  formatTimeAgo,
} from '@/lib/utils/status';
import { Report } from '@/lib/types';

describe('Status Utilities and 7-day Active Window Rule', () => {
  const baseTime = new Date('2026-10-30T12:00:00Z');

  describe('isReportActive', () => {
    it('returns true for reports submitted 1 day ago', () => {
      const oneDayAgo = new Date('2026-10-29T12:00:00Z').toISOString();
      expect(isReportActive({ createdAt: oneDayAgo, removedAt: null }, baseTime)).toBe(true);
    });

    it('returns true for reports submitted 6 days and 23 hours ago', () => {
      const almostSevenDaysAgo = new Date(baseTime.getTime() - (7 * 24 * 60 * 60 * 1000 - 1000)).toISOString();
      expect(isReportActive({ createdAt: almostSevenDaysAgo, removedAt: null }, baseTime)).toBe(true);
    });

    it('returns false for reports older than 7 days', () => {
      const eightDaysAgo = new Date('2026-10-22T11:00:00Z').toISOString();
      expect(isReportActive({ createdAt: eightDaysAgo, removedAt: null }, baseTime)).toBe(false);
    });

    it('returns false for reports that have been removed by an admin', () => {
      const oneDayAgo = new Date('2026-10-29T12:00:00Z').toISOString();
      expect(
        isReportActive({ createdAt: oneDayAgo, removedAt: '2026-10-30T00:00:00Z' }, baseTime)
      ).toBe(false);
    });
  });

  describe('resolveFacilityStatus', () => {
    it('returns latest report within 7-day window', () => {
      const reports: Report[] = [
        {
          id: '1',
          facilityId: 'f1',
          userId: 'u1',
          status: 'available',
          photoUrl: 'https://example.com/p1.jpg',
          createdAt: new Date('2026-10-28T10:00:00Z').toISOString(),
        },
        {
          id: '2',
          facilityId: 'f1',
          userId: 'u2',
          status: 'empty',
          photoUrl: 'https://example.com/p2.jpg',
          createdAt: new Date('2026-10-30T10:00:00Z').toISOString(), // more recent
        },
      ];

      const result = resolveFacilityStatus(reports, baseTime);
      expect(result.status).toBe('empty');
      expect(result.lastPhotoUrl).toBe('https://example.com/p2.jpg');
      expect(result.activeReportCount).toBe(2);
    });

    it('returns "unknown" (No recent report) when reports are older than 7 days', () => {
      const oldReports: Report[] = [
        {
          id: '1',
          facilityId: 'f1',
          userId: 'u1',
          status: 'available',
          photoUrl: 'https://example.com/p1.jpg',
          createdAt: new Date('2026-10-20T10:00:00Z').toISOString(), // > 7 days
        },
      ];

      const result = resolveFacilityStatus(oldReports, baseTime);
      expect(result.status).toBe('unknown');
      expect(result.lastReportedAt).toBeNull();
      expect(result.activeReportCount).toBe(0);
    });
  });

  describe('getStatusBadgeInfo', () => {
    it('maps "available" to Available with green styling', () => {
      const info = getStatusBadgeInfo('available');
      expect(info.label).toBe('Available');
      expect(info.textClass).toContain('#2E7D32');
      expect(info.bgClass).toContain('#E8F5E9');
    });

    it('maps "empty" to Empty with amber styling', () => {
      const info = getStatusBadgeInfo('empty');
      expect(info.label).toBe('Empty');
      expect(info.bgClass).toContain('#FFF8D6');
    });

    it('maps "broken" to Broken with red styling', () => {
      const info = getStatusBadgeInfo('broken');
      expect(info.label).toBe('Broken');
      expect(info.bgClass).toContain('#FDECEA');
    });

    it('maps "under_maintenance" to Under Maintenance with slate styling', () => {
      const info = getStatusBadgeInfo('under_maintenance');
      expect(info.label).toBe('Under Maintenance');
      expect(info.bgClass).toContain('#ECEFF1');
    });

    it('maps "unknown" to No recent report with neutral gray styling', () => {
      const info = getStatusBadgeInfo('unknown');
      expect(info.label).toBe('No recent report');
      expect(info.bgClass).toContain('#F3F4F6');
    });
  });

  describe('formatTimeAgo', () => {
    it('returns "No recent report" for null date', () => {
      expect(formatTimeAgo(null)).toBe('No recent report');
    });

    it('returns "Just now" for dates within 1 minute', () => {
      const date = new Date(baseTime.getTime() - 30 * 1000).toISOString();
      expect(formatTimeAgo(date, baseTime)).toBe('Just now');
    });

    it('returns minutes ago', () => {
      const date = new Date(baseTime.getTime() - 15 * 60 * 1000).toISOString();
      expect(formatTimeAgo(date, baseTime)).toBe('15 min ago');
    });
  });
});
