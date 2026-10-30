'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/common/Logo';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Mail, Lock, User, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';

  const { login, register, continueAsGuest } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showToast('Harap isi email dan password.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        showToast('Berhasil masuk! Selamat datang kembali.', 'success');
      } else {
        await register(email, password, displayName);
        showToast('Pendaftaran akun berhasil!', 'success');
      }
      router.push(returnTo);
    } catch {
      showToast('Gagal memproses autentikasi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuest = () => {
    continueAsGuest();
    showToast('Melanjutkan sebagai tamu (mode jelajah).', 'info');
    router.push(returnTo);
  };

  // Demo user quick login helpers
  const handleQuickDemo = async (type: 'commuter' | 'admin') => {
    setIsSubmitting(true);
    try {
      if (type === 'admin') {
        await login('admin@findtofill.id', 'password');
        showToast('Masuk sebagai Demo Admin.', 'success');
      } else {
        await login('commuter@findtofill.id', 'password');
        showToast('Masuk sebagai Demo Commuter.', 'success');
      }
      router.push(returnTo);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-8">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center mb-6">
        <Logo size="lg" className="justify-center mb-2" />
        <p className="text-xs text-slate-500 max-w-xs mt-1">
          Platform informasi dispenser air & stasiun pengisian daya di stasiun KRL.
        </p>
      </div>

      {/* Auth Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
        {/* Mode Tabs */}
        <div
          role="tablist"
          className="flex p-1 bg-slate-100 rounded-2xl mb-5"
        >
          <button
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => setMode('login')}
            className={`min-touch-target flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              mode === 'login'
                ? 'bg-white text-navy shadow-xs'
                : 'text-slate-500 hover:text-navy'
            }`}
          >
            Masuk
          </button>
          <button
            role="tab"
            aria-selected={mode === 'register'}
            onClick={() => setMode('register')}
            className={`min-touch-target flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              mode === 'register'
                ? 'bg-white text-navy shadow-xs'
                : 'text-slate-500 hover:text-navy'
            }`}
          >
            Daftar Akun
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {mode === 'register' && (
            <div>
              <label
                htmlFor="display-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nama Lengkap
              </label>
              <div className="relative flex items-center">
                <User
                  size={18}
                  className="absolute left-3.5 text-slate-400 pointer-events-none"
                />
                <input
                  id="display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Budi Santoso"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00628C] bg-slate-50/50 text-sm"
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Email
            </label>
            <div className="relative flex items-center">
              <Mail
                size={18}
                className="absolute left-3.5 text-slate-400 pointer-events-none"
              />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00628C] bg-slate-50/50 text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Kata Sandi
            </label>
            <div className="relative flex items-center">
              <Lock
                size={18}
                className="absolute left-3.5 text-slate-400 pointer-events-none"
              />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00628C] bg-slate-50/50 text-sm"
              />
            </div>
          </div>

          {/* Primary CTA (Yellow background, Navy text) */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-touch-target mt-2 w-full py-3 px-4 rounded-xl bg-[#FFD233] text-[#011638] font-bold text-sm shadow-sm hover:bg-[#ffe066] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>{mode === 'login' ? 'Masuk Sekarang' : 'Daftar Sekarang'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Guest access notice */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-3">
          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            Anda dapat melihat peta dan menggunakan chatbot tanpa login. Login
            dibutuhkan untuk melapor kondisi, menulis ulasan, dan mengumpulkan stamp.
          </p>

          <button
            type="button"
            onClick={handleGuest}
            className="min-touch-target w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors flex items-center justify-center"
          >
            Lanjut sebagai Tamu (Guest)
          </button>
        </div>
      </div>

      {/* Quick Demo Access Bar */}
      <div className="mt-4 p-4 rounded-2xl bg-white/70 border border-slate-100 text-center">
        <span className="text-[11px] font-semibold text-slate-400 block mb-2">
          AKSES CEPAT DEMO (MOCK DATA)
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleQuickDemo('commuter')}
            disabled={isSubmitting}
            className="min-touch-target flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-navy flex items-center justify-center gap-1.5"
          >
            <UserCheck size={14} className="text-[#00628C]" />
            <span>Demo Commuter</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickDemo('admin')}
            disabled={isSubmitting}
            className="min-touch-target flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-navy flex items-center justify-center gap-1.5"
          >
            <ShieldCheck size={14} className="text-[#BA1A1A]" />
            <span>Demo Admin</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs">Memuat login...</div>}>
      <LoginContent />
    </Suspense>
  );
}
