import { Report, ReportStatus } from '../types';
import { MOCK_REPORTS } from '../mock/data';
import { communityService } from './communityService';

let dynamicReports: Report[] = [...MOCK_REPORTS];

export const reportService = {
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

  // TODO(backend): Replace with supabase.from('reports').select('*, facilities(name, station_id), profiles(display_name)')
  async getAllReports(): Promise<Report[]> {
    await new Promise((r) => setTimeout(r, 200));
    return [...dynamicReports].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  // TODO(backend): Replace with supabase.from('reports').insert(...) and server-side stamp check
  async createReport(params: {
    facilityId: string;
    userId: string;
    userName?: string;
    status: ReportStatus;
    photoUrl: string;
    note?: string;
  }): Promise<Report> {
    await new Promise((r) => setTimeout(r, 400));
    const newReport: Report = {
      id: `rep-${Date.now()}`,
      facilityId: params.facilityId,
      userId: params.userId,
      userName: params.userName || 'Anonymous Commuter',
      status: params.status,
      photoUrl: params.photoUrl,
      note: params.note?.trim() ? params.note.trim().slice(0, 140) : undefined,
      createdAt: new Date().toISOString(),
    };

    // Add to top of reports
    dynamicReports = [newReport, ...dynamicReports];

    // Award stamp for first report
    await communityService.awardStamp(params.userId, params.facilityId);

    return newReport;
  },

  // TODO(backend): Replace with supabase.from('reports').update({ removed_at: now(), removed_by: adminId }).eq('id', id)
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

  // TODO(backend): Replace with supabase admin action
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
