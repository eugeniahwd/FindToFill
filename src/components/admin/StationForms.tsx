'use client';

import React, { useState } from 'react';
import { Save, Droplet, Zap } from 'lucide-react';
import type { Facility, FacilityWithStatus, Station } from '@/lib/types';
import { adminService } from '@/lib/services/adminService';
import { stationService } from '@/lib/services/stationService';
import { adminErrorMessage } from '@/lib/admin/messages';
import { useToast } from '@/context/ToastContext';
import { BottomSheet } from '../common/BottomSheet';
import { FormField, inputClass, toNumber } from './FormField';

const submitClass =
  'min-touch-target mt-1 py-3 rounded-xl bg-[#011638] text-white font-bold text-sm hover:bg-[#002255] flex items-center justify-center gap-1.5 disabled:opacity-50';

function SubmitButton({ isSaving, label }: { isSaving: boolean; label: string }) {
  return (
    <button type="submit" disabled={isSaving} className={submitClass}>
      <Save size={16} aria-hidden="true" />
      <span>{isSaving ? 'Menyimpan...' : label}</span>
    </button>
  );
}

const validCoordinates = (lat: number | undefined, lng: number | undefined) =>
  lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng);

/** Add a station. Coordinates are the station center (from OpenStreetMap or a field visit). */
export function StationCreateSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (station: Station) => void }) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [lines, setLines] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = toNumber(latitude);
    const lng = toNumber(longitude);
    if (!validCoordinates(lat, lng)) {
      showToast('Isi latitude dan longitude dengan angka, misalnya -6.2266 dan 106.8582.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const station = await adminService.createStation({
        name,
        lines: lines.split(',').map((l) => l.trim()).filter(Boolean),
        latitude: lat as number,
        longitude: lng as number,
      });
      showToast(`Stasiun ${station.name} ditambahkan.`, 'success');
      onCreated(station);
    } catch (err) {
      showToast(adminErrorMessage(err, 'Gagal menambah stasiun.'), 'error');
      setIsSaving(false);
    }
  };

  return (
    <BottomSheet isOpen onClose={onClose} title="Tambah Stasiun" description="Stasiun baru langsung muncul di aplikasi.">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <FormField id="st-name" label="Nama stasiun">
          <input id="st-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Cawang" />
        </FormField>
        <FormField id="st-lines" label="Jalur KRL" hint="Pisahkan dengan koma, misalnya: Bogor Line, Cikarang Line">
          <input id="st-lines" value={lines} onChange={(e) => setLines(e.target.value)} className={inputClass} placeholder="Bogor Line" />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField id="st-lat" label="Latitude">
            <input id="st-lat" inputMode="decimal" required value={latitude} onChange={(e) => setLatitude(e.target.value)} className={inputClass} placeholder="-6.2426" />
          </FormField>
          <FormField id="st-lng" label="Longitude">
            <input id="st-lng" inputMode="decimal" required value={longitude} onChange={(e) => setLongitude(e.target.value)} className={inputClass} placeholder="106.8584" />
          </FormField>
        </div>
        <SubmitButton isSaving={isSaving} label="Simpan Stasiun" />
      </form>
    </BottomSheet>
  );
}

/** Add a facility to a station. Coordinates start at the station center; layout position is optional. */
export function FacilityCreateSheet({
  station,
  onClose,
  onCreated,
}: {
  station: Station;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { showToast } = useToast();
  const [type, setType] = useState<Facility['type']>('water');
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('');
  const [locationDetail, setLocationDetail] = useState('');
  const [level, setLevel] = useState('L1');
  const [latitude, setLatitude] = useState(String(station.latitude));
  const [longitude, setLongitude] = useState(String(station.longitude));
  const [layoutX, setLayoutX] = useState('');
  const [layoutY, setLayoutY] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = toNumber(latitude);
    const lng = toNumber(longitude);
    const x = toNumber(layoutX);
    const y = toNumber(layoutY);
    if (!validCoordinates(lat, lng)) {
      showToast('Isi latitude dan longitude dengan angka.', 'error');
      return;
    }
    if ([x, y].some((v) => v !== undefined && !(Number.isFinite(v) && v >= 0 && v <= 100))) {
      showToast('Posisi di denah harus angka 0 sampai 100 (persen).', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await adminService.createFacility({
        stationId: station.id,
        type,
        name,
        platform,
        locationDetail,
        level,
        latitude: lat as number,
        longitude: lng as number,
        layoutX: x,
        layoutY: y,
      });
      showToast('Fasilitas ditambahkan.', 'success');
      onCreated();
    } catch (err) {
      showToast(adminErrorMessage(err, 'Gagal menambah fasilitas.'), 'error');
      setIsSaving(false);
    }
  };

  return (
    <BottomSheet isOpen onClose={onClose} title="Tambah Fasilitas" description={`Stasiun ${station.name}`}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div role="radiogroup" aria-label="Jenis fasilitas" className="grid grid-cols-2 gap-2">
          {(['water', 'charging'] as const).map((t) => {
            const Icon = t === 'water' ? Droplet : Zap;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                onClick={() => setType(t)}
                className={`min-touch-target flex items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold ${
                  type === t ? 'border-[#00628C] bg-[#C8E6FF]/40 text-navy' : 'border-slate-200 text-slate-600'
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {t === 'water' ? 'Air minum' : 'Charging'}
              </button>
            );
          })}
        </div>
        <FormField id="fac-name" label="Nama fasilitas">
          <input id="fac-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Water Station Gate B" />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField id="fac-platform" label="Peron / area">
            <input id="fac-platform" maxLength={120} value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputClass} placeholder="Peron 2" />
          </FormField>
          <FormField id="fac-level" label="Lantai">
            <input id="fac-level" required maxLength={40} value={level} onChange={(e) => setLevel(e.target.value)} className={inputClass} placeholder="L1" />
          </FormField>
        </div>
        <FormField id="fac-detail" label="Detail lokasi">
          <input id="fac-detail" maxLength={300} value={locationDetail} onChange={(e) => setLocationDetail(e.target.value)} className={inputClass} placeholder="Dekat tangga ke underpass" />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField id="fac-lat" label="Latitude">
            <input id="fac-lat" inputMode="decimal" required value={latitude} onChange={(e) => setLatitude(e.target.value)} className={inputClass} />
          </FormField>
          <FormField id="fac-lng" label="Longitude">
            <input id="fac-lng" inputMode="decimal" required value={longitude} onChange={(e) => setLongitude(e.target.value)} className={inputClass} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FormField id="fac-x" label="Posisi denah X (%)" hint="Opsional, 0-100">
            <input id="fac-x" inputMode="decimal" value={layoutX} onChange={(e) => setLayoutX(e.target.value)} className={inputClass} />
          </FormField>
          <FormField id="fac-y" label="Posisi denah Y (%)" hint="Opsional, 0-100">
            <input id="fac-y" inputMode="decimal" value={layoutY} onChange={(e) => setLayoutY(e.target.value)} className={inputClass} />
          </FormField>
        </div>
        <SubmitButton isSaving={isSaving} label="Simpan Fasilitas" />
      </form>
    </BottomSheet>
  );
}

/** Edit name, platform, and location detail of an existing facility (PATCH /api/admin/facilities/:id). */
export function FacilityEditSheet({
  facility,
  onClose,
  onSaved,
}: {
  facility: FacilityWithStatus;
  onClose: () => void;
  onSaved: (updated: Facility) => void;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState(facility.name);
  const [platform, setPlatform] = useState(facility.platform ?? '');
  const [locationDetail, setLocationDetail] = useState(facility.locationDetail ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await stationService.updateFacility(facility.id, { name, platform, locationDetail });
      showToast('Data fasilitas diperbarui.', 'success');
      onSaved(updated);
    } catch (err) {
      showToast(adminErrorMessage(err, 'Gagal menyimpan perubahan.'), 'error');
      setIsSaving(false);
    }
  };

  return (
    <BottomSheet isOpen onClose={onClose} title="Edit Fasilitas" description={facility.name}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <FormField id="edit-fac-name" label="Nama fasilitas">
          <input id="edit-fac-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </FormField>
        <FormField id="edit-fac-plat" label="Peron / area">
          <input id="edit-fac-plat" maxLength={120} value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputClass} />
        </FormField>
        <FormField id="edit-fac-loc" label="Detail lokasi">
          <input id="edit-fac-loc" maxLength={300} value={locationDetail} onChange={(e) => setLocationDetail(e.target.value)} className={inputClass} />
        </FormField>
        <SubmitButton isSaving={isSaving} label="Simpan Perubahan" />
      </form>
    </BottomSheet>
  );
}
