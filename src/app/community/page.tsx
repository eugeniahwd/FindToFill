'use client';

import React, { useState, useEffect } from 'react';
import {
  Star,
  Heart,
  Award,
  PenLine,
  Pencil,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { reviewService } from '@/lib/services/reviewService';
import { communityService } from '@/lib/services/communityService';
import { stationService } from '@/lib/services/stationService';
import { Review, Station, FacilityWithStatus, Stamp } from '@/lib/types';
import { useLocation } from '@/context/LocationContext';
import { ReviewSheet } from '@/components/review/ReviewSheet';
import { EmptyState } from '@/components/common/EmptyState';
import { formatTimeAgo } from '@/lib/utils/status';
import type { SubmitReviewResult } from '@/lib/services/reviewService';

const COMMUNITY_TABS = ['reviews', 'favorites', 'stamps'] as const;
type CommunityTab = (typeof COMMUNITY_TABS)[number];

function isCommunityTab(value: string | null): value is CommunityTab {
  return COMMUNITY_TABS.some((tab) => tab === value);
}

export default function CommunityPage() {
  const { user, requireAuth } = useAuth();
  const { showToast } = useToast();
  // Pilot stations from the database (LocationProvider renders only after they load).
  const { stations } = useLocation();

  const [activeTab, setActiveTab] = useState<CommunityTab>('reviews');

  // Deep link from the bottom nav (/community?tab=stamps). Read after mount to keep SSR markup stable.
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (isCommunityTab(tab)) setActiveTab(tab);
  }, []);
  const [selectedStationId, setSelectedStationId] = useState<string>(stations[0]?.id ?? '');

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stationFacilities, setStationFacilities] = useState<FacilityWithStatus[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  // Set by the Edit button on the user's own review; undefined for "Tulis Ulasan".
  const [editFacilityId, setEditFacilityId] = useState<string | undefined>();

  // Favorites state
  const [favoriteStationIds, setFavoriteStationIds] = useState<string[]>([]);
  const [favoriteStationsWithFacs, setFavoriteStationsWithFacs] = useState<
    { station: Station; facilities: FacilityWithStatus[] }[]
  >([]);

  // Stamps state
  const [userStamps, setUserStamps] = useState<Stamp[]>([]);

  useEffect(() => {
    if (!selectedStationId) return;
    // Ignore a slow response for a station chip the user already left.
    let isCurrent = true;
    async function loadReviews() {
      try {
        const [revs, facs] = await Promise.all([
          reviewService.getStationReviews(selectedStationId),
          stationService.getStationFacilities(selectedStationId),
        ]);
        if (!isCurrent) return;
        setReviews(revs);
        setStationFacilities(facs);
      } catch (err) {
        console.error('Error loading station reviews', err);
      }
    }
    loadReviews();
    return () => {
      isCurrent = false;
    };
  }, [selectedStationId]);

  useEffect(() => {
    async function loadData() {
      try {
        if (user) {
          const [favIds, stamps] = await Promise.all([
            communityService.getFavorites(),
            communityService.getUserStamps(),
          ]);
          setFavoriteStationIds(favIds);
          setUserStamps(stamps);

          // Load facilities for favorite stations
          const favData = await Promise.all(
            favIds.map(async (stId) => {
              const st = await stationService.getStationById(stId);
              const facs = await stationService.getStationFacilities(stId);
              return st ? { station: st, facilities: facs } : null;
            })
          );
          setFavoriteStationsWithFacs(
            favData.filter(Boolean) as { station: Station; facilities: FacilityWithStatus[] }[]
          );
        }
      } catch (err) {
        console.error('Error loading community data', err);
      }
    }
    loadData();
  }, [user]);

  const handleToggleFavorite = async (stationId: string) => {
    if (!requireAuth('/community')) return;
    try {
      const nowFav = await communityService.setFavorite(stationId, !favoriteStationIds.includes(stationId));
      const updated = nowFav
        ? [...favoriteStationIds, stationId]
        : favoriteStationIds.filter((id) => id !== stationId);
      setFavoriteStationIds(updated);
      if (!nowFav) {
        setFavoriteStationsWithFacs((prev) => prev.filter((f) => f.station.id !== stationId));
      }

      showToast(
        nowFav ? 'Ditambahkan ke stasiun favorit.' : 'Dihapus dari favorit.',
        'success'
      );
    } catch {
      showToast('Gagal mengubah favorit.', 'error');
    }
  };

  const handleReviewSaved = ({ review, stampAwarded }: SubmitReviewResult) => {
    // A new review goes on top; an edited one replaces its old version.
    setReviews((prev) => [review, ...prev.filter((r) => r.id !== review.id)]);
    if (stampAwarded && user) {
      setUserStamps((prev) => [
        ...prev,
        { userId: user.id, facilityId: review.facilityId, stationId: selectedStationId, stampedAt: new Date().toISOString() },
      ]);
    }
    setShowReviewModal(false);
  };

  // Stamp calculation: stations where user has at least one stamp
  const stampedStationIds = new Set(
    userStamps.map((s) => s.stationId).filter(Boolean)
  );
  const totalPilotStations = stations.length;
  const stampedCount = stampedStationIds.size;
  const progressPercent = totalPilotStations
    ? Math.round((stampedCount / totalPilotStations) * 100)
    : 0;

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 pb-16">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-navy">Komunitas & Aktivitas</h1>
        <p className="text-xs text-slate-500">
          Ulasan pengguna, stasiun favorit, dan koleksi stamp stasiun.
        </p>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        className="flex p-1 bg-slate-200/70 rounded-2xl"
      >
        <button
          role="tab"
          aria-selected={activeTab === 'reviews'}
          onClick={() => setActiveTab('reviews')}
          className={`min-touch-target flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'reviews'
              ? 'bg-white text-navy shadow-xs'
              : 'text-slate-600 hover:text-navy'
          }`}
        >
          Reviews
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'favorites'}
          onClick={() => setActiveTab('favorites')}
          className={`min-touch-target flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'favorites'
              ? 'bg-white text-navy shadow-xs'
              : 'text-slate-600 hover:text-navy'
          }`}
        >
          Favorites
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'stamps'}
          onClick={() => setActiveTab('stamps')}
          className={`min-touch-target flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'stamps'
              ? 'bg-white text-navy shadow-xs'
              : 'text-slate-600 hover:text-navy'
          }`}
        >
          Stamp Map
        </button>
      </div>

      {/* TAB 1: REVIEWS */}
      {activeTab === 'reviews' && (
        <div className="flex flex-col gap-3.5">
          {/* Station Selector Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {stations.map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStationId(st.id)}
                className={`min-touch-target px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
                  selectedStationId === st.id
                    ? 'bg-[#011638] text-white border-[#011638]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Stasiun {st.name}
              </button>
            ))}
          </div>

          {/* Rating Summary Card with CTA */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <Star size={20} className="text-amber-500" fill="currentColor" />
                <span className="text-lg font-bold text-navy">
                  {reviews.length > 0
                    ? (
                        reviews.reduce((acc, r) => acc + r.rating, 0) /
                        reviews.length
                      ).toFixed(1)
                    : '-'}
                </span>
                <span className="text-xs text-slate-400">/ 5.0</span>
              </div>
              <span className="text-xs text-slate-500">
                Berdasarkan {reviews.length} ulasan penumpang
              </span>
            </div>

            <button
              onClick={() => {
                if (!requireAuth('/community')) return;
                setEditFacilityId(undefined);
                setShowReviewModal(true);
              }}
              className="min-touch-target px-3.5 py-2 rounded-xl bg-[#00628C] text-white text-xs font-bold shadow-xs hover:bg-[#004e70] flex items-center gap-1.5"
            >
              <PenLine size={14} />
              <span>Tulis Ulasan</span>
            </button>
          </div>

          {/* Review List */}
          <div className="flex flex-col gap-2.5">
            {reviews.length === 0 && (
              <EmptyState
                icon={Star}
                title="Belum Ada Ulasan"
                message="Jadilah yang pertama mengulas fasilitas di stasiun ini."
              />
            )}
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-navy">
                    {rev.userId === user?.id ? 'Ulasan Anda' : 'Penumpang KRL'}
                  </span>
                  <div className="flex items-center text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        fill={i < rev.rating ? 'currentColor' : 'none'}
                        className="stroke-amber-500"
                      />
                    ))}
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  &ldquo;{rev.comment}&rdquo;
                </p>

                <div className="text-[11px] text-slate-400 flex items-center justify-between gap-2 pt-1 border-t border-slate-50">
                  <span className="truncate">{rev.facilityName ?? 'Fasilitas stasiun'}</span>
                  <span className="shrink-0">{formatTimeAgo(rev.updatedAt ?? rev.createdAt)}</span>
                </div>

                {rev.userId === user?.id && (
                  <button
                    onClick={() => {
                      setEditFacilityId(rev.facilityId);
                      setShowReviewModal(true);
                    }}
                    className="min-touch-target self-start px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                    aria-label={`Edit ulasan untuk ${rev.facilityName ?? 'fasilitas ini'}`}
                  >
                    <Pencil size={13} aria-hidden="true" />
                    <span>Edit Ulasan</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: FAVORITES */}
      {activeTab === 'favorites' && (
        <div className="flex flex-col gap-3">
          {!user ? (
            <EmptyState
              icon={Lock}
              title="Masuk untuk Melihat Favorit"
              message="Simpan stasiun yang sering Anda kunjungi untuk akses status dispenser dan charging lebih cepat."
              actionLabel="Masuk Akun"
              onAction={() => requireAuth('/community')}
            />
          ) : favoriteStationsWithFacs.length > 0 ? (
            favoriteStationsWithFacs.map(({ station, facilities }) => {
              const activeCount = facilities.filter(
                (f) => f.currentStatus === 'available'
              ).length;

              return (
                <div
                  key={station.id}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-navy">
                        Stasiun {station.name}
                      </h3>
                      <div className="flex items-center gap-1 mt-1">
                        {station.lines.map((l) => (
                          <span
                            key={l}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-[#C8E6FF] text-[#00628C] font-semibold"
                          >
                            {l}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleFavorite(station.id)}
                      className="min-touch-target p-2 text-red-500 hover:text-red-600"
                      aria-label="Hapus dari favorit"
                    >
                      <Heart size={20} fill="currentColor" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <span className="text-slate-600">Status Fasilitas:</span>
                    <span className="font-bold text-[#2E7D32]">
                      {activeCount} dari {facilities.length} Siap Pakai
                    </span>
                  </div>

                  <a
                    href={`/stations/${station.id}`}
                    className="min-touch-target py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold text-center flex items-center justify-center gap-1"
                  >
                    <span>Buka Detail Stasiun</span>
                    <ChevronRight size={14} />
                  </a>
                </div>
              );
            })
          ) : (
            <EmptyState
              icon={Heart}
              title="Belum Ada Stasiun Favorit"
              message="Buka halaman stasiun dan ketuk ikon hati untuk menyimpannya di sini."
              actionLabel="Jelajahi Stasiun"
              onAction={() => setSelectedStationId(stations[0]?.id ?? '')}
            />
          )}
        </div>
      )}

      {/* TAB 3: STAMP MAP */}
      {activeTab === 'stamps' && (
        <div className="flex flex-col gap-4">
          {/* Stamp Header & Progress */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-navy flex items-center gap-1.5">
                  <Award size={18} className="text-[#9A6700]" />
                  <span>Koleksi Stamp Stasiun</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dapatkan 1 stamp saat melapor atau mengulas fasilitas stasiun!
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-[#FFF8D6] text-[#9A6700] flex items-center justify-center font-bold text-sm border border-[#FFD233]/50">
                {stampedCount}/{totalPilotStations}
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
                <span>{stampedCount} of {totalPilotStations} pilot stations tried</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-[#FFD233] transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Grid of Pilot Stations: Tried (filled) vs Untried (outlined) */}
          <div className="grid grid-cols-1 gap-3">
            {stations.map((station) => {
              const isStamped = user ? stampedStationIds.has(station.id) : false;

              return (
                <div
                  key={station.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                    isStamped
                      ? 'bg-[#E8F5E9] border-[#2E7D32]/30 shadow-xs'
                      : 'bg-white border-dashed border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                        isStamped
                          ? 'bg-[#2E7D32] text-white border-[#2E7D32]'
                          : 'bg-slate-50 text-slate-300 border-slate-200'
                      }`}
                    >
                      <Award size={24} />
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-navy">
                          Stasiun {station.name}
                        </span>
                        {isStamped && (
                          <span className="px-2 py-0.5 rounded-full bg-[#2E7D32] text-white text-[10px] font-bold">
                            STAMPED
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 block mt-0.5">
                        {isStamped
                          ? 'Sudah pernah berkontribusi'
                          : 'Belum ada laporan atau ulasan dari Anda'}
                      </span>
                    </div>
                  </div>

                  <a
                    href={`/stations/${station.id}`}
                    className="min-touch-target p-2 text-slate-400 hover:text-navy"
                    aria-label={`Buka Stasiun ${station.name}`}
                  >
                    <ChevronRight size={20} />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showReviewModal && (
        <ReviewSheet
          title="Tulis Ulasan Fasilitas"
          description="Bantu penumpang lain dengan membagikan pengalaman Anda di fasilitas stasiun ini."
          facilities={stationFacilities}
          myReviews={reviews.filter((r) => r.userId === user?.id)}
          initialFacilityId={editFacilityId}
          onClose={() => setShowReviewModal(false)}
          onSaved={handleReviewSaved}
        />
      )}
    </div>
  );
}
