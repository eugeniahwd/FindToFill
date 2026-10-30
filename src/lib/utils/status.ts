import { Report, EffectiveStatus } from '../types';
import { APP_CONFIG } from '../config';

/**
 * Checks if a report was created within the last 7 days and has not been removed.
 */
export function isReportActive(
  report: Pick<Report, 'createdAt' | 'removedAt'>,
  now: Date = new Date()
): boolean {
  if (report.removedAt) return false;
  const reportTime = new Date(report.createdAt).getTime();
  const diff = now.getTime() - reportTime;
  return diff >= 0 && diff <= APP_CONFIG.ACTIVE_REPORT_WINDOW_MS;
}

/**
 * Resolves the facility's current active status from its reports.
 * If there are no active reports within the 7-day window, returns 'unknown' ("No recent report").
 */
export function resolveFacilityStatus(
  reports: Report[],
  now: Date = new Date()
): {
  status: EffectiveStatus;
  lastReportedAt: string | null;
  lastPhotoUrl: string | null;
  activeReportCount: number;
} {
  const activeReports = reports
    .filter((r) => isReportActive(r, now))
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  if (activeReports.length === 0) {
    return {
      status: 'unknown',
      lastReportedAt: null,
      lastPhotoUrl: null,
      activeReportCount: 0,
    };
  }

  const latest = activeReports[0];
  return {
    status: latest.status,
    lastReportedAt: latest.createdAt,
    lastPhotoUrl: latest.photoUrl,
    activeReportCount: activeReports.length,
  };
}

/**
 * Formats relative time (e.g., "5 min ago", "2 hours ago", "3 days ago").
 */
export function formatTimeAgo(isoDate: string | null, now: Date = new Date()): string {
  if (!isoDate) return 'No recent report';
  
  const diffMs = now.getTime() - new Date(isoDate).getTime();
  if (diffMs < 0) return 'Just now';
  
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hr${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  
  return 'Over a week ago';
}

export interface StatusBadgeInfo {
  label: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  status: EffectiveStatus;
}

export function getStatusBadgeInfo(status: EffectiveStatus): StatusBadgeInfo {
  switch (status) {
    case 'available':
      return {
        status,
        label: 'Available',
        textClass: 'text-[#2E7D32]',
        bgClass: 'bg-[#E8F5E9]',
        borderClass: 'border-[#2E7D32]/20',
      };
    case 'empty':
      return {
        status,
        label: 'Empty',
        textClass: 'text-[#9A6700]',
        bgClass: 'bg-[#FFF8D6]',
        borderClass: 'border-[#FFD233]/40',
      };
    case 'broken':
      return {
        status,
        label: 'Broken',
        textClass: 'text-[#BA1A1A]',
        bgClass: 'bg-[#FDECEA]',
        borderClass: 'border-[#BA1A1A]/20',
      };
    case 'under_maintenance':
      return {
        status,
        label: 'Under Maintenance',
        textClass: 'text-[#607D8B]',
        bgClass: 'bg-[#ECEFF1]',
        borderClass: 'border-[#607D8B]/20',
      };
    case 'unknown':
    default:
      return {
        status: 'unknown',
        label: 'No recent report',
        textClass: 'text-[#6B7280]',
        bgClass: 'bg-[#F3F4F6]',
        borderClass: 'border-[#6B7280]/20',
      };
  }
}
