'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  Trash2,
  CheckCircle2,
  Edit3,
  ArrowLeft,
  Save,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { reportService } from '@/lib/services/reportService';
import { reviewService } from '@/lib/services/reviewService';
import { stationService } from '@/lib/services/stationService';
import { Report, Review, Station, FacilityWithStatus, Facility } from '@/lib/types';
import { MOCK_STATIONS } from '@/lib/mock/data';
import { StatusBadge } from '@/components/common/StatusBadge';
import { BottomSheet } from '@/components/common/BottomSheet';
import { formatTimeAgo } from '@/lib/utils/status';

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'reports' | 'stations'>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [facilities, setFacilities] = useState<FacilityWithStatus[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>(MOCK_STATIONS[0].id);

  // Edit facility modal
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPlatform, setEditPlatform] = useState('');

  // Photo preview modal
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  useEffect(() => {
    // Role protection: commuter or guests cannot access admin panel
    if (!user || user.role !== 'admin') {
      router.push('/profile');
      return;
    }

    async function loadAdminData() {
      try {
        const [allReps, allRevs, allSts, facs] = await Promise.all([
          reportService.getAllReports(),
          reviewService.getAllReviews(),
          stationService.getStations(),
          stationService.getStationFacilities(selectedStationId),
        ]);
        setReports(allReps);
        setReviews(allRevs);
        setStations(allSts);
        setFacilities(facs);
      } catch (err) {
        console.error('Error loading admin data', err);
      }
    }
    loadAdminData();
  }, [user, router, selectedStationId]);

  const handleRemoveReport = async (reportId: string) => {
    try {
      await reportService.removeReport(reportId, user!.id);
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, removedAt: new Date().toISOString(), removedBy: user!.id }
            : r
        )
      );
      showToast('Laporan berhasil dihapus (soft-delete).', 'success');
    } catch {
      showToast('Gagal menghapus laporan.', 'error');
    }
  };

  const handleRestoreReport = async (reportId: string) => {
    try {
      await reportService.restoreReport(reportId);
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId ? { ...r, removedAt: null, removedBy: null } : r
        )
      );
      showToast('Laporan berhasil disetujui / dipulihkan.', 'success');
    } catch {
      showToast('Gagal memulihkan laporan.', 'error');
    }
  };

  const handleRemoveReview = async (reviewId: string) => {
    try {
      await reviewService.removeReview(reviewId, user!.id);
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, removedAt: new Date().toISOString(), removedBy: user!.id }
            : r
        )
      );
      showToast('Ulasan berhasil dihapus.', 'success');
    } catch {
      showToast('Gagal menghapus ulasan.', 'error');
    }
  };

  const handleSaveFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFacility) return;

    try {
      const updated = await stationService.updateFacility(editingFacility.id, {
        name: editName,
        locationDetail: editLocation,
        platform: editPlatform,
      });

      setFacilities((prev) =>
        prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f))
      );
      setEditingFacility(null);
      showToast('Data fasilitas berhasil diperbarui!', 'success');
    } catch {
      showToast('Gagal menyimpan perubahan.', 'error');
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Memverifikasi akses admin...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 pb-16">
      {/* Admin Top Header */}
      <div className="flex items-center justify-between">
        <a
          href="/profile"
          className="min-touch-target p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center transition-colors"
          aria-label="Kembali ke profil"
        >
          <ArrowLeft size={18} />
        </a>

        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-[#BA1A1A] rounded-full text-xs font-bold border border-red-200">
          <ShieldAlert size={14} />
          <span>ADMIN MODERATOR</span>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-bold text-navy">Panel Manajemen Admin</h1>
        <p className="text-xs text-slate-500">
          Moderasi laporan kondisi pengguna dan kelola data stasiun / fasilitas.
        </p>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        className="flex p-1 bg-slate-200/70 rounded-2xl"
      >
        <button
          role="tab"
          aria-selected={activeTab === 'reports'}
          onClick={() => setActiveTab('reports')}
          className={`min-touch-target flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'reports'
              ? 'bg-white text-navy shadow-xs'
              : 'text-slate-600 hover:text-navy'
          }`}
        >
          Reports & Reviews ({reports.length})
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'stations'}
          onClick={() => setActiveTab('stations')}
          className={`min-touch-target flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'stations'
              ? 'bg-white text-navy shadow-xs'
              : 'text-slate-600 hover:text-navy'
          }`}
        >
          Stations & Facilities
        </button>
      </div>

      {/* TAB 1: REPORTS & REVIEWS MODERATION */}
      {activeTab === 'reports' && (
        <div className="flex flex-col gap-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Daftar Laporan Penumpang (Live Reports)
          </div>

          <div className="flex flex-col gap-3">
            {reports.map((rep) => {
              const isRemoved = !!rep.removedAt;

              return (
                <div
                  key={rep.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col gap-2.5 ${
                    isRemoved
                      ? 'bg-red-50/50 border-red-200 opacity-70'
                      : 'bg-white border-slate-100 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Photo Thumbnail */}
                      <button
                        type="button"
                        onClick={() => setPreviewPhoto(rep.photoUrl)}
                        className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 relative group"
                        aria-label="Lihat foto laporan"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={rep.photoUrl}
                          alt="Thumbnail laporan"
                          className="w-full h-full object-cover"
                        />
                      </button>

                      <div>
                        <div className="text-xs font-bold text-navy">
                          {rep.userName || 'Penumpang'}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {formatTimeAgo(rep.createdAt)}
                        </span>
                      </div>
                    </div>

                    <StatusBadge status={rep.status} size="sm" />
                  </div>

                  {rep.note && (
                    <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg">
                      &ldquo;{rep.note}&rdquo;
                    </p>
                  )}

                  {/* Actions: Remove or Approve/Restore */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                    {isRemoved ? (
                      <button
                        onClick={() => handleRestoreReport(rep.id)}
                        className="min-touch-target px-3 py-1.5 rounded-xl bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold flex items-center gap-1 hover:bg-[#d4edd6]"
                      >
                        <CheckCircle2 size={14} />
                        <span>Pulihkan (Approve)</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRemoveReport(rep.id)}
                        className="min-touch-target px-3 py-1.5 rounded-xl bg-red-50 text-[#BA1A1A] text-xs font-bold flex items-center gap-1 hover:bg-red-100"
                      >
                        <Trash2 size={14} />
                        <span>Hapus (Remove)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-4">
            Daftar Ulasan Penumpang (Reviews)
          </div>

          <div className="flex flex-col gap-2.5">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                  rev.removedAt
                    ? 'bg-red-50/50 border-red-200 opacity-60'
                    : 'bg-white border-slate-100 shadow-xs'
                }`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="text-xs font-bold text-navy truncate">
                    {rev.userName} • {rev.rating} Bintang
                  </div>
                  <p className="text-xs text-slate-600 truncate mt-0.5">
                    {rev.comment}
                  </p>
                </div>

                {!rev.removedAt && (
                  <button
                    onClick={() => handleRemoveReview(rev.id)}
                    className="min-touch-target p-2 text-red-500 hover:text-red-700"
                    aria-label="Hapus ulasan"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: STATIONS & FACILITIES EDITOR */}
      {activeTab === 'stations' && (
        <div className="flex flex-col gap-3.5">
          {/* Station selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {stations.map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStationId(st.id)}
                className={`min-touch-target px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
                  selectedStationId === st.id
                    ? 'bg-[#011638] text-white border-[#011638]'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                Stasiun {st.name}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Fasilitas di Stasiun Terpilih
            </span>
          </div>

          {/* Facility List with Edit Buttons */}
          <div className="flex flex-col gap-2.5">
            {facilities.map((fac) => (
              <div
                key={fac.id}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-navy truncate">
                      {fac.name}
                    </span>
                    <StatusBadge status={fac.currentStatus} size="sm" />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 truncate">
                    {fac.locationDetail || fac.platform}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setEditingFacility(fac);
                    setEditName(fac.name);
                    setEditLocation(fac.locationDetail || '');
                    setEditPlatform(fac.platform || '');
                  }}
                  className="min-touch-target p-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center shrink-0"
                  aria-label="Edit fasilitas ini"
                >
                  <Edit3 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Facility BottomSheet Modal */}
      {editingFacility && (
        <BottomSheet
          isOpen={!!editingFacility}
          onClose={() => setEditingFacility(null)}
          title="Edit Data Fasilitas"
          description={`ID: ${editingFacility.id}`}
        >
          <form onSubmit={handleSaveFacility} className="flex flex-col gap-3.5">
            <div>
              <label
                htmlFor="edit-fac-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nama Fasilitas
              </label>
              <input
                id="edit-fac-name"
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#00628C]"
              />
            </div>

            <div>
              <label
                htmlFor="edit-fac-loc"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Detail Lokasi
              </label>
              <input
                id="edit-fac-loc"
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#00628C]"
              />
            </div>

            <div>
              <label
                htmlFor="edit-fac-plat"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Peron / Area
              </label>
              <input
                id="edit-fac-plat"
                type="text"
                value={editPlatform}
                onChange={(e) => setEditPlatform(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#00628C]"
              />
            </div>

            <button
              type="submit"
              className="min-touch-target mt-2 py-3 rounded-xl bg-[#011638] text-white font-bold text-sm hover:bg-[#002255] flex items-center justify-center gap-1.5"
            >
              <Save size={16} />
              <span>Simpan Perubahan</span>
            </button>
          </form>
        </BottomSheet>
      )}

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <BottomSheet
          isOpen={!!previewPhoto}
          onClose={() => setPreviewPhoto(null)}
          title="Foto Laporan Penumpang"
        >
          <div className="rounded-2xl overflow-hidden aspect-video bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewPhoto}
              alt="Foto laporan"
              className="w-full h-full object-cover"
            />
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
