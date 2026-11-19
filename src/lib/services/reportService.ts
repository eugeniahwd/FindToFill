import { Report, ReportStatus } from '../types';
import { dataUrlToBlob } from '../reports/dataUrl';
import { apiRequest } from './apiClient';

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
  // Admin moderation lives in adminService.
};
