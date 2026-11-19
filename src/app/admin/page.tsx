'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { stationService } from '@/lib/services/stationService';
import type { Station } from '@/lib/types';
import { ReportsModeration } from '@/components/admin/ReportsModeration';
import { ReviewsModeration } from '@/components/admin/ReviewsModeration';
import { StationsManager } from '@/components/admin/StationsManager';

type AdminTab = 'reports' | 'reviews' | 'stations';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'reports', label: 'Reports' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'stations', label: 'Stations' },
];

/**
 * Admin page (SPEC 4.7). Hiding it from non-admins is only a convenience: every admin API
 * route checks the role on the server, and RLS checks it again in the database.
 */
export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('reports');
  const [stations, setStations] = useState<Station[]>([]);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isLoading) return; // wait for the session, or a refresh would bounce admins away
    if (!isAdmin) {
      router.push('/profile');
      return;
    }
    stationService
      .getStations()
      .then(setStations)
      .catch((err) => console.error('Error loading stations', err));
  }, [isLoading, isAdmin, router]);

  if (isLoading || !isAdmin) {
    return <div className="p-8 text-center text-xs text-slate-500">Memverifikasi akses admin...</div>;
  }

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 pb-16">
      <div className="flex items-center justify-between">
        <a
          href="/profile"
          className="min-touch-target p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center transition-colors"
          aria-label="Kembali ke profil"
        >
          <ArrowLeft size={18} />
        </a>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-[#BA1A1A] rounded-full text-xs font-bold border border-red-200">
          <ShieldAlert size={14} aria-hidden="true" />
          <span>ADMIN MODERATOR</span>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-bold text-navy">Panel Manajemen Admin</h1>
        <p className="text-xs text-slate-500">Moderasi laporan dan ulasan, serta kelola data stasiun, fasilitas, dan jadwal.</p>
      </div>

      <div role="tablist" aria-label="Menu admin" className="flex p-1 bg-slate-200/70 rounded-2xl">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`min-touch-target flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === tab.id ? 'bg-white text-navy shadow-xs' : 'text-slate-600 hover:text-navy'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'reports' && <ReportsModeration stations={stations} />}
      {activeTab === 'reviews' && <ReviewsModeration stations={stations} />}
      {activeTab === 'stations' && stations.length > 0 && (
        <StationsManager
          stations={stations}
          onStationCreated={(s) => setStations((prev) => [...prev, s])}
          onStationUpdated={(s) => setStations((prev) => prev.map((p) => (p.id === s.id ? s : p)))}
        />
      )}
    </div>
  );
}
