'use client';

import React, { useState } from 'react';
import { Trash2, Ban, Star } from 'lucide-react';
import type { ModerationReview, Station } from '@/lib/types';
import { adminService } from '@/lib/services/adminService';
import { adminErrorMessage } from '@/lib/admin/messages';
import { formatTimeAgo } from '@/lib/utils/status';
import { useToast } from '@/context/ToastContext';
import { AdminChips } from './FilterChips';
import { ConfirmSheet } from './ConfirmSheet';
import { ListStates } from './ListStates';
import { useAdminList } from './useAdminList';

/** Reviews tab (SPEC 4.7): recent reviews, station filter, Remove. */
export function ReviewsModeration({ stations }: { stations: Station[] }) {
  const { showToast } = useToast();
  const [stationId, setStationId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ModerationReview | null>(null);

  const { items: reviews, setItems, state, reload } = useAdminList(
    () => adminService.getReviews({ stationId: stationId ?? undefined }),
    `${stationId}`,
  );

  const remove = async (review: ModerationReview) => {
    try {
      const removal = await adminService.removeReview(review.id);
      setItems((prev) => prev.map((r) => (r.id === removal.id ? { ...r, removedAt: removal.removedAt, removedBy: removal.removedBy } : r)));
      showToast('Ulasan dihapus dan tidak lagi tampil untuk publik.', 'success');
      setConfirming(null);
    } catch (err) {
      showToast(adminErrorMessage(err, 'Gagal menghapus ulasan.'), 'error');
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

      <ListStates state={state} isEmpty={reviews.length === 0} emptyText="Belum ada ulasan untuk filter ini." onRetry={reload}>
        <ul className="flex flex-col gap-2.5">
          {reviews.map((rev) => {
            const isRemoved = Boolean(rev.removedAt);
            return (
              <li
                key={rev.id}
                className={`p-3.5 rounded-2xl border flex flex-col gap-2 ${
                  isRemoved ? 'bg-red-50/50 border-red-200' : 'bg-white border-slate-100 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-navy truncate">{rev.facilityName}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      Stasiun {rev.stationName} · {rev.userName ?? 'Penumpang'} · {formatTimeAgo(rev.createdAt)}
                    </div>
                  </div>
                  <span className="flex items-center gap-0.5 text-xs font-bold text-amber-600 shrink-0" aria-label={`${rev.rating} bintang`}>
                    <Star size={13} fill="currentColor" aria-hidden="true" />
                    {rev.rating}
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">&ldquo;{rev.comment}&rdquo;</p>

                <div className="flex items-center justify-end pt-1 border-t border-slate-100">
                  {isRemoved ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[#BA1A1A]">
                      <Ban size={13} aria-hidden="true" />
                      Dihapus {formatTimeAgo(rev.removedAt ?? null)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(rev)}
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

      {confirming && (
        <ConfirmSheet
          title="Hapus ulasan ini?"
          message={`Ulasan untuk ${confirming.facilityName} akan disembunyikan dari publik dan dari chatbot. Penulisnya tidak bisa mengirim ulasan baru untuk fasilitas ini. Aksi ini tercatat atas nama Anda dan tidak bisa dibatalkan.`}
          confirmLabel="Remove"
          onConfirm={() => remove(confirming)}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
