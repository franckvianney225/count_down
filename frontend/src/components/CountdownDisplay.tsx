'use client';

import { useState, useEffect } from 'react';
import { getSocket } from '@/lib/socket';

interface PhaseInfo {
  id: number;
  name: string;
  duration: number;
  order: number;
}

interface SessionState {
  sessionId: number | null;
  sessionName: string;
  phases: PhaseInfo[];
  currentPhaseIndex: number;
  remainingSeconds: number;
  currentPhaseDuration: number;
  isActive: boolean;
  isOvertime: boolean;
}

interface FlashMessage {
  text: string;
  duration: number;
}

interface PanelistInfo {
  id: number;
  name: string;
  totalSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  isActive: boolean;
  order: number;
}

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function formatTime(totalSec: number): string {
  const abs = Math.abs(totalSec);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const sign = totalSec < 0 ? '-' : '';
  if (h > 0) return `${sign}${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${sign}${pad(m)}:${pad(s)}`;
}

const DEFAULT_STATE: SessionState = {
  sessionId: null,
  sessionName: 'Session',
  phases: [],
  currentPhaseIndex: 0,
  remainingSeconds: 0,
  currentPhaseDuration: 0,
  isActive: false,
  isOvertime: false,
};

export default function CountdownDisplay() {
  const [state, setState] = useState<SessionState>(DEFAULT_STATE);
  const [flashMessage, setFlashMessage] = useState<FlashMessage | null>(null);
  const [panelists, setPanelists] = useState<PanelistInfo[]>([]);

  useEffect(() => {
    const socket = getSocket();
    socket.on('session_state', (data: SessionState) => setState(data));
    socket.on('panelist_update', (data: PanelistInfo[]) => setPanelists(data));
    socket.on('flash_message', (msg: FlashMessage | null) => {
      setFlashMessage(msg);
      if (msg && msg.duration > 0) {
        setTimeout(() => setFlashMessage(null), msg.duration * 1000);
      }
    });
    return () => {
      socket.off('session_state');
      socket.off('panelist_update');
      socket.off('flash_message');
    };
  }, []);

  // Tick local session — continue même en overtime
  useEffect(() => {
    if (!state.isActive) return;
    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        remainingSeconds: prev.remainingSeconds - 1,
        isOvertime: prev.remainingSeconds - 1 < 0,
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [state.isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick local panéliste actif
  const activePanelist = panelists.find(p => p.isActive) ?? null;
  useEffect(() => {
    if (!activePanelist) return;
    const interval = setInterval(() => {
      setPanelists(prev => prev.map(p =>
        p.isActive
          ? { ...p, remainingSeconds: p.remainingSeconds - 1, usedSeconds: p.usedSeconds + 1 }
          : p
      ));
    }, 1000);
    return () => clearInterval(interval);
  }, [activePanelist?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { remainingSeconds, isActive, isOvertime, phases, currentPhaseIndex, sessionName } = state;
  const hasSession = state.sessionId !== null && phases.length > 0;
  const currentPhase = hasSession ? phases[currentPhaseIndex] : null;
  const nextPhases = hasSession ? phases.slice(currentPhaseIndex + 1) : [];

  const showFinalMode = isActive && remainingSeconds > 0 && remainingSeconds <= 60;
  const showOvertime = isOvertime;
  const isFinished = !isActive && remainingSeconds <= 0 && hasSession;

  const finalBg =
    remainingSeconds <= 10 ? 'bg-red-600' :
    remainingSeconds <= 30 ? 'bg-orange-500' :
    'bg-black';

  const hideMain = showFinalMode || isFinished || showOvertime;

  if (!hasSession) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 text-xl">En attente de configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col text-white">

      {/* En-tête : nom session + phase courante */}
      <div className={`pt-10 pb-4 px-6 text-center transition-opacity duration-500 ${hideMain ? 'opacity-0' : 'opacity-100'}`}>
        <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-1">{sessionName}</p>
        <h1 className="text-4xl md:text-6xl font-bold text-white">
          {currentPhase?.name ?? '—'}
        </h1>
      </div>

      {/* Compteur principal */}
      <div className="flex-grow flex flex-col items-center justify-center py-8 px-4 relative">

        {/* Affichage normal */}
        <div className={`transition-opacity duration-500 ${hideMain ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div
            className={`font-bold font-mono text-center transition-colors duration-500 ${
              isActive ? 'text-white' : 'text-gray-500'
            }`}
            style={{ fontSize: 'clamp(6rem, 20vw, 14rem)', lineHeight: 1 }}
          >
            {formatTime(remainingSeconds)}
          </div>

          {/* Statut */}
          <div className="mt-6 text-center">
            <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm ${
              isActive ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              {isActive ? 'En cours' : 'En pause'}
            </div>
          </div>
        </div>

        {/* Mode final — 60 dernières secondes */}
        {showFinalMode && (
          <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${finalBg}`}>
            {currentPhase && (
              <p className="text-white text-2xl font-semibold mb-6 opacity-80">{currentPhase.name}</p>
            )}
            <div
              key={remainingSeconds}
              className="text-white font-bold animate-zoom-once"
              style={{ fontSize: '12rem', textShadow: '0 0 30px rgba(255,255,255,0.9)', lineHeight: 1 }}
            >
              {remainingSeconds}
            </div>
          </div>
        )}

        {/* Mode OVERTIME */}
        {showOvertime && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-red-950">
            {currentPhase && (
              <p className="text-red-300 text-xl font-semibold mb-2 opacity-80">{currentPhase.name}</p>
            )}
            <p className="text-red-400 text-2xl font-bold uppercase tracking-[0.4em] mb-6 animate-pulse">
              DÉPASSEMENT
            </p>
            <div
              key={remainingSeconds}
              className="font-bold animate-zoom-once"
              style={{
                fontSize: '10rem',
                color: '#ff4444',
                textShadow: '0 0 40px rgba(255,68,68,0.8)',
                lineHeight: 1,
              }}
            >
              {formatTime(remainingSeconds)}
            </div>
          </div>
        )}

        {/* Bandeau panéliste actif */}
        {activePanelist && !flashMessage && (
          <div className="fixed bottom-8 left-0 right-0 flex justify-center px-6 z-[55]">
            <div className={`max-w-2xl w-full flex items-center justify-between px-8 py-4 rounded-2xl shadow-2xl border-2 ${
              activePanelist.remainingSeconds < 0
                ? 'bg-red-900 border-red-700 text-white'
                : activePanelist.remainingSeconds <= 60
                  ? 'bg-orange-800 border-orange-600 text-white'
                  : 'bg-gray-800 border-gray-600 text-white'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                <span className="text-2xl font-bold">{activePanelist.name}</span>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold font-mono ${activePanelist.remainingSeconds < 0 ? 'text-red-400' : ''}`}>
                  {formatTime(activePanelist.remainingSeconds)}
                </div>
                <div className="text-xs text-gray-400">
                  budget {Math.floor(activePanelist.totalSeconds / 60)} min
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Message flash */}
        {flashMessage && (
          <div className="fixed bottom-8 left-0 right-0 flex justify-center px-6 z-[60]">
            <div className="max-w-3xl w-full bg-amber-400 text-amber-900 font-bold text-3xl text-center py-7 px-10 rounded-2xl shadow-2xl border-4 border-amber-500 animate-slide-up leading-snug">
              {flashMessage.text}
            </div>
          </div>
        )}

        {/* Écran fin de session */}
        {isFinished && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
            <p className="text-white text-6xl font-bold tracking-widest animate-final-zoom">
              TERMINÉ
            </p>
          </div>
        )}
      </div>

      {/* Phases à venir */}
      {!hideMain && nextPhases.length > 0 && (
        <div className="px-6 pb-8">
          <p className="text-gray-600 text-xs uppercase tracking-widest text-center mb-3">Phases à venir</p>
          <div className="flex flex-wrap justify-center gap-2">
            {nextPhases.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-full text-sm text-gray-300">
                <span className="text-gray-600">{currentPhaseIndex + i + 2}.</span>
                <span>{p.name}</span>
                <span className="text-gray-500">· {Math.floor(p.duration / 60)} min</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
