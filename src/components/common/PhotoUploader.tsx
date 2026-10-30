'use client';

import React, { useRef, useState } from 'react';
import { Camera, X, RefreshCw } from 'lucide-react';

interface PhotoUploaderProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  required?: boolean;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  value,
  onChange,
  required = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran foto maksimal 5 MB.');
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress using Canvas: max 1280px width/height, JPEG 0.75
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 1280;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
          onChange(compressedDataUrl);
        } else {
          onChange(event.target?.result as string);
        }
        setIsProcessing(false);
      };

      img.onerror = () => {
        setError('Gagal membaca gambar.');
        setIsProcessing(false);
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  };

  const handleClear = () => {
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        id="photo-upload-input"
        aria-label="Ambil atau unggah foto fasilitas"
      />

      {value ? (
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 aspect-video flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Pratinjau foto fasilitas"
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-touch-target px-3 py-1.5 bg-black/60 text-white rounded-full text-xs font-medium flex items-center gap-1.5 backdrop-blur-xs hover:bg-black/80"
              aria-label="Ambil ulang foto"
            >
              <RefreshCw size={14} />
              <span>Ganti</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="min-touch-target p-2 bg-red-600/80 text-white rounded-full flex items-center justify-center backdrop-blur-xs hover:bg-red-700"
              aria-label="Hapus foto"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="min-touch-target w-full p-5 rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#00628C] bg-slate-50/70 hover:bg-slate-50 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer text-slate-600"
        >
          <div className="w-12 h-12 rounded-full bg-[#C8E6FF]/50 text-[#00628C] flex items-center justify-center">
            {isProcessing ? (
              <RefreshCw size={24} className="animate-spin" />
            ) : (
              <Camera size={24} />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-navy">
              Ambil Foto Fasilitas {required && <span className="text-red-500">*</span>}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Kamera langsung atau pilih dari galeri (maks 5MB)
            </p>
          </div>
        </button>
      )}

      {error && (
        <p className="text-xs text-red-600 font-medium">{error}</p>
      )}
    </div>
  );
};
