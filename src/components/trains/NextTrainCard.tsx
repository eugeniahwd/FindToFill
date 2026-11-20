'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { KRL_LINES } from '@/lib/map/krlLines';
import { formatClock, serviceClock } from '@/lib/trains/clock';
import { directionSlides, type DirectionSlide } from '@/lib/trains/nextTrains';
import { useNow } from './useNow';

export interface NextTrainCardProps {
  stationName: string;
  /** Fixed time for tests; defaults to the live clock. */
  now?: Date;
}

const STORAGE_PREFIX = 'findtofill.nextTrain.';
const LINE_COLORS = new Map(KRL_LINES.map((l) => [l.name, l.color]));

function readStoredKey(stationName: string): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + stationName);
  } catch {
    return null;
  }
}

function storeKey(stationName: string, key: string) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + stationName, key);
  } catch {
    // Storage blocked (private mode): the card still works, it just won't remember.
  }
}

/**
 * One-row card under the station header: the next train per direction, one direction per swipe.
 * Times and positions are estimates from the KAI timetable, never live positions.
 */
export function NextTrainCard({ stationName, now }: NextTrainCardProps) {
  const liveNow = useNow();
  const clock = serviceClock(now ?? liveNow);
  const slides = directionSlides(stationName, clock);
  const keys = slides.map((s) => s.key).join(',');

  const [current, setCurrent] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Restore the last viewed direction for this station.
  useEffect(() => {
    const stored = readStoredKey(stationName);
    const index = Math.max(0, keys.split(',').indexOf(stored ?? ''));
    setCurrent(index);
    const el = scrollerRef.current;
    el?.scrollTo?.({ left: index * el.clientWidth });
  }, [stationName, keys]);

  if (slides.length === 0) return null;

  const show = (index: number) => {
    setCurrent(index);
    storeKey(stationName, slides[index].key);
    const el = scrollerRef.current;
    el?.scrollTo?.({ left: index * el.clientWidth, behavior: 'smooth' });
  };

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    if (index !== current && slides[index]) {
      setCurrent(index);
      storeKey(stationName, slides[index].key);
    }
  };

  return (
    <section aria-label="Kereta berikutnya" className="flex flex-col">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory rounded-xl bg-white shadow-lg border border-slate-200/70 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide) => (
          <SlideView key={slide.key} slide={slide} stationName={stationName} />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {slides.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              aria-label={`Tampilkan arah ${slide.direction}`}
              aria-current={i === current ? 'true' : undefined}
              onClick={() => show(i)}
              className="h-11 w-11 flex items-center justify-center"
            >
              <span
                className={`block h-1.5 rounded-full transition-all ${
                  i === current ? 'w-4 bg-[#011638]' : 'w-1.5 bg-slate-400'
                }`}
              />
            </button>
          ))}
        </div>
        <span className="flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-medium text-slate-500 shadow-sm">
          <Info size={11} aria-hidden="true" />
          <span>perkiraan dari jadwal KAI</span>
        </span>
      </div>
    </section>
  );
}

const SlideView: React.FC<{ slide: DirectionSlide; stationName: string }> = ({ slide, stationName }) => {
  const color = LINE_COLORS.get(slide.line) ?? '#011638';
  const train = slide.train;

  let eta = 'selesai';
  let leftLabel = '';
  if (train) {
    const time = formatClock(train.stop.minute);
    const startsHere = train.stop.prev === null;
    eta =
      train.phase === 'arriving'
        ? `${startsHere ? 'Berangkat' : 'Tiba'} sekarang · ${time}`
        : `±${train.minutesUntil} mnt · ${time}`;
    if (train.phase === 'waiting' && train.stop.prev) {
      leftLabel = `di ${train.stop.prev.name}, berangkat ${formatClock(train.stop.prev.minute)}`;
    } else if (startsHere) {
      leftLabel = `berangkat dari ${stationName}`;
    } else {
      leftLabel = train.stop.prev?.name ?? '';
    }
  }

  return (
    <div
      role="group"
      aria-label={`Kereta berikutnya arah ${slide.direction}`}
      className="w-full shrink-0 snap-center px-3 py-2"
    >
      <div className="flex items-center gap-1.5 text-xs font-bold text-navy">
        <span
          aria-hidden="true"
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-extrabold text-white"
          style={{ backgroundColor: color }}
        >
          {slide.lineCode}
        </span>
        <span className="truncate">→ {slide.direction}</span>
        <span className="ml-auto shrink-0 text-[#00628C]">{eta}</span>
      </div>

      {train ? (
        <>
          <div className="relative mt-1.5 h-3" aria-hidden="true">
            <div className="absolute inset-x-1 top-1 h-[3px] rounded bg-[#C8E6FF]" />
            <div className="absolute left-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-[#011638] bg-white" />
            <div className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-[#011638]" />
            <div
              data-testid="train-icon"
              className="absolute -top-0.5 h-3.5 w-5 rounded-[4px_7px_7px_4px] shadow transition-[left] duration-1000 ease-linear motion-reduce:transition-none"
              style={{ left: `calc(${train.progress * 100}% - ${train.progress * 20}px)`, backgroundColor: color }}
            />
          </div>
          <div className="mt-0.5 flex justify-between gap-2 text-[10px] text-slate-500">
            <span className="truncate">{leftLabel}</span>
            <span className="shrink-0">{stationName}</span>
          </div>
        </>
      ) : (
        <p className="mt-1 text-[11px] text-slate-500">
          Layanan hari ini selesai · kereta pertama {slide.firstTrainTime ?? '-'}
        </p>
      )}
    </div>
  );
};
