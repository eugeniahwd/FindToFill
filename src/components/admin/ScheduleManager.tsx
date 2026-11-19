'use client';

import React, { useState } from 'react';
import { Plus, X, TrainFront } from 'lucide-react';
import type { Schedule, Station } from '@/lib/types';
import { adminService, type DayType } from '@/lib/services/adminService';
import { adminErrorMessage } from '@/lib/admin/messages';
import { useToast } from '@/context/ToastContext';
import { AdminChips } from './FilterChips';
import { ConfirmSheet } from './ConfirmSheet';
import { FormField, inputClass } from './FormField';
import { ListStates } from './ListStates';
import { useAdminList } from './useAdminList';

const DAY_TYPES = [
  { value: 'weekday', label: 'Hari kerja' },
  { value: 'weekend', label: 'Akhir pekan' },
];

/** Groups departures by "line -> direction", keeping the server's time order. */
function groupByRoute(schedules: Schedule[]): { key: string; line: string; direction: string; items: Schedule[] }[] {
  const groups = new Map<string, { key: string; line: string; direction: string; items: Schedule[] }>();
  for (const s of schedules) {
    const key = `${s.line}\u0000${s.direction}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, line: s.line, direction: s.direction, items: [] };
      groups.set(key, group);
    }
    group.items.push(s);
  }
  return [...groups.values()];
}

/** Stations tab: the station's timetable, one departure added or deleted at a time (WIB). */
export function ScheduleManager({ station }: { station: Station }) {
  const { showToast } = useToast();
  const [dayType, setDayType] = useState<DayType>('weekday');
  const [line, setLine] = useState(station.lines[0] ?? '');
  const [direction, setDirection] = useState('');
  const [time, setTime] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deleting, setDeleting] = useState<Schedule | null>(null);

  const { items: schedules, setItems, state, reload } = useAdminList(
    () => adminService.getSchedules(station.id, dayType),
    `${station.id}|${dayType}`,
  );
  const groups = groupByRoute(schedules);
  const knownDirections = [...new Set(schedules.map((s) => s.direction))];

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    try {
      const created = await adminService.addDeparture(station.id, { line, direction, dayType, departureTime: time });
      setItems((prev) =>
        [...prev, created].sort((a, b) =>
          `${a.line}${a.direction}${a.departureTime}`.localeCompare(`${b.line}${b.direction}${b.departureTime}`),
        ),
      );
      showToast(`Keberangkatan ${created.departureTime} ditambahkan.`, 'success');
      setTime('');
    } catch (err) {
      showToast(adminErrorMessage(err, 'Gagal menambah jadwal.'), 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const remove = async (schedule: Schedule) => {
    try {
      await adminService.deleteDeparture(schedule.id);
      setItems((prev) => prev.filter((s) => s.id !== schedule.id));
      showToast(`Keberangkatan ${schedule.departureTime} dihapus.`, 'success');
      setDeleting(null);
    } catch (err) {
      showToast(adminErrorMessage(err, 'Gagal menghapus jadwal.'), 'error');
    }
  };

  return (
    <section aria-labelledby="schedule-heading" className="flex flex-col gap-3">
      <h2 id="schedule-heading" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
        <TrainFront size={14} aria-hidden="true" />
        Jadwal Kereta (WIB)
      </h2>
      <AdminChips label="Jenis hari" options={DAY_TYPES} value={dayType} onChange={(v) => setDayType((v as DayType) ?? 'weekday')} />

      <form onSubmit={add} className="bg-white p-3 rounded-2xl border border-slate-100 flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2">
          <FormField id="sch-line" label="Jalur">
            <input id="sch-line" required maxLength={60} list="sch-line-options" value={line} onChange={(e) => setLine(e.target.value)} className={inputClass} />
            <datalist id="sch-line-options">
              {station.lines.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </FormField>
          <FormField id="sch-dir" label="Arah">
            <input id="sch-dir" required maxLength={80} list="sch-dir-options" value={direction} onChange={(e) => setDirection(e.target.value)} className={inputClass} placeholder="Bogor" />
            <datalist id="sch-dir-options">
              {knownDirections.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-2 items-end">
          <FormField id="sch-time" label="Jam berangkat">
            <input id="sch-time" type="time" required value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
          </FormField>
          <button
            type="submit"
            disabled={isAdding}
            className="min-touch-target rounded-xl bg-[#00628C] text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Plus size={16} aria-hidden="true" />
            <span>{isAdding ? 'Menyimpan...' : 'Tambah'}</span>
          </button>
        </div>
      </form>

      <ListStates state={state} isEmpty={schedules.length === 0} emptyText="Belum ada jadwal untuk jenis hari ini." onRetry={reload}>
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group.key} className="bg-white p-3 rounded-2xl border border-slate-100">
              <div className="text-xs font-bold text-navy mb-2">
                {group.line} · arah {group.direction} <span className="font-normal text-slate-400">({group.items.length})</span>
              </div>
              <ul className="grid grid-cols-4 gap-1.5">
                {group.items.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setDeleting(s)}
                      aria-label={`Hapus keberangkatan ${s.departureTime} arah ${s.direction}`}
                      className="min-touch-target w-full rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1 hover:bg-red-50 hover:border-red-200"
                    >
                      {s.departureTime}
                      <X size={12} className="text-slate-400" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </ListStates>

      {deleting && (
        <ConfirmSheet
          title="Hapus keberangkatan ini?"
          message={`${deleting.line} arah ${deleting.direction}, jam ${deleting.departureTime} (${deleting.dayType === 'weekday' ? 'hari kerja' : 'akhir pekan'}) akan dihapus dari jadwal.`}
          confirmLabel="Hapus"
          onConfirm={() => remove(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  );
}
