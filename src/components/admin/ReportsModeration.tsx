'use client';

import React, { useState } from 'react';
import { Trash2, Ban } from 'lucide-react';
import type { ModerationReport, ReportStatus, Station } from '@/lib/types';
import { adminService } from '@/lib/services/adminService';
import { adminErrorMessage } from '@/lib/admin/messages';
import { getStatusBadgeInfo, formatTimeAgo } from '@/lib/utils/status';
import { useToast } from '@/context/ToastContext';
import { StatusBadge } from '../common/StatusBadge';
import { BottomSheet } from '../common/BottomSheet';
import { AdminChips } from './FilterChips';
import { ConfirmSheet } from './ConfirmSheet';
import { ListStates } from './ListStates';
import { useAdminList } from './useAdminList';

const STATUSES: ReportStatus[] = ['available', 'empty', 'broken', 'under_maintenance'];

/** Reports tab (SPEC 4.7): recent reports with photo thumbnails, station and status filters, Remove. */
export function ReportsModeration({ stations }: { stations: Station[] }) {
  const { showToast } = useToast();
  const [stationId, setStationId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<ModerationReport | null>(null);
  const [confirming, setConfirming] = useState<ModerationReport | null>(null);

  const { items: reports, setItems, state, reload } = useAdminList(
    () => adminService.getReports({ stationId: stationId ?? undefined, status: (status as ReportStatus | null) ?? undefined }),
    `${stationId}|${status}`,
  );

  const remove = async (report: ModerationReport) => {
    try {
      const removal = await adminService.removeReport(report.id);
      setItems((prev) => prev.map((r) => (r.id === removal.id ? { ...r, removedAt: removal.removedAt, removedBy: removal.removedBy } : r)));
      showToast('Laporan dihapus. Status fasilitas dihitung ulang.', 'success');
      setConfirming(null);
    } catch (err) {
      showToast(adminErrorMessage(err, 'Gagal menghapus laporan.'), 'error');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <AdminChips
        label="Filter stasiun"
        allLabel="Semua stasiun"
        options={stations.map((s) => ({ value: s.id, label: s.name }))}
        value={stationId}
        onChange={setStationId}
      />
      <AdminChips
        label="Filter status"
        allLabel="Semua status"
        options={STATUSES.map((s) => ({ value: s, label: getStatusBadgeInfo(s).label }))}
        value={status}
        onChange={setStatus}
      />

      <ListStates state={state} isEmpty={reports.length === 0} emptyText="Belum ada laporan untuk filter ini." onRetry={reload}>
        <ul className="flex flex-col gap-3">
          {reports.map((rep) => {
            const isRemoved = Boolean(rep.removedAt);
            return (
              <li
                key={rep.id}
                className={`p-4 rounded-2xl border flex flex-col gap-2.5 ${
                  isRemoved ? 'bg-red-50/50 border-red-200' : 'bg-white border-slate-100 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => rep.photoUrl && setPreview(rep)}
                      className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200"
                      aria-label="Lihat foto laporan"
                    >
                      {rep.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={rep.photoUrl} alt="" className={`w-full h-full object-cover ${isRemoved ? 'grayscale' : ''}`} />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-navy truncate">{rep.facilityName}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        Stasiun {rep.stationName} · {rep.userName ?? 'Penumpang'}
                      </div>
                      <div className="text-[11px] text-slate-400">{formatTimeAgo(rep.createdAt)}</div>
                    </div>
                  </div>
                  <StatusBadge status={rep.status} size="sm" />
                </div>

                {rep.note && <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg">&ldquo;{rep.note}&rdquo;</p>}

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                  {isRemoved ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[#BA1A1A]">
                      <Ban size={13} aria-hidden="true" />
                      Dihapus {formatTimeAgo(rep.removedAt ?? null)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(rep)}
                      className="min-touch-target px-3 py-1.5 rounded-xl bg-red-50 text-[#BA1A1A] text-xs font-bold flex items-center gap-1 hover:bg-red-100"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </ListStates>

      {preview && (
        <BottomSheet isOpen onClose={() => setPreview(null)} title="Foto Laporan" description={`${preview.facilityName} · Stasiun ${preview.stationName}`}>
          <div className="rounded-2xl overflow-hidden bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.photoUrl} alt={`Foto laporan ${preview.facilityName}`} className="w-full h-auto" />
          </div>
        </BottomSheet>
      )}

      {confirming && (
        <ConfirmSheet
          title="Hapus laporan ini?"
          message={`Laporan "${getStatusBadgeInfo(confirming.status).label}" untuk ${confirming.facilityName} tidak akan dihitung lagi untuk status fasilitas. Aksi ini tercatat atas nama Anda dan tidak bisa dibatalkan.`}
          confirmLabel="Remove"
          onConfirm={() => remove(confirming)}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
