'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  MapPin,
  ChevronDown,
  Navigation,
  Image as ImageIcon,
  AlertTriangle,
  Clock,
  Compass,
} from 'lucide-react';
import { useLocation } from '@/context/LocationContext';
import { chatbotService } from '@/lib/services/chatbotService';
import { QUICK_MESSAGES } from '@/lib/mock/data';
import { QuickMessageId, ChatResponse, ChatAnswerCard } from '@/lib/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { BottomSheet } from '@/components/common/BottomSheet';
import { formatDistance } from '@/lib/utils/geo';
import { formatTimeAgo } from '@/lib/utils/status';

interface ChatTurn {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  card?: ChatAnswerCard;
  scheduleReminder?: boolean;
  isFallback?: boolean;
}

export default function ChatbotPage() {
  const { selectedStation, coords, setShowStationPicker } = useLocation();

  const [conversation, setConversation] = useState<ChatTurn[]>([
    {
      id: 'welcome-1',
      sender: 'bot',
      text: `Halo! Saya AI Asisten fasilitas Stasiun KRL. Saat ini Anda berada di area Stasiun ${selectedStation.name}. Pilih salah satu pesan cepat di bawah untuk mendapatkan informasi akurat langsung dari data lapangan:`,
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [simulateFallback, setSimulateFallback] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, isThinking]);

  const handleSendQuickMessage = async (msgId: QuickMessageId, msgText: string) => {
    if (isThinking) return;

    // Add user bubble
    const userTurn: ChatTurn = {
      id: `turn-user-${Date.now()}`,
      sender: 'user',
      text: msgText,
    };
    setConversation((prev) => [...prev, userTurn]);
    setIsThinking(true);

    try {
      const response: ChatResponse = await chatbotService.ask(
        msgId,
        coords,
        selectedStation.id,
        simulateFallback
      );

      const botTurn: ChatTurn = {
        id: `turn-bot-${Date.now()}`,
        sender: 'bot',
        text: response.message,
        card: response.card,
        scheduleReminder: response.scheduleReminder,
        isFallback: response.outcome === 'fallback_ai_unavailable',
      };

      setConversation((prev) => [...prev, botTurn]);
    } catch {
      setConversation((prev) => [
        ...prev,
        {
          id: `turn-bot-err-${Date.now()}`,
          sender: 'bot',
          text: 'Layanan AI sedang tidak tersedia. Silakan cek peta untuk melihat fasilitas terdekat.',
          isFallback: true,
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100dvh-4.5rem)] relative overflow-hidden bg-page-tint">
      {/* Top Bar with Detected Station Chip & Change Button */}
      <header className="p-3 bg-white border-b border-slate-200 shadow-xs flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#011638] text-[#FFD233] flex items-center justify-center shrink-0">
            <Bot size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Asisten Stasiun
            </div>
            <div className="text-xs font-bold text-navy truncate flex items-center gap-1">
              <MapPin size={12} className="text-[#00628C]" />
              Stasiun {selectedStation.name}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick toggle to demonstrate Fallback State */}
          <button
            onClick={() => setSimulateFallback((prev) => !prev)}
            className={`text-[10px] px-2 py-1 rounded-lg border font-medium ${
              simulateFallback
                ? 'bg-red-50 text-red-600 border-red-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
            title="Uji coba mode fallback saat layanan AI offline"
          >
            {simulateFallback ? 'Simulasi: Fallback ON' : 'AI Online'}
          </button>

          <button
            onClick={() => setShowStationPicker(true)}
            className="min-touch-target px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <span>Change</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </header>

      {/* Chat Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5">
        {conversation.map((turn) => {
          const isBot = turn.sender === 'bot';

          return (
            <div
              key={turn.id}
              className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}
            >
              {/* Message Bubble */}
              <div
                className={`max-w-[88%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                  isBot
                    ? 'bg-white text-navy border border-slate-100 rounded-tl-xs'
                    : 'bg-[#011638] text-white rounded-tr-xs'
                }`}
              >
                {turn.text}
              </div>

              {/* Schedule Reminder hint if train schedule was consulted */}
              {turn.scheduleReminder && (
                <div className="max-w-[88%] mt-2 p-2.5 rounded-xl bg-[#FFF8D6] border border-[#FFD233]/40 text-navy text-[11px] font-medium flex items-center gap-2">
                  <AlertTriangle size={15} className="text-[#9A6700] shrink-0" />
                  <span>
                    Perhatikan papan informasi stasiun untuk jadwal kedatangan KRL terkini.
                  </span>
                </div>
              )}

              {/* ONE Answer Card returned by the assistant */}
              {turn.card && (
                <div className="max-w-[88%] w-full mt-2 bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-navy">
                        {turn.card.facilityName}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {turn.card.locationDetail}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[#00628C] shrink-0">
                      {formatDistance(turn.card.distanceMeters)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-50">
                    <StatusBadge status={turn.card.status} size="sm" />
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock size={11} />
                      {formatTimeAgo(turn.card.lastReportedAt)}
                    </span>
                  </div>

                  {/* Actions: Petunjuk Arah & Lihat Foto */}
                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href="/map"
                      className="min-touch-target flex-1 py-1.5 px-3 rounded-xl bg-[#00628C] text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#004e70]"
                    >
                      <Navigation size={13} />
                      <span>Petunjuk Arah</span>
                    </a>

                    {turn.card.photoUrl && (
                      <button
                        onClick={() => setSelectedPhoto(turn.card!.photoUrl!)}
                        className="min-touch-target py-1.5 px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 hover:bg-slate-200"
                      >
                        <ImageIcon size={13} />
                        <span>Lihat Foto</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Fallback Action Button */}
              {turn.isFallback && (
                <div className="mt-2">
                  <a
                    href="/map"
                    className="min-touch-target px-4 py-2 bg-[#FFD233] text-[#011638] font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5"
                  >
                    <Compass size={14} />
                    <span>Buka Peta Stasiun</span>
                  </a>
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isThinking && (
          <div className="flex items-center gap-2 self-start bg-white px-4 py-2.5 rounded-2xl border border-slate-100 text-xs text-slate-500 shadow-xs animate-pulse">
            <Bot size={15} className="text-[#00628C] animate-spin" />
            <span>Sedang memeriksa data stasiun...</span>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Bottom Fixed Quick-Message Buttons Palette (NO FREE TEXT INPUT) */}
      <footer className="p-3 bg-white border-t border-slate-200 shrink-0 flex flex-col gap-2">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
          Pilih Pertanyaan Cepat:
        </span>

        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
          {QUICK_MESSAGES.map((msg) => (
            <button
              key={msg.id}
              disabled={isThinking}
              onClick={() => handleSendQuickMessage(msg.id, msg.text)}
              className="min-touch-target text-left px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#C8E6FF]/30 hover:border-[#00628C]/40 text-xs font-semibold text-navy transition-all active:scale-98 disabled:opacity-50"
            >
              {msg.text}
            </button>
          ))}
        </div>
      </footer>

      {/* Photo Preview Modal */}
      {selectedPhoto && (
        <BottomSheet
          isOpen={!!selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          title="Foto Kondisi Lapangan"
          description="Foto asli yang diambil oleh penumpang di stasiun"
        >
          <div className="rounded-2xl overflow-hidden aspect-video bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPhoto}
              alt="Bukti foto fasilitas"
              className="w-full h-full object-cover"
            />
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
