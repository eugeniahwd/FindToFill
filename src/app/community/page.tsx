'use client';

import React, { useState, useEffect } from 'react';
import {
  Star,
  Heart,
  Award,
  PenLine,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { reviewService } from '@/lib/services/reviewService';
import { communityService } from '@/lib/services/communityService';
import { stationService } from '@/lib/services/stationService';
import { Review, Station, FacilityWithStatus, Stamp } from '@/lib/types';
import { MOCK_STATIONS } from '@/lib/mock/data';
import { BottomSheet } from '@/components/common/BottomSheet';
import { EmptyState } from '@/components/common/EmptyState';
import { formatTimeAgo } from '@/lib/utils/status';

export default function CommunityPage() {
  const { user, requireAuth } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'reviews' | 'favorites' | 'stamps'>('reviews');
  const [selectedStationId, setSelectedStationId] = useState<string>(MOCK_STATIONS[0].id);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [ratingInput, setRatingInput] = useState(5);
  const [commentInput, setCommentInput] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Favorites state
  const [favoriteStationIds, setFavoriteStationIds] = useState<string[]>([]);
  const [favoriteStationsWithFacs, setFavoriteStationsWithFacs] = useState<
    { station: Station; facilities: FacilityWithStatus[] }[]
  >([]);

  // Stamps state
  const [userStamps, setUserStamps] = useState<Stamp[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const revs = await reviewService.getStationReviews(selectedStationId);
        setReviews(revs);

        if (user) {
          const [favIds, stamps] = await Promise.all([
            communityService.getFavorites(user.id),
            communityService.getUserStamps(user.id),
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
  }, [selectedStationId, user]);

  const handleToggleFavorite = async (stationId: string) => {
    if (!requireAuth('/community')) return;
    try {
      const nowFav = await communityService.toggleFavorite(user!.id, stationId);
      const updated = nowFav
        ? [...favoriteStationIds, stationId]
        : favoriteStationIds.filter((id) => id !== stationId);
      setFavoriteStationIds(updated);

      showToast(
        nowFav ? 'Ditambahkan ke stasiun favorit.' : 'Dihapus dari favorit.',
        'success'
      );
    } catch {
      showToast('Gagal mengubah favorit.', 'error');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireAuth('/community')) return;
    if (!commentInput.trim()) {
      showToast('Harap tuliskan ulasan Anda.', 'error');
      return;
    }

    const facs = await stationService.getStationFacilities(selectedStationId);
    const targetFac = facs[0];
    if (!targetFac) return;

    setIsSubmittingReview(true);
    try {
      const newRev = await reviewService.addReview({
        facilityId: targetFac.id,
        userId: user!.id,
        userName: user!.displayName,
        rating: ratingInput,
        comment: commentInput,
      });

      setReviews([newRev, ...reviews]);
      setShowReviewModal(false);
      setCommentInput('');
      showToast('Ulasan berhasil ditambahkan! Stamp didapatkan 🎉', 'success');
    } catch {
      showToast('Gagal mengirim ulasan.', 'error');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Stamp calculation: stations where user has at least one stamp
  const stampedStationIds = new Set(
    userStamps.map((s) => s.stationId).filter(Boolean)
  );
  const totalPilotStations = MOCK_STATIONS.length;
  const stampedCount = stampedStationIds.size;
  const progressPercent = Math.round((stampedCount / totalPilotStations) * 100);

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
            {MOCK_STATIONS.map((st) => (
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
                    : '5.0'}
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
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-navy">
                    {rev.userName || 'Penumpang KRL'}
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

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-50">
                  <span>Dispenser Air Minum</span>
                  <span>{formatTimeAgo(rev.createdAt)}</span>
                </div>
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
              onAction={() => setSelectedStationId(MOCK_STATIONS[0].id)}
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
            {MOCK_STATIONS.map((station) => {
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
                          : 'Belum pernah dilaporkan'}
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

      {/* Review Modal */}
      <BottomSheet
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title="Tulis Ulasan Air Stasiun"
        description="Bantu tingkatkan kualitas layanan dengan membagikan ulasan fasilitas air minum."
      >
        <form onSubmit={handleSubmitReview} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Beri Bintang
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRatingInput(star)}
                  className="min-touch-target p-1 text-amber-400"
                >
                  <Star
                    size={28}
                    fill={star <= ratingInput ? 'currentColor' : 'none'}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="comm-review-text"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Ulasan Anda (maks 500 karakter)
            </label>
            <textarea
              id="comm-review-text"
              rows={4}
              maxLength={500}
              required
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Ceritakan kebersihan atau kesegaran air minum..."
              className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#00628C]"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmittingReview}
            className="min-touch-target py-3 rounded-xl bg-[#011638] text-white font-bold text-sm hover:bg-[#002255] transition-colors"
          >
            {isSubmittingReview ? 'Mengirim...' : 'Kirim Ulasan'}
          </button>
        </form>
      </BottomSheet>
    </div>
  );
}
