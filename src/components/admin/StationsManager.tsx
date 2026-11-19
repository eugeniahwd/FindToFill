'use client';

import React, { useState } from 'react';
import { Edit3, Plus } from 'lucide-react';
import type { FacilityWithStatus, Station } from '@/lib/types';
import { adminService } from '@/lib/services/adminService';
import { StatusBadge } from '../common/StatusBadge';
import { AdminChips } from './FilterChips';
import { ListStates } from './ListStates';
import { ScheduleManager } from './ScheduleManager';
import { FacilityCreateSheet, FacilityEditSheet, StationCreateSheet, StationEditSheet } from './StationForms';
import { useAdminList } from './useAdminList';

const addButtonClass =
  'min-touch-target px-3 py-1.5 rounded-xl bg-[#00628C] text-white text-xs font-bold flex items-center gap-1 hover:bg-[#004e70]';
const editButtonClass =
  'min-touch-target p-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center shrink-0';

/**
 * Stations tab (SPEC 4.7): add and edit stations, add and edit facilities (including switching
 * one off), manage the timetable. Layout image upload is on hold (team decision).
 */
export function StationsManager({
  stations,
  onStationCreated,
  onStationUpdated,
}: {
  stations: Station[];
  onStationCreated: (s: Station) => void;
  onStationUpdated: (s: Station) => void;
}) {
  const [stationId, setStationId] = useState<string>(stations[0]?.id ?? '');
  const [sheet, setSheet] = useState<'station' | 'edit-station' | 'facility' | null>(null);
  const [editing, setEditing] = useState<FacilityWithStatus | null>(null);
  const station = stations.find((s) => s.id === stationId) ?? stations[0];

  const { items: facilities, state, reload } = useAdminList(
    () => (station ? adminService.getStationFacilities(station.id) : Promise.resolve([])),
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
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-navy">Stasiun {station.name}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                {station.lines.length > 0 ? station.lines.join(', ') : 'Belum ada jalur'} · {station.latitude}, {station.longitude}
              </div>
            </div>
            <button type="button" onClick={() => setSheet('edit-station')} className={editButtonClass} aria-label={`Edit stasiun ${station.name}`}>
              <Edit3 size={16} aria-hidden="true" />
            </button>
          </div>

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
            <ListStates state={state} isEmpty={facilities.length === 0} emptyText="Belum ada fasilitas di stasiun ini." onRetry={reload}>
              <ul className="flex flex-col gap-2.5">
                {facilities.map((fac) => (
                  <li
                    key={fac.id}
                    className={`p-4 rounded-2xl border shadow-xs flex items-center justify-between gap-3 ${
                      fac.isActive ? 'bg-white border-slate-100' : 'bg-slate-50 border-dashed border-slate-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold truncate ${fac.isActive ? 'text-navy' : 'text-slate-500'}`}>{fac.name}</span>
                        {fac.isActive ? (
                          <StatusBadge status={fac.currentStatus} size="sm" />
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">Nonaktif</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 truncate">
                        {[fac.level, fac.platform, fac.locationDetail].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <button type="button" onClick={() => setEditing(fac)} className={editButtonClass} aria-label={`Edit ${fac.name}`}>
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
      {sheet === 'edit-station' && station && (
        <StationEditSheet
          station={station}
          onClose={() => setSheet(null)}
          onSaved={(updated) => {
            onStationUpdated(updated);
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
          onSaved={() => {
            // Reload so a switched-off facility moves to the end of the list with its label.
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
