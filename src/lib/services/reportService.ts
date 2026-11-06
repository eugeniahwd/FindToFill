import { Report, ReportStatus } from '../types';
import { MOCK_REPORTS } from '../mock/data';
import { dataUrlToBlob } from '../reports/dataUrl';
import { apiRequest } from './apiClient';

const dynamicReports: Report[] = [...MOCK_REPORTS];

export interface SubmitReportResult {
  report: Report;
  /** True when this was the user's first report or review for the facility. */
  stampAwarded: boolean;
}

export const reportService = {
  /**
   * Sends the report to POST /api/reports. The user comes from the session cookie;
   * userId/userName are accepted for compatibility but not sent.
   */
  async createReport(params: {
    facilityId: string;
    userId?: string;
    userName?: string;
    status: ReportStatus;
    /** Compressed photo as a data URL (from PhotoUploader). */
    photoUrl: string;
    note?: string;
  }): Promise<SubmitReportResult> {
    const form = new FormData();
    form.set('facilityId', params.facilityId);
    form.set('status', params.status);
    if (params.note?.trim()) form.set('note', params.note.trim());
    const photo = dataUrlToBlob(params.photoUrl);
    form.set('photo', photo, `photo.${photo.type === 'image/png' ? 'png' : 'jpg'}`);

    return apiRequest<SubmitReportResult>('/api/reports', { method: 'POST', body: form });
  },

  /** The signed-in user's 10 most recent reports. */
  async getMyReports(): Promise<Report[]> {
    const { reports } = await apiRequest<{ reports: Report[] }>('/api/me/reports');
    return reports;
  },

  // ---------------------------------------------------------------------------
  // Still mock data until the admin moderation API (Sprint 6).
  // ---------------------------------------------------------------------------

  // TODO(backend): Replace with supabase.from('reports').select('*').eq('facility_id', facilityId).is('removed_at', null)
  async getFacilityReports(facilityId: string): Promise<Report[]> {
    await new Promise((r) => setTimeout(r, 150));
    return dynamicReports
      .filter((r) => r.facilityId === facilityId && !r.removedAt)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  },

  // TODO(backend): Replace with the admin moderation API (Sprint 6)
  async getAllReports(): Promise<Report[]> {
    await new Promise((r) => setTimeout(r, 200));
    return [...dynamicReports].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  // TODO(backend): Replace with the admin moderation API (Sprint 6)
  async removeReport(reportId: string, adminId: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 250));
    const index = dynamicReports.findIndex((r) => r.id === reportId);
    if (index !== -1) {
      dynamicReports[index] = {
        ...dynamicReports[index],
        removedAt: new Date().toISOString(),
        removedBy: adminId,
      };
    }
  },

  // TODO(backend): Replace with the admin moderation API (Sprint 6)
  async restoreReport(reportId: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 250));
    const index = dynamicReports.findIndex((r) => r.id === reportId);
    if (index !== -1) {
      dynamicReports[index] = {
        ...dynamicReports[index],
        removedAt: null,
        removedBy: null,
      };
    }
  },
};
