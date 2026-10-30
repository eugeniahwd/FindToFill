'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  Info,
  Send,
  Droplet,
  Zap,
} from 'lucide-react';
import { stationService } from '@/lib/services/stationService';
import { reportService } from '@/lib/services/reportService';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { FacilityWithStatus, ReportStatus } from '@/lib/types';
import { PhotoUploader } from '@/components/common/PhotoUploader';

interface PageProps {
  params: Promise<{ facilityId: string }>;
}

export default function ReportPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const facilityId = resolvedParams.facilityId;

  const router = useRouter();
  const { user, requireAuth } = useAuth();
  const { showToast } = useToast();

  const [facility, setFacility] = useState<FacilityWithStatus | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    if (!user) {
      requireAuth(`/report/${facilityId}`);
      return;
    }

    async function loadFacility() {
      setIsLoading(true);
      try {
        const fac = await stationService.getFacilityById(facilityId);
        setFacility(fac);
      } catch (err) {
        console.error('Error fetching facility', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadFacility();
  }, [facilityId, user, requireAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStatus) {
      showToast('Pilih salah satu kondisi fasilitas.', 'error');
      return;
    }

    if (!photoDataUrl) {
      showToast('Foto bukti kondisi wajib diunggah.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await reportService.createReport({
        facilityId,
        userId: user!.id,
        userName: user!.displayName,
        status: selectedStatus,
        photoUrl: photoDataUrl,
        note,
      });

      showToast('Laporan berhasil dikirim! Stamp fasilitas diperoleh 🎉', 'success');
      router.push(`/stations/${facility?.stationId || ''}`);
    } catch {
      showToast('Gagal mengirim laporan. Coba beberapa saat lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusOptions: {
    id: ReportStatus;
    title: string;
    description: string;
    icon: React.ReactNode;
    activeClasses: string;
  }[] = [
    {
      id: 'available',
      title: 'Tersedia / Berfungsi',
      description: 'Air mengalir / colokan charging normal',
      icon: <CheckCircle2 size={24} className="text-[#2E7D32]" />,
      activeClasses: 'border-[#2E7D32] bg-[#E8F5E9] shadow-sm',
    },
    {
      id: 'empty',
      title: 'Habis / Tidak Ada Daya',
      description: 'Galon kosong / port tidak mengeluarkan arus',
      icon: <AlertTriangle size={24} className="text-[#9A6700]" />,
      activeClasses: 'border-[#FFD233] bg-[#FFF8D6] shadow-sm',
    },
    {
      id: 'broken',
      title: 'Rusak',
      description: 'Kran bocor, patah, atau stop kontak korsleting',
      icon: <XCircle size={24} className="text-[#BA1A1A]" />,
      activeClasses: 'border-[#BA1A1A] bg-[#FDECEA] shadow-sm',
    },
    {
      id: 'under_maintenance',
      title: 'Sedang Perbaikan',
      description: 'Ada teknisi atau tanda dilarang pakai',
      icon: <Wrench size={24} className="text-[#607D8B]" />,
      activeClasses: 'border-[#607D8B] bg-[#ECEFF1] shadow-sm',
    },
  ];

  const canSubmit = !!selectedStatus && !!photoDataUrl && !isSubmitting;

  if (isLoading || !facility) {
    return (
      <div className="p-6 text-center text-xs text-slate-500">
        Memuat formulir laporan...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 pb-12">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="min-touch-target p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center transition-colors"
          aria-label="Kembali"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-base font-bold text-navy">Lapor Kondisi Langsung</h1>
          <p className="text-xs text-slate-500">Bantu sesama penumpang KRL</p>
        </div>
      </div>

      {/* Facility Summary Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            facility.type === 'water'
              ? 'bg-[#011638] text-white'
              : 'bg-[#FFD233] text-[#011638]'
          }`}
        >
          {facility.type === 'water' ? <Droplet size={20} /> : <Zap size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-navy truncate">
            {facility.name}
          </h2>
          <p className="text-xs text-slate-500 truncate">
            {facility.locationDetail || facility.platform}
          </p>
        </div>
      </div>

      {/* Notice on 7-day rule */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-slate-600">
        <Info size={16} className="text-[#00628C] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Laporan hanya berlaku aktif selama <strong>7 hari</strong> untuk
          menjaga keakuratan informasi real-time bagi para penumpang.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Step 1: Four Large Selectable Status Cards */}
        <div>
          <label className="block text-xs font-bold text-navy uppercase tracking-wider mb-2">
            1. Pilih Kondisi Saat Ini <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 gap-2.5" role="radiogroup">
            {statusOptions.map((opt) => {
              const isSelected = selectedStatus === opt.id;
              return (
                <button
                  type="button"
                  key={opt.id}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedStatus(opt.id)}
                  className={`min-touch-target text-left p-3.5 rounded-2xl border transition-all flex items-center gap-3.5 cursor-pointer ${
                    isSelected
                      ? opt.activeClasses
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="shrink-0">{opt.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-navy">{opt.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {opt.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Photo Uploader (REQUIRED) */}
        <div>
          <label className="block text-xs font-bold text-navy uppercase tracking-wider mb-2">
            2. Foto Kondisi Fasilitas <span className="text-red-500">* (Wajib)</span>
          </label>
          <PhotoUploader
            value={photoDataUrl}
            onChange={setPhotoDataUrl}
            required
          />
        </div>

        {/* Step 3: Optional Note (max 140 chars) */}
        <div>
          <label
            htmlFor="report-note"
            className="block text-xs font-bold text-navy uppercase tracking-wider mb-1"
          >
            3. Catatan Tambahan (Opsional)
          </label>
          <textarea
            id="report-note"
            rows={2}
            maxLength={140}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contoh: Galon baru diganti, air dingin segar..."
            className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#00628C] bg-white"
          />
          <div className="text-[11px] text-slate-400 text-right mt-0.5">
            {note.length}/140
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="min-touch-target w-full py-3.5 px-4 rounded-xl bg-[#FFD233] text-[#011638] font-bold text-sm shadow-md hover:bg-[#ffe066] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send size={16} />
          <span>{isSubmitting ? 'Mengirim Laporan...' : 'Kirim Laporan'}</span>
        </button>
      </form>
    </div>
  );
}
