'use client';

import React, { useState } from 'react';
import { Star, Droplet, Zap, CheckCircle2 } from 'lucide-react';
import { Facility, Review } from '@/lib/types';
import { APP_CONFIG } from '@/lib/config';
import { useToast } from '@/context/ToastContext';
import { reviewService, type SubmitReviewResult } from '@/lib/services/reviewService';
import { reviewErrorMessage } from '@/lib/reviews/messages';
import { BottomSheet } from '../common/BottomSheet';

interface ReviewSheetProps {
  title: string;
  description?: string;
  /** Facilities of the station; water dispensers are listed first. */
  facilities: Facility[];
  /** The signed-in user's own reviews, used to prefill an edit. */
  myReviews: Review[];
  /** Preselect this facility (the Edit button on the user's own review). */
  initialFacilityId?: string;
  onClose: () => void;
  onSaved: (result: SubmitReviewResult) => void;
}

const MAX_CHARS = APP_CONFIG.REVIEW_COMMENT_MAX_CHARS;

/** Render only while open: the form starts fresh each time. One review per facility; posting again edits it. */
export function ReviewSheet({
  title,
  description,
  facilities,
  myReviews,
  initialFacilityId,
  onClose,
  onSaved,
}: ReviewSheetProps) {
  const { showToast } = useToast();
  const options = [...facilities].sort((a, b) => Number(b.type === 'water') - Number(a.type === 'water'));
  const ownReviewFor = (facilityId: string) => myReviews.find((r) => r.facilityId === facilityId);

  const firstId =
    initialFacilityId && options.some((f) => f.id === initialFacilityId) ? initialFacilityId : (options[0]?.id ?? '');
  const [facilityId, setFacilityId] = useState(firstId);
  const [rating, setRating] = useState(ownReviewFor(firstId)?.rating ?? 5);
  const [comment, setComment] = useState(ownReviewFor(firstId)?.comment ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = Boolean(ownReviewFor(facilityId));

  const selectFacility = (id: string) => {
    const own = ownReviewFor(id);
    setFacilityId(id);
    setRating(own?.rating ?? 5);
    setComment(own?.comment ?? '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      showToast('Harap tuliskan ulasan Anda.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await reviewService.submitReview({ facilityId, rating, comment });
      if (result.stampAwarded) {
        showToast('Ulasan terkirim! Stamp fasilitas diperoleh.', 'stamp');
      } else {
        showToast(result.created ? 'Ulasan berhasil dikirim!' : 'Ulasan berhasil diperbarui.', 'success');
      }
      onSaved(result);
    } catch (err) {
      showToast(reviewErrorMessage(err), 'error');
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet isOpen onClose={onClose} title={title} description={description}>
      {options.length === 0 ? (
        <p className="text-sm text-slate-600">Belum ada fasilitas yang bisa diulas di stasiun ini.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <span id="review-facility-label" className="block text-xs font-semibold text-slate-700 mb-1">
              Pilih fasilitas
            </span>
            <div role="radiogroup" aria-labelledby="review-facility-label" className="flex flex-col gap-2">
              {options.map((f) => {
                const isWater = f.type === 'water';
                const TypeIcon = isWater ? Droplet : Zap;
                const isSelected = f.id === facilityId;
                const isReviewed = Boolean(ownReviewFor(f.id));
                return (
                  <button
                    type="button"
                    key={f.id}
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => selectFacility(f.id)}
                    className={`min-touch-target w-full flex items-center gap-3 px-3 py-2 rounded-xl border text-left transition-colors ${
                      isSelected ? 'border-[#00628C] bg-[#C8E6FF]/40' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isWater ? 'bg-[#011638] text-white' : 'bg-[#FFD233] text-[#011638]'
                      }`}
                    >
                      <TypeIcon size={16} aria-hidden="true" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-navy truncate">{f.name}</span>
                      {f.platform && <span className="block text-[11px] text-slate-500 truncate">{f.platform}</span>}
                    </span>
                    {isReviewed && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-[10px] font-bold shrink-0">
                        <CheckCircle2 size={12} aria-hidden="true" />
                        Sudah diulas
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {isEdit && (
              <p className="text-[11px] text-slate-500 mt-1.5">
                Anda sudah mengulas fasilitas ini. Mengirim lagi akan memperbarui ulasan Anda.
              </p>
            )}
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1">Rating (1 - 5 bintang)</span>
            <div className="flex items-center gap-2" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  role="radio"
                  aria-checked={star === rating}
                  aria-label={`${star} bintang`}
                  onClick={() => setRating(star)}
                  className="min-touch-target p-1 text-amber-400 hover:scale-110 transition-transform"
                >
                  <Star size={28} fill={star <= rating ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="review-comment" className="block text-xs font-semibold text-slate-700 mb-1">
              Ulasan Anda (maks {MAX_CHARS} karakter)
            </label>
            <textarea
              id="review-comment"
              rows={4}
              maxLength={MAX_CHARS}
              required
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ceritakan rasa air, kebersihan dispenser, kelancaran aliran, dll..."
              className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#00628C]"
            />
            <div className="text-[11px] text-slate-400 text-right mt-1">
              {comment.length}/{MAX_CHARS}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="min-touch-target py-3 rounded-xl bg-[#011638] text-white font-bold text-sm hover:bg-[#002255] transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Mengirim...' : isEdit ? 'Perbarui Ulasan' : 'Kirim Ulasan'}
          </button>
        </form>
      )}
    </BottomSheet>
  );
}
