'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  MapPin,
  ChevronDown,
  Navigation,
  AlertTriangle,
  Clock,
  Compass,
  Footprints,
  HelpCircle,
} from 'lucide-react';
import { useLocation } from '@/context/LocationContext';
import { chatbotService, getChatSessionId } from '@/lib/services/chatbotService';
import { QUICK_MESSAGES } from '@/lib/chatbot/quickMessages';
import type { ChatCard, ChatResponse, DetectedStation, QuickMessageId } from '@/lib/chatbot/contract';
import { StatusBadge } from '@/components/common/StatusBadge';
import { StationPickerSheet } from '@/components/layout/StationPickerSheet';
import { formatDistance } from '@/lib/utils/geo';
import { formatTimeAgo } from '@/lib/utils/status';

const WELCOME_MESSAGE =
  'Halo! Saya asisten fasilitas Stasiun KRL. Pilih salah satu pertanyaan cepat di bawah. Jawaban saya diambil dari data fasilitas dan laporan penumpang.';
const SCHEDULE_REMINDER =
  'Perhatikan papan informasi stasiun untuk jadwal kedatangan KRL terkini.';

interface ChatTurn {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  cards?: ChatCard[];
  detectedStation?: DetectedStation | null;
  scheduleReminder?: boolean;
  showMapLink?: boolean;
  retryAfterSec?: number;
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} detik`;
  return `${Math.ceil(seconds / 60)} menit`;
}

function toBotTurn(status: number, response: ChatResponse): ChatTurn {
  const isRateLimited = status === 429;
  return {
    id: `turn-bot-${Date.now()}`,
    sender: 'bot',
    text: response.message,
    cards: response.outcome === 'answered' ? response.cards.slice(0, 3) : [],
    detectedStation: response.detectedStation,
    scheduleReminder: response.scheduleReminder,
    showMapLink: response.outcome === 'fallback_ai_unavailable',
    retryAfterSec: isRateLimited ? response.retryAfterSec : undefined,
  };
}

export default function ChatbotPage() {
  const { selectedStation, coords, isStationPickedManually, isFarFromPilotStations, setShowStationPicker } =
    useLocation();

  const [conversation, setConversation] = useState<ChatTurn[]>([
    { id: 'welcome-1', sender: 'bot', text: WELCOME_MESSAGE },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [confirmedTurnIds, setConfirmedTurnIds] = useState<ReadonlySet<string>>(new Set());
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const listRef = useRef<HTMLDivElement>(null);

  // Scroll the message list only (scrollIntoView would also scroll the page and hide the header).
  useEffect(() => {
    const list = listRef.current;
    list?.scrollTo?.({ top: list.scrollHeight, behavior: 'smooth' });
  }, [conversation, isThinking]);

  // Tick once a second while rate limited, so the countdown and the buttons update.
  useEffect(() => {
    if (cooldownUntil === null) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= cooldownUntil) setCooldownUntil(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  const cooldownLeftSec =
    cooldownUntil !== null ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0;
  const isDisabled = isThinking || cooldownLeftSec > 0;

  const handleSendQuickMessage = async (msgId: QuickMessageId, msgText: string) => {
    if (isDisabled) return;

    setConversation((prev) => [
      ...prev,
      { id: `turn-user-${Date.now()}`, sender: 'user', text: msgText },
    ]);
    setIsThinking(true);

    // GPS decides the station only when it is at a pilot station. Otherwise send the station the
    // app shows (picked by hand, default without GPS, or the nearest one when GPS is far away).
    const sendStationId = isStationPickedManually || coords === null || isFarFromPilotStations;
    const { status, response } = await chatbotService.ask({
      quickMessageId: msgId,
      coords,
      stationId: sendStationId ? selectedStation.id : null,
      sessionId: getChatSessionId(),
    });

    const botTurn = toBotTurn(status, response);
    setConversation((prev) => [...prev, botTurn]);
    setIsThinking(false);

    if (botTurn.retryAfterSec && botTurn.retryAfterSec > 0) {
      const start = Date.now();
      setNow(start);
      setCooldownUntil(start + botTurn.retryAfterSec * 1000);
    }
    if (response.needsStationSelection) setShowStationPicker(true);
  };

  const confirmStation = (turnId: string) => {
    setConfirmedTurnIds((prev) => new Set(prev).add(turnId));
  };

  return (
    // Pinned between the top of the screen and the bottom nav: the page itself never scrolls, only
    // the message list does, so the header stays visible on phones.
    <div className="fixed inset-x-0 top-0 bottom-[var(--bottom-nav-height)] z-10 w-full max-w-md mx-auto flex flex-col overflow-hidden bg-page-tint">
      {/* Top Bar with Station Chip & Change Button */}
      <header className="p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] bg-white border-b border-slate-200 shadow-xs flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#011638] text-[#FFD233] flex items-center justify-center shrink-0">
            <Bot size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Asisten Stasiun
            </div>
            <div className="text-xs font-bold text-navy truncate flex items-center gap-1">
              <MapPin size={12} className="text-[#00628C]" aria-hidden="true" />
              Stasiun {selectedStation.name}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowStationPicker(true)}
          className="min-touch-target px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
        >
          <span>Ganti</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </header>

      {/* Chat Messages Stream */}
      <div
        ref={listRef}
        role="log"
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 flex flex-col gap-3.5"
        aria-live="polite"
      >
        {conversation.map((turn) => {
          const isBot = turn.sender === 'bot';
          const station = turn.detectedStation;
          const askConfirmation = station?.needsConfirmation && !confirmedTurnIds.has(turn.id);

          return (
            <div
              key={turn.id}
              className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}
            >
              {isBot && station && (
                <span className="mb-1 text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                  <MapPin size={11} className="text-[#00628C]" aria-hidden="true" />
                  Stasiun {station.name} ·{' '}
                  {station.source === 'gps' ? 'terdeteksi lewat GPS' : 'dipilih manual'}
                </span>
              )}

              {/* Message Bubble */}
              <div
                className={`max-w-[88%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                  isBot
                    ? 'bg-white text-navy border border-slate-100 rounded-tl-xs'
                    : 'bg-[#011638] text-white rounded-tr-xs'
                }`}
              >
                {turn.text}
                {turn.retryAfterSec !== undefined && turn.retryAfterSec > 0 && (
                  <span className="block mt-1 text-slate-500">
                    Coba lagi dalam {formatWait(turn.retryAfterSec)}.
                  </span>
                )}
              </div>

              {/* GPS is near more than one pilot station: let the user confirm or change it */}
              {askConfirmation && station && (
                <div className="max-w-[88%] mt-2 p-2.5 rounded-xl bg-white border border-slate-200 text-navy text-[11px] flex flex-col gap-2">
                  <span className="font-medium flex items-center gap-1.5">
                    <HelpCircle size={14} className="text-[#00628C] shrink-0" aria-hidden="true" />
                    Apakah Anda di Stasiun {station.name}?
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => confirmStation(turn.id)}
                      className="min-touch-target flex-1 px-3 py-1.5 rounded-xl bg-[#00628C] text-white font-semibold hover:bg-[#004e70]"
                    >
                      Ya, benar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowStationPicker(true)}
                      className="min-touch-target flex-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
                    >
                      Ganti stasiun
                    </button>
                  </div>
                </div>
              )}

              {turn.scheduleReminder && (
                <div className="max-w-[88%] mt-2 p-2.5 rounded-xl bg-[#FFF8D6] border border-[#FFD233]/40 text-navy text-[11px] font-medium flex items-center gap-2">
                  <AlertTriangle size={15} className="text-[#9A6700] shrink-0" aria-hidden="true" />
                  <span>{SCHEDULE_REMINDER}</span>
                </div>
              )}

              {turn.cards?.map((card) => (
                <FacilityCard key={card.facilityId} card={card} />
              ))}

              {turn.showMapLink && (
                <div className="mt-2">
                  <a
                    href="/map"
                    className="min-touch-target px-4 py-2 bg-[#FFD233] text-[#011638] font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5"
                  >
                    <Compass size={14} aria-hidden="true" />
                    <span>Buka Peta Stasiun</span>
                  </a>
                </div>
              )}
            </div>
          );
        })}

        {isThinking && (
          <div
            role="status"
            className="flex items-center gap-2 self-start bg-white px-4 py-2.5 rounded-2xl border border-slate-100 text-xs text-slate-500 shadow-xs animate-pulse"
          >
            <Bot size={15} className="text-[#00628C] animate-spin" aria-hidden="true" />
            <span>Sedang memeriksa data stasiun...</span>
          </div>
        )}
      </div>

      {/* Quick-message buttons only (no free text input) */}
      <footer className="p-3 bg-white border-t border-slate-200 shrink-0 flex flex-col gap-2">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
          Pilih Pertanyaan Cepat:
        </span>
        {cooldownLeftSec > 0 && (
          <span className="text-[11px] font-medium text-[#9A6700]">
            Terlalu banyak permintaan. Tombol aktif lagi dalam {formatWait(cooldownLeftSec)}.
          </span>
        )}

        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
          {Object.values(QUICK_MESSAGES).map((msg) => (
            <button
              key={msg.id}
              type="button"
              disabled={isDisabled}
              onClick={() => handleSendQuickMessage(msg.id, msg.text)}
              className="min-touch-target text-left px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#C8E6FF]/30 hover:border-[#00628C]/40 text-xs font-semibold text-navy transition-all active:scale-98 disabled:opacity-50"
            >
              {msg.text}
            </button>
          ))}
        </div>
      </footer>

      <StationPickerSheet />
    </div>
  );
}

const FacilityCard: React.FC<{ card: ChatCard }> = ({ card }) => {
  const platform = card.platform && /^\d+$/.test(card.platform) ? `Peron ${card.platform}` : card.platform;
  const location = [platform, card.locationDetail, card.level].filter(Boolean).join(' · ');
  const distance = formatDistance(card.distanceM);

  return (
    <div className="max-w-[88%] w-full mt-2 bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-navy">{card.name}</h4>
          {location && <p className="text-[11px] text-slate-500 mt-0.5">{location}</p>}
        </div>
        <div className="text-right shrink-0">
          <span
            className="text-xs font-bold text-[#00628C] block"
            title={card.distanceIsApproximate ? 'Perkiraan dari pusat stasiun' : undefined}
          >
            {card.distanceIsApproximate ? `± ${distance}` : distance}
          </span>
          {card.distanceIsApproximate && (
            <span className="text-[10px] text-slate-400 block">perkiraan</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-slate-50">
        <StatusBadge status={card.status} size="sm" />
        <span className="text-[11px] text-slate-400 flex items-center gap-2">
          <span className="flex items-center gap-1">
            <Footprints size={11} aria-hidden="true" />
            {card.walkTimeMin} mnt
          </span>
          <span className="flex items-center gap-1">
            <Clock size={11} aria-hidden="true" />
            {formatTimeAgo(card.lastReportedAt)}
          </span>
        </span>
      </div>

      <a
        href="/map"
        className="min-touch-target py-1.5 px-3 rounded-xl bg-[#00628C] text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#004e70]"
      >
        <Navigation size={13} aria-hidden="true" />
        <span>Petunjuk Arah</span>
      </a>
    </div>
  );
};
