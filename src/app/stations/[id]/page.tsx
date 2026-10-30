'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Heart,
  MapPin,
  Star,
  Flag,
  PenLine,
} from 'lucide-react';
import { stationService } from '@/lib/services/stationService';
import { reviewService } from '@/lib/services/reviewService';
import { communityService } from '@/lib/services/communityService';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useLocation } from '@/context/LocationContext';
import {
  Station,
  FacilityWithStatus,
  StationLayout,
  Review,
} from '@/lib/types';
import { FacilityCard } from '@/components/facility/FacilityCard';
import { StationLayoutMap } from '@/components/facility/StationLayoutMap';
import { BottomSheet } from '@/components/common/BottomSheet';
import { EmptyState } from '@/components/common/EmptyState';
import { FacilityCardSkeleton } from '@/components/common/LoadingSkeleton';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function StationDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const stationId = resolvedParams.id;

  const router = useRouter();
  const { user, requireAuth } = useAuth();
  const { showToast } = useToast();
  const { coords } = useLocation();

  const [station, setStation] = useState<Station | null>(null);
  const [facilities, setFacilities] = useState<FacilityWithStatus[]>([]);
  const [layouts, setLayouts] = useState<StationLayout[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFavorited, setIsFavorited] = useState(false);
  const [activeTab, setActiveTab] = useState<'facilities' | 'layout'>('facilities');
  const [isLoading, setIsLoading] = useState(true);

  // Review bottom sheet
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [ratingInput, setRatingInput] = useState(5);
  const [commentInput, setCommentInput] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    async function loadStationData() {
      setIsLoading(true);
      try {
        const [st, facs, lay, revs] = await Promise.all([
          stationService.getStationById(stationId),
          stationService.getStationFacilities(stationId, coords),
          stationService.getStationLayouts(stationId),
          reviewService.getStationReviews(stationId),
        ]);

        setStation(st);
        setFacilities(facs);
        setLayouts(lay);
        setReviews(revs);

        if (user) {
          const favs = await communityService.getFavorites(user.id);
          setIsFavorited(favs.includes(stationId));
        }
      } catch (err) {
        console.error('Error loading station detail', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadStationData();
  }, [stationId, coords, user]);

  const handleToggleFavorite = async () => {
    if (!requireAuth(`/stations/${stationId}`)) return;
    try {
      const nowFav = await communityService.toggleFavorite(user!.id, stationId);
      setIsFavorited(nowFav);
      showToast(
        nowFav
          ? `Stasiun ${station?.name} ditambahkan ke favorit.`
          : `Stasiun ${station?.name} dihapus dari favorit.`,
        'success'
      );
    } catch {
      showToast('Gagal memperbarui favorit.', 'error');
    }
  };

  const handleOpenReview = () => {
    if (!requireAuth(`/stations/${stationId}`)) return;
    setShowReviewModal(true);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) {
      showToast('Harap tuliskan ulasan Anda.', 'error');
      return;
    }

    // Pick first water facility or general facility
    const targetFac = facilities.find((f) => f.type === 'water') || facilities[0];
    if (!targetFac) {
      showToast('Tidak ada fasilitas untuk diulas.', 'error');
      return;
    }

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
      showToast('Ulasan berhasil dikirim! Stamp diperoleh 🎉', 'success');
    } catch {
      showToast('Gagal mengirim ulasan.', 'error');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 flex flex-col gap-4">
        <FacilityCardSkeleton />
        <FacilityCardSkeleton />
      </div>
    );
  }

  if (!station) {
    return (
      <div className="p-6 text-center">
        <EmptyState
          title="Stasiun Tidak Ditemukan"
          message="Data stasiun yang Anda cari tidak tersedia."
          actionLabel="Kembali ke Beranda"
          onAction={() => router.push('/')}
        />
      </div>
    );
  }

  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
      : '5.0';

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 pb-28">
      {/* Top Navigation & Favorite Heart */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="min-touch-target p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center transition-colors"
          aria-label="Kembali"
        >
          <ArrowLeft size={18} />
        </button>

        <button
          onClick={handleToggleFavorite}
          className={`min-touch-target p-2.5 rounded-full border transition-all ${
            isFavorited
              ? 'bg-red-50 border-red-200 text-red-500'
              : 'bg-white border-slate-200 text-slate-400 hover:text-red-500'
          }`}
          aria-label={isFavorited ? 'Hapus dari favorit' : 'Tambah ke favorit'}
        >
          <Heart size={20} fill={isFavorited ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Station Title & Line Badges */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <MapPin size={20} className="text-[#00628C]" />
          <h1 className="text-xl font-bold text-navy">Stasiun {station.name}</h1>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {station.lines.map((line) => (
            <span
              key={line}
              className="text-xs px-2.5 py-1 rounded-lg bg-[#C8E6FF] text-[#00628C] font-semibold"
            >
              {line}
            </span>
          ))}
        </div>

        {/* Rating summary bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-1">
          <div className="flex items-center gap-1.5 text-xs">
            <div className="flex items-center text-amber-500">
              <Star size={15} fill="currentColor" />
            </div>
            <span className="font-bold text-navy">{averageRating}</span>
            <span className="text-slate-400">({reviews.length} ulasan)</span>
          </div>

          <button
            onClick={handleOpenReview}
            className="min-touch-target text-xs font-semibold text-[#00628C] hover:underline flex items-center gap-1"
          >
            <PenLine size={13} />
            <span>Tulis Ulasan</span>
          </button>
        </div>
      </div>

      {/* Main Content Tabs: Facilities vs Station Layout */}
      <div
        role="tablist"
        className="flex p-1 bg-slate-200/70 rounded-2xl"
      >
        <button
          role="tab"
          aria-selected={activeTab === 'facilities'}
          onClick={() => setActiveTab('facilities')}
          className={`min-touch-target flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'facilities'
              ? 'bg-white text-navy shadow-xs'
              : 'text-slate-600 hover:text-navy'
          }`}
        >
          Daftar Fasilitas ({facilities.length})
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'layout'}
          onClick={() => setActiveTab('layout')}
          className={`min-touch-target flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'layout'
              ? 'bg-white text-navy shadow-xs'
              : 'text-slate-600 hover:text-navy'
          }`}
        >
          Station Layout (Denah)
        </button>
      </div>

      {/* Tab 1: Facilities List */}
      {activeTab === 'facilities' && (
        <div className="flex flex-col gap-3">
          {facilities.map((fac) => (
            <FacilityCard key={fac.id} facility={fac} />
          ))}
        </div>
      )}

      {/* Tab 2: Station Layout Floor Plan */}
      {activeTab === 'layout' && (
        <StationLayoutMap
          stationName={station.name}
          layouts={layouts}
          facilities={facilities}
        />
      )}

      {/* Fixed Bottom Report CTA Button */}
      <div className="fixed bottom-16 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none">
        <div className="w-full max-w-md pointer-events-auto">
          {facilities[0] && (
            <a
              href={`/report/${facilities[0].id}`}
              className="min-touch-target w-full py-3.5 px-4 rounded-2xl bg-[#FFD233] text-[#011638] font-bold text-sm shadow-xl flex items-center justify-center gap-2 hover:bg-[#ffe066] active:scale-98 transition-all border-2 border-white"
            >
              <Flag size={18} className="text-[#9A6700]" />
              <span>Laporkan Kondisi Fasilitas</span>
            </a>
          )}
        </div>
      </div>

      {/* Review Modal */}
      <BottomSheet
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title={`Ulasan Stasiun ${station.name}`}
        description="Bagikan pengalaman kualitas air minum atau pengisian daya di stasiun ini."
      >
        <form onSubmit={handleSubmitReview} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Rating Kualitas (1 - 5 Bintang)
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRatingInput(star)}
                  className="min-touch-target p-1 text-amber-400 hover:scale-110 transition-transform"
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
              htmlFor="review-comment"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Ulasan Anda (maks 500 karakter)
            </label>
            <textarea
              id="review-comment"
              rows={4}
              maxLength={500}
              required
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Ceritakan rasa air, kebersihan dispenser, kelancaran aliran, dll..."
              className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#00628C]"
            />
            <div className="text-[11px] text-slate-400 text-right mt-1">
              {commentInput.length}/500
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmittingReview}
            className="min-touch-target py-3 rounded-xl bg-[#011638] text-white font-bold text-sm hover:bg-[#002255] transition-colors disabled:opacity-50"
          >
            {isSubmittingReview ? 'Mengirim...' : 'Kirim Ulasan'}
          </button>
        </form>
      </BottomSheet>
    </div>
  );
}
