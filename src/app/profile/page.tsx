'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User as UserIcon,
  Mail,
  ShieldCheck,
  LogOut,
  Heart,
  Award,
  ChevronRight,
  ShieldAlert,
  Clock,
  Flag,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { reportService } from '@/lib/services/reportService';
import { stationService } from '@/lib/services/stationService';
import { Report, Facility } from '@/lib/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { formatTimeAgo } from '@/lib/utils/status';

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, isGuest } = useAuth();
  const { showToast } = useToast();

  const [myReports, setMyReports] = useState<Report[]>([]);
  const [facilitiesMap, setFacilitiesMap] = useState<Record<string, Facility>>({});

  useEffect(() => {
    async function loadUserReports() {
      if (!user) {
        return;
      }
      try {
        const all = await reportService.getAllReports();
        const userReports = all.filter((r) => r.userId === user.id).slice(0, 10);
        setMyReports(userReports);

        // Fetch facility details
        const map: Record<string, Facility> = {};
        for (const rep of userReports) {
          if (!map[rep.facilityId]) {
            const fac = await stationService.getFacilityById(rep.facilityId);
            if (fac) map[rep.facilityId] = fac;
          }
        }
        setFacilitiesMap(map);
      } catch (err) {
        console.error('Error loading user reports', err);
      }
    }
    loadUserReports();
  }, [user]);

  const handleLogout = async () => {
    await logout();
    showToast('Anda telah keluar dari akun.', 'info');
  };

  if (!user || isGuest) {
    return (
      <div className="flex-1 flex flex-col justify-center p-6">
        <EmptyState
          icon={UserIcon}
          title="Mode Tamu (Guest)"
          message="Anda sedang menjelajah sebagai tamu. Masuk atau daftar akun untuk menyimpan stasiun favorit, mengumpulkan stamp, dan melapor kondisi."
          actionLabel="Masuk / Daftar Akun"
          onAction={() => router.push('/login')}
        />
      </div>
    );
  }

  const isAdmin = user.role === 'admin';

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 pb-16">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-navy">Profil Saya</h1>
        <p className="text-xs text-slate-500">Kelola akun dan pantau kontribusi Anda.</p>
      </div>

      {/* User Information Card */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-full bg-[#011638] text-white flex items-center justify-center font-bold text-xl shadow-xs">
            {user.displayName.slice(0, 1).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-navy truncate">
              {user.displayName}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 truncate">
              <Mail size={13} className="shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>

            <div className="mt-1.5 flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isAdmin
                    ? 'bg-red-50 text-[#BA1A1A] border border-red-200'
                    : 'bg-blue-50 text-[#00628C] border border-blue-200'
                }`}
              >
                {isAdmin ? <ShieldCheck size={12} /> : <UserIcon size={12} />}
                <span>{isAdmin ? 'ADMINISTRATOR' : 'COMMUTER'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action button to Admin Panel (ONLY for Admins) */}
        {isAdmin && (
          <a
            href="/admin"
            className="min-touch-target mt-2 py-2.5 px-3.5 rounded-xl bg-slate-900 text-[#FFD233] text-xs font-bold flex items-center justify-between hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} />
              <span>Buka Admin Moderation Panel</span>
            </div>
            <ChevronRight size={16} />
          </a>
        )}
      </div>

      {/* Quick Nav to Favorites & Stamps */}
      <div className="grid grid-cols-2 gap-3">
        <a
          href="/community"
          className="min-touch-target p-4 rounded-2xl bg-white border border-slate-100 shadow-xs flex flex-col gap-1 hover:border-slate-300 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-1">
            <Heart size={16} fill="currentColor" />
          </div>
          <span className="text-xs font-bold text-navy">Stasiun Favorit</span>
          <span className="text-[11px] text-slate-400">Lihat daftar tersimpan</span>
        </a>

        <a
          href="/community"
          className="min-touch-target p-4 rounded-2xl bg-white border border-slate-100 shadow-xs flex flex-col gap-1 hover:border-slate-300 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-[#FFF8D6] text-[#9A6700] flex items-center justify-center mb-1">
            <Award size={16} />
          </div>
          <span className="text-xs font-bold text-navy">Stamp Stasiun</span>
          <span className="text-[11px] text-slate-400">Pantau koleksi stamp</span>
        </a>
      </div>

      {/* My Last Reports List */}
      <section className="flex flex-col gap-2.5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Riwayat Laporan Saya (Maks 10 Terakhir)
        </h3>

        {myReports.length > 0 ? (
          <div className="flex flex-col gap-2">
            {myReports.map((report) => {
              const fac = facilitiesMap[report.facilityId];
              return (
                <div
                  key={report.id}
                  className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-navy truncate">
                      {fac?.name || 'Fasilitas Stasiun'}
                    </h4>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock size={11} />
                      {formatTimeAgo(report.createdAt)}
                    </span>
                  </div>

                  <StatusBadge status={report.status} size="sm" />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center text-xs text-slate-500 flex flex-col items-center gap-1">
            <Flag size={20} className="text-slate-300 mb-1" />
            <span>Belum ada laporan yang Anda kirimkan.</span>
          </div>
        )}
      </section>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="min-touch-target mt-3 w-full py-3 px-4 rounded-2xl border border-red-200 text-red-600 font-bold text-xs hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
      >
        <LogOut size={16} />
        <span>Keluar dari Akun</span>
      </button>
    </div>
  );
}
