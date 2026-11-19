'use client';

import React, { useState } from 'react';
import { Edit3, Plus } from 'lucide-react';
import type { FacilityWithStatus, Station } from '@/lib/types';
import { stationService } from '@/lib/services/stationService';
import { StatusBadge } from '../common/StatusBadge';
import { AdminChips } from './FilterChips';
import { ListStates } from './ListStates';
import { ScheduleManager } from './ScheduleManager';
import { FacilityCreateSheet, FacilityEditSheet, StationCreateSheet } from './StationForms';
import { useAdminList } from './useAdminList';

const addButtonClass =
  'min-touch-target px-3 py-1.5 rounded-xl bg-[#00628C] text-white text-xs font-bold flex items-center gap-1 hover:bg-[#004e70]';

/**
 * Stations tab (SPEC 4.7): add stations and facilities, edit facilities, manage the timetable.
 * Layout image upload is on hold (team decision), so layouts are not edited here yet.
 */
export function StationsManager({ stations, onStationCreated }: { stations: Station[]; onStationCreated: (s: Station) => void }) {
  const [stationId, setStationId] = useState<string>(stations[0]?.id ?? '');
  const [sheet, setSheet] = useState<'station' | 'facility' | null>(null);
  const [editing, setEditing] = useState<FacilityWithStatus | null>(null);
  const station = stations.find((s) => s.id === stationId) ?? stations[0];

  const { items: facilities, setItems, state, reload } = useAdminList(
    () => (station ? stationService.getStationFacilities(station.id) : Promise.resolve([])),
    station?.id ?? '',
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stasiun</h2>
        <button type="button" onClick={() => setSheet('station')} className={addButtonClass}>
          <Plus size={14} aria-hidden="true" />
          <span>Tambah Stasiun</span>
        </button>
      </div>
      <AdminChips
        label="Pilih stasiun"
        options={stations.map((s) => ({ value: s.id, label: s.name }))}
        value={station?.id ?? null}
        onChange={(v) => v && setStationId(v)}
      />

      {station && (
        <>
          <section aria-labelledby="facility-heading" className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 id="facility-heading" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Fasilitas di Stasiun {station.name}
              </h2>
              <button type="button" onClick={() => setSheet('facility')} className={addButtonClass}>
                <Plus size={14} aria-hidden="true" />
                <span>Tambah Fasilitas</span>
              </button>
            </div>
            <ListStates state={state} isEmpty={facilities.length === 0} emptyText="Belum ada fasilitas aktif di stasiun ini." onRetry={reload}>
              <ul className="flex flex-col gap-2.5">
                {facilities.map((fac) => (
                  <li key={fac.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-navy truncate">{fac.name}</span>
                        <StatusBadge status={fac.currentStatus} size="sm" />
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 truncate">
                        {[fac.level, fac.platform, fac.locationDetail].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditing(fac)}
                      className="min-touch-target p-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center shrink-0"
                      aria-label={`Edit ${fac.name}`}
                    >
                      <Edit3 size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </ListStates>
          </section>

          <ScheduleManager key={station.id} station={station} />
        </>
      )}

      {sheet === 'station' && (
        <StationCreateSheet
          onClose={() => setSheet(null)}
          onCreated={(created) => {
            onStationCreated(created);
            setStationId(created.id);
            setSheet(null);
          }}
        />
      )}
      {sheet === 'facility' && station && (
        <FacilityCreateSheet
          station={station}
          onClose={() => setSheet(null)}
          onCreated={() => {
            setSheet(null);
            reload();
          }}
        />
      )}
      {editing && (
        <FacilityEditSheet
          facility={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setItems((prev) => prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
