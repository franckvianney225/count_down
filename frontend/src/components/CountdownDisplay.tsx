'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/lib/socket';

/* ─── Types ─── */
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
  photoUrl: string | null;
  fonction: string | null;
  structure: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8006';

export type DisplayMode = 'normal' | 'minimal' | 'overlay';

/* ─── Helpers ─── */
function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function isPng(url: string | null): boolean {
  return !!url && url.toLowerCase().endsWith('.png');
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

function formatClock(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/* ─── P9 : Web Audio API ─── */
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch { return null; }
  }
  return audioCtx;
}

function playTone(freq: number, duration: number, delay = 0, volume = 0.35) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration + 0.05);
}

function playAlert(type: '5min' | '1min' | 'end') {
  if (type === '5min') {
    playTone(880, 0.18, 0);
    playTone(880, 0.18, 0.28);
  } else if (type === '1min') {
    playTone(1046, 0.15, 0);
    playTone(1046, 0.15, 0.22);
    playTone(1046, 0.15, 0.44);
  } else {
    playTone(440, 0.45, 0);
    playTone(523, 0.45, 0.55);
    playTone(440, 0.65, 1.1);
  }
}

/* ─── Composant ─── */
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

interface Props {
  mode?: DisplayMode;
}

export default function CountdownDisplay({ mode = 'normal' }: Props) {
  const [session, setSession] = useState<SessionState>(DEFAULT_STATE);
  const [panelists, setPanelists] = useState<PanelistInfo[]>([]);
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const [clock, setClock] = useState('');
  const [phaseKey, setPhaseKey] = useState(0);       // P4 : déclenche l'animation
  const [phaseFlash, setPhaseFlash] = useState(false); // P4 : overlay bref
  const [soundEnabled, setSoundEnabled] = useState(false); // P9
  const [panelistsPanel, setPanelistsPanel] = useState(false);
  const [panelistsAg, setPanelistsAg] = useState(false);
  const [preshow, setPreshow] = useState(false);
  const [spotlightIdx, setSpotlightIdx] = useState(0);
  const [commencer, setCommencer] = useState(false);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const alertedRef = useRef<Set<string>>(new Set());
  const prevPhaseRef = useRef(0);

  /* ─── Socket ─── */
  useEffect(() => {
    const socket = getSocket();
    socket.on('session_state', (data: SessionState) => setSession(data));
    socket.on('panelist_update', (data: PanelistInfo[]) => setPanelists(data));
    socket.on('flash_message', (msg: FlashMessage | null) => {
      setFlash(msg);
      if (msg && msg.duration > 0) setTimeout(() => setFlash(null), msg.duration * 1000);
    });
    socket.on('panelists_panel', (visible: boolean) => setPanelistsPanel(visible));
    socket.on('panelists_ag', (visible: boolean) => setPanelistsAg(visible));
    socket.on('preshow', (visible: boolean) => {
      setPreshow(visible);
      if (visible) setSpotlightIdx(0);
    });
    socket.on('commencer', (visible: boolean) => setCommencer(visible));
    socket.on('background_image', (url: string | null) => setBackgroundImageUrl(url));
    return () => {
      socket.off('session_state');
      socket.off('panelist_update');
      socket.off('flash_message');
      socket.off('panelists_panel');
      socket.off('panelists_ag');
      socket.off('preshow');
      socket.off('commencer');
      socket.off('background_image');
    };
  }, []);

  /* ─── P1 : Horloge ─── */
  useEffect(() => {
    setClock(formatClock(new Date()));
    const id = setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  /* ─── Tick session ─── */
  useEffect(() => {
    if (!session.isActive) return;
    const id = setInterval(() => {
      setSession(prev => ({
        ...prev,
        remainingSeconds: prev.remainingSeconds - 1,
        isOvertime: prev.remainingSeconds - 1 < 0,
      }));
    }, 1000);
    return () => clearInterval(id);
  }, [session.isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── P4 : Détection changement de phase ─── */
  useEffect(() => {
    if (session.currentPhaseIndex !== prevPhaseRef.current) {
      prevPhaseRef.current = session.currentPhaseIndex;
      alertedRef.current.clear(); // reset alertes sonores pour la nouvelle phase
      setPhaseFlash(true);
      setPhaseKey(k => k + 1);
      setTimeout(() => setPhaseFlash(false), 800);
    }
  }, [session.currentPhaseIndex]);

  /* ─── Tick panéliste actif ─── */
  const activePanelist = panelists.find(p => p.isActive) ?? null;
  useEffect(() => {
    if (!activePanelist) return;
    const id = setInterval(() => {
      setPanelists(prev => prev.map(p =>
        p.isActive ? { ...p, remainingSeconds: p.remainingSeconds - 1, usedSeconds: p.usedSeconds + 1 } : p
      ));
    }, 1000);
    return () => clearInterval(id);
  }, [activePanelist?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Preshow : rotation spotlight toutes les 8s ─── */
  useEffect(() => {
    if (!preshow || panelists.length <= 1) return;
    const id = setInterval(() => {
      setSpotlightIdx(prev => {
        const others = panelists.map((_, i) => i).filter(i => i !== prev);
        return others[Math.floor(Math.random() * others.length)];
      });
    }, 8000);
    return () => clearInterval(id);
  }, [preshow, panelists.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── P9 : Alertes sonores ─── */
  useEffect(() => {
    if (!soundEnabled || !session.isActive) return;
    const r = session.remainingSeconds;
    if (r === 300 && !alertedRef.current.has('5min')) {
      alertedRef.current.add('5min');
      playAlert('5min');
    } else if (r === 60 && !alertedRef.current.has('1min')) {
      alertedRef.current.add('1min');
      playAlert('1min');
    } else if (r === 0 && !alertedRef.current.has('end')) {
      alertedRef.current.add('end');
      playAlert('end');
    }
  }, [session.remainingSeconds, session.isActive, soundEnabled]);

  /* ─── P9 : Déblocage audio au clic ─── */
  const unlockAudio = useCallback(() => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    setSoundEnabled(true);
  }, []);

  /* ─── Calculs ─── */
  const hasSession = session.sessionId !== null && session.phases.length > 0;
  const currentPhase = hasSession ? session.phases[session.currentPhaseIndex] : null;
  const nextPhases = hasSession ? session.phases.slice(session.currentPhaseIndex + 1) : [];
  const { remainingSeconds, isActive, isOvertime } = session;

  const showFinalMode = isActive && remainingSeconds >= 0 && remainingSeconds <= 60;
  const showOvertime = isOvertime;
  const isFinished = !isActive && remainingSeconds <= 0 && hasSession && session.currentPhaseIndex === session.phases.length - 1;
  const isWaiting = hasSession && !isActive && session.currentPhaseIndex === 0
    && Math.abs(remainingSeconds - session.currentPhaseDuration) <= 1 && session.currentPhaseDuration > 0;

  /* ─── P2 : Barres de progression ─── */
  const phaseProgress = session.currentPhaseDuration > 0
    ? Math.min(100, Math.max(0, ((session.currentPhaseDuration - Math.max(0, remainingSeconds)) / session.currentPhaseDuration) * 100))
    : 0;
  const globalProgress = session.phases.length > 0
    ? Math.min(100, ((session.currentPhaseIndex) / session.phases.length) * 100)
    : 0;

  const finalBg = remainingSeconds <= 10 ? 'bg-red-600' : remainingSeconds <= 30 ? 'bg-orange-500' : 'bg-black';

  /* ════════════════════════════════════════════
     MODE OVERLAY — fond transparent, minimal
  ═══════════════════════════════════════════ */
  if (mode === 'overlay') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'transparent' }}>
        {hasSession && (
          <>
            <p className="text-white text-xl font-semibold drop-shadow-lg mb-2" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
              {currentPhase?.name}
            </p>
            <div
              className={`font-bold font-mono drop-shadow-2xl ${isOvertime ? 'text-red-400' : 'text-white'}`}
              style={{ fontSize: 'clamp(5rem,18vw,12rem)', lineHeight: 1, textShadow: '0 4px 20px rgba(0,0,0,0.9)' }}
            >
              {formatTime(remainingSeconds)}
            </div>
            {activePanelist && (
              <div className="mt-6 px-8 py-3 rounded-2xl bg-black bg-opacity-60 text-white font-bold text-2xl flex items-center gap-4">
                <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                <span>{activePanelist.name}</span>
                <span className={`font-mono ${activePanelist.remainingSeconds < 0 ? 'text-red-400' : 'text-green-300'}`}>
                  {formatTime(activePanelist.remainingSeconds)}
                </span>
              </div>
            )}
            {flash && (
              <div className="mt-4 max-w-2xl w-full bg-amber-400 text-amber-900 font-bold text-2xl text-center py-4 px-8 rounded-2xl animate-slide-up">
                {flash.text}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  /* ════════════════════════════════════════════
     MODE MINIMAL — fond noir, juste le timer
  ═══════════════════════════════════════════ */
  if (mode === 'minimal') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center select-none">
        {hasSession ? (
          <>
            <p className="text-gray-500 text-lg font-medium uppercase tracking-widest mb-4">
              {currentPhase?.name ?? '—'}
            </p>
            <div
              key={phaseKey}
              className={`font-bold font-mono animate-zoom-once ${isOvertime ? 'text-red-500' : 'text-white'}`}
              style={{ fontSize: 'clamp(8rem, 25vw, 20rem)', lineHeight: 1 }}
            >
              {formatTime(remainingSeconds)}
            </div>
            {hasSession && session.phases.length > 1 && (
              <p className="text-gray-700 text-sm mt-8">
                Phase {session.currentPhaseIndex + 1} / {session.phases.length}
              </p>
            )}
            {showFinalMode && (
              <div className={`fixed inset-0 z-50 flex items-center justify-center ${finalBg}`}>
                <div key={remainingSeconds} className="text-white font-bold animate-zoom-once"
                  style={{ fontSize: '20rem', lineHeight: 1 }}>
                  {remainingSeconds}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-700 text-xl">En attente de configuration…</p>
        )}
      </div>
    );
  }

  /* ════════════════════════════════════════════
     MODE NORMAL
  ═══════════════════════════════════════════ */

  /* ── P6 : Salle d'attente ── */
  if (isWaiting) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        {/* Header salle d'attente */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
          <p className="text-blue-400 text-sm uppercase tracking-widest mb-2">{session.sessionName}</p>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-3">La session commence bientôt</h1>
          <p className="text-gray-500 text-xl mb-12">{clock}</p>

          {/* Agenda */}
          <div className="w-full max-w-xl space-y-2">
            <p className="text-xs text-gray-600 uppercase tracking-widest text-center mb-4">Programme</p>
            {session.phases.map((p, i) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3 rounded-xl bg-gray-900 border border-gray-800">
                <span className="text-gray-600 font-mono text-sm w-5 text-center">{i + 1}</span>
                <span className="flex-1 text-gray-200 font-medium">{p.name}</span>
                <span className="text-gray-500 text-sm">{Math.floor(p.duration / 60)} min</span>
              </div>
            ))}
            <div className="flex items-center justify-center pt-3 text-gray-600 text-sm">
              Durée totale : {Math.floor(session.phases.reduce((s, p) => s + p.duration, 0) / 60)} min
            </div>
          </div>
        </div>

        {flash && (
          <div className="fixed bottom-8 left-0 right-0 flex justify-center px-6 z-[60]">
            <div className="max-w-3xl w-full bg-amber-400 text-amber-900 font-bold text-3xl text-center py-7 px-10 rounded-2xl shadow-2xl border-4 border-amber-500 animate-slide-up">
              {flash.text}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Pas de session configurée ── */
  if (!hasSession) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gray-950"
        style={backgroundImageUrl ? {
          backgroundImage: `url(${API_URL}${backgroundImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        } : undefined}
      >
        {backgroundImageUrl && <div className="absolute inset-0 bg-black/40" />}
        <p className="relative text-gray-400 text-xl">En attente de configuration…</p>
      </div>
    );
  }

  /* ── Vue normale — ancien design ── */
  const hours   = Math.floor(Math.max(0, remainingSeconds) / 3600);
  const minutes = Math.floor((Math.max(0, remainingSeconds) % 3600) / 60);
  const seconds = Math.max(0, remainingSeconds) % 60;
  const hideMain = showFinalMode || isFinished || showOvertime;

  return (
    <div
      className="min-h-screen bg-gray-100 flex flex-col"
      onClick={soundEnabled ? undefined : unlockAudio}
    >
      {/* P4 : Flash de transition de phase */}
      {phaseFlash && (
        <div className="fixed inset-0 z-[70] bg-white pointer-events-none" style={{ opacity: 0.4, transition: 'opacity 0.8s' }} />
      )}

      {/* ── En-tête : P3 nom session + phase + P1 horloge ── */}
      <div className={`py-6 px-6 transition-opacity duration-500 ${hideMain ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex items-start justify-between">
          <div className="text-center flex-1">
            {currentPhase ? (
              <>
                <p className="text-blue-500 text-sm font-medium uppercase tracking-widest mb-1">{session.sessionName}</p>
                <h1 key={`phase-${phaseKey}`} className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent animate-slide-up">
                  {currentPhase.name}
                </h1>
              </>
            ) : (
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent">
                COMPTE À REBOURS
              </h1>
            )}
            <p className="text-gray-500 mt-2 text-lg md:text-xl">Synchronisé en temps réel</p>
          </div>
          {/* P1 : Horloge */}
          <div className="text-right flex-shrink-0 ml-4">
            <p className="text-3xl font-bold font-mono text-gray-400">{clock}</p>
            {!soundEnabled && (
              <p className="text-xs text-gray-400 mt-1">Cliquer pour le son</p>
            )}
          </div>
        </div>

        {/* P2 : Barre de progression globale */}
        {session.phases.length > 1 && (
          <div className="mt-4 max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-400">Phase {session.currentPhaseIndex + 1} / {session.phases.length}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex gap-0.5">
              {session.phases.map((p, i) => (
                <div
                  key={p.id}
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    flex: p.duration,
                    background: i < session.currentPhaseIndex
                      ? '#22c55e'
                      : i === session.currentPhaseIndex
                        ? (isOvertime ? '#ef4444' : remainingSeconds <= 60 ? '#f97316' : '#3b82f6')
                        : '#e5e7eb',
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Blocs temps ── */}
      <div className="flex-grow flex flex-col items-center justify-center py-12 px-4 relative">

        {/* Vue normale : blocs H / M / S */}
        <div className={`flex flex-wrap justify-center gap-4 transition-opacity duration-500 ${hideMain ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <TimeBlock key={`h-${phaseKey}`} value={pad(hours)}   label="HEURES"   color="from-blue-500 to-blue-700" />
          <TimeBlock key={`m-${phaseKey}`} value={pad(minutes)} label="MINUTES"  color="from-purple-500 to-purple-700" />
          <TimeBlock key={`s-${phaseKey}`} value={pad(seconds)} label="SECONDES" color="from-orange-500 to-orange-700" />
        </div>

        {/* P2 : Barre de progression de la phase courante */}
        {!hideMain && (
          <div className="mt-8 w-80 mx-auto">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  isOvertime ? 'bg-red-500' :
                  remainingSeconds <= 60 ? 'bg-orange-500' :
                  remainingSeconds <= 300 ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`}
                style={{ width: `${phaseProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Mode final — 60 dernières secondes */}
        {showFinalMode && (
          <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${finalBg}`}>
            {currentPhase && (
              <p className="text-white text-2xl font-semibold mb-6 opacity-70">{currentPhase.name}</p>
            )}
            <div key={remainingSeconds} className="text-white font-bold animate-zoom-once"
              style={{ fontSize: '12rem', textShadow: '0 0 30px rgba(255,255,255,0.9)', lineHeight: 1 }}>
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
            <p className="text-red-400 text-2xl font-bold uppercase tracking-[0.4em] mb-6 animate-pulse">DÉPASSEMENT</p>
            <div key={remainingSeconds} className="font-bold font-mono animate-zoom-once"
              style={{ fontSize: '10rem', color: '#ff4444', textShadow: '0 0 40px rgba(255,68,68,0.8)', lineHeight: 1 }}>
              {formatTime(remainingSeconds)}
            </div>
          </div>
        )}

        {/* Fin de session */}
        {isFinished && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
            <p className="text-white text-6xl font-bold tracking-widest animate-final-zoom">TERMINÉ</p>
          </div>
        )}

        {/* P5 : Bandeau intervenant */}
        {activePanelist && !flash && (
          <div className="fixed bottom-8 left-0 right-0 flex justify-center px-6 z-[55]">
            <div className={`max-w-2xl w-full rounded-2xl shadow-2xl border-2 overflow-hidden transition-colors duration-1000 ${
              activePanelist.remainingSeconds < 0
                ? 'bg-red-900 border-red-700'
                : activePanelist.remainingSeconds <= 60
                  ? 'bg-orange-800 border-orange-600'
                  : 'bg-gray-800 border-gray-600'
            }`}>
              <div className="flex items-center justify-between px-8 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                  <span className="text-2xl font-bold text-white">{activePanelist.name}</span>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold font-mono ${activePanelist.remainingSeconds < 0 ? 'text-red-400' : 'text-white'}`}>
                    {formatTime(activePanelist.remainingSeconds)}
                  </div>
                  <div className="text-xs text-gray-400">temps {Math.floor(activePanelist.totalSeconds / 60)} min</div>
                </div>
              </div>
              <div className="h-1.5 bg-black bg-opacity-30">
                <div
                  className={`h-full transition-all duration-1000 ${
                    activePanelist.remainingSeconds < 0 ? 'bg-red-500' :
                    activePanelist.remainingSeconds <= 60 ? 'bg-orange-400' : 'bg-green-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, (activePanelist.remainingSeconds / activePanelist.totalSeconds) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Flash message */}
        {flash && (
          <div className="fixed bottom-8 left-0 right-0 flex justify-center px-6 z-[60]">
            <div className="max-w-3xl w-full bg-amber-400 text-amber-900 font-bold text-3xl text-center py-7 px-10 rounded-2xl shadow-2xl border-4 border-amber-500 animate-slide-up leading-snug">
              {flash.text}
            </div>
          </div>
        )}

        {/* Statut */}
        <div className={`mt-10 text-center transition-opacity duration-500 ${hideMain ? 'opacity-0' : 'opacity-100'}`}>
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-50 text-blue-600 text-sm shadow-sm">
            <div className={`w-2 h-2 rounded-full mr-2 ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span>{isActive ? 'Compteur en cours' : 'En attente'}</span>
          </div>
        </div>
      </div>

      {/* Phases à venir */}
      {!hideMain && nextPhases.length > 0 && (
        <div className={`px-6 pb-4 text-center transition-opacity duration-500 ${hideMain ? 'opacity-0' : 'opacity-100'}`}>
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">À venir</p>
          <div className="flex flex-wrap justify-center gap-2">
            {nextPhases.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-full text-sm text-gray-500 shadow-sm">
                <span className="text-gray-400">{session.currentPhaseIndex + i + 2}.</span>
                <span>{p.name}</span>
                <span className="text-gray-400">· {Math.floor(p.duration / 60)} min</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Mode Preshow : spotlight + petits en bas ── */}
      {preshow && panelists.length > 0 && (() => {
        const spotlight = panelists[spotlightIdx] ?? panelists[0];
        const others = panelists.filter((_, i) => i !== (panelists.indexOf(spotlight)));
        return (
          <div className="fixed inset-0 z-[80] bg-white flex flex-col overflow-hidden">
            {/* Motifs décoratifs */}
            <Motifs />
            {/* Zone principale : photo gauche + nom droite */}
            <div className="flex-1 flex items-center gap-12 px-16 py-10 min-h-0">
              {/* Photo spotlight */}
              {spotlight.photoUrl ? (
                isPng(spotlight.photoUrl) ? (
                  <img
                    key={spotlight.id}
                    src={`${API_URL}${spotlight.photoUrl}`}
                    alt={spotlight.name}
                    className="flex-shrink-0 transition-all duration-700 object-contain drop-shadow-2xl"
                    style={{ height: '70vh', maxWidth: '45vw' }}
                  />
                ) : (
                  <div
                    key={spotlight.id}
                    className="flex-shrink-0 rounded-3xl overflow-hidden ring-4 ring-green-400 shadow-2xl transition-all duration-700"
                    style={{ height: '70vh', aspectRatio: '1/1' }}
                  >
                    <img src={`${API_URL}${spotlight.photoUrl}`} alt={spotlight.name} className="w-full h-full object-cover" />
                  </div>
                )
              ) : (
                <div
                  key={spotlight.id}
                  className="flex-shrink-0 rounded-3xl ring-4 ring-green-400 shadow-2xl bg-gray-200 flex items-center justify-center"
                  style={{ height: '70vh', aspectRatio: '1/1' }}
                >
                  <span className="text-gray-500 font-bold" style={{ fontSize: 'clamp(4rem, 15vw, 10rem)' }}>
                    {spotlight.name[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              {/* Nom + fonction + structure */}
              <div key={`name-${spotlight.id}`} className="flex-1 flex flex-col justify-center">
                <div className="flex items-center gap-3 -mt-8 mb-4">
                  <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-green-400 text-sm uppercase tracking-[0.3em]">Intervenant</p>
                </div>
                <h2 className="text-gray-900 font-bold leading-tight uppercase" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}>
                  {spotlight.name}
                </h2>
                {spotlight.fonction && (
                  <p className="text-blue-700 font-medium mt-3 uppercase" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.75rem)' }}>
                    {spotlight.fonction}
                  </p>
                )}
                {spotlight.structure && (
                  <p className="text-gray-500 mt-1 uppercase" style={{ fontSize: 'clamp(0.9rem, 2vw, 1.4rem)' }}>
                    {spotlight.structure}
                  </p>
                )}
              </div>
            </div>
            {/* Barre séparatrice */}
            <div className="h-px bg-black mx-12" />
            {/* Petits intervenants en bas */}
            {others.length > 0 && (
              <div className="flex items-center justify-center gap-6 px-12 py-6">
                {others.map(p => (
                  <div key={p.id} className="flex flex-col items-center gap-2 opacity-70">
                    <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-gray-300">
                      {p.photoUrl ? (
                        <img src={`${API_URL}${p.photoUrl}`} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-500 text-xl font-bold">{p.name[0]?.toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs text-center max-w-[80px] truncate">{p.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Mode Commencer : spotlight sur l'intervenant actif ── */}
      {commencer && panelists.length > 0 && (() => {
        const spotlight = panelists.find(p => p.isActive) ?? panelists[0];
        const others = panelists.filter(p => p.id !== spotlight.id);
        return (
          <div className="fixed inset-0 z-[80] bg-white flex flex-col overflow-hidden">
            {/* Motifs décoratifs */}
            <Motifs />
            <div className="flex-1 flex items-center gap-12 px-16 py-10 min-h-0">
              {spotlight.photoUrl ? (
                isPng(spotlight.photoUrl) ? (
                  <img
                    key={spotlight.id}
                    src={`${API_URL}${spotlight.photoUrl}`}
                    alt={spotlight.name}
                    className="flex-shrink-0 object-contain drop-shadow-2xl"
                    style={{ height: '70vh', maxWidth: '45vw' }}
                  />
                ) : (
                  <div
                    key={spotlight.id}
                    className="flex-shrink-0 rounded-3xl overflow-hidden ring-4 ring-green-400 shadow-2xl"
                    style={{ height: '70vh', aspectRatio: '1/1' }}
                  >
                    <img src={`${API_URL}${spotlight.photoUrl}`} alt={spotlight.name} className="w-full h-full object-cover" />
                  </div>
                )
              ) : (
                <div
                  key={spotlight.id}
                  className="flex-shrink-0 rounded-3xl ring-4 ring-green-400 shadow-2xl bg-gray-200 flex items-center justify-center"
                  style={{ height: '70vh', aspectRatio: '1/1' }}
                >
                  <span className="text-gray-500 font-bold" style={{ fontSize: 'clamp(4rem, 15vw, 10rem)' }}>
                    {spotlight.name[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              <div key={`name-${spotlight.id}`} className="flex-1 flex flex-col justify-center">
                <div className="flex items-center gap-3 -mt-8 mb-4">
                  <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-green-400 text-sm uppercase tracking-[0.3em]">Intervenant actif</p>
                </div>
                <h2 className="text-gray-900 font-bold leading-tight uppercase" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}>
                  {spotlight.name}
                </h2>
                {spotlight.fonction && (
                  <p className="text-blue-700 font-medium mt-3 uppercase" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.75rem)' }}>
                    {spotlight.fonction}
                  </p>
                )}
                {spotlight.structure && (
                  <p className="text-gray-500 mt-1 uppercase" style={{ fontSize: 'clamp(0.9rem, 2vw, 1.4rem)' }}>
                    {spotlight.structure}
                  </p>
                )}
              </div>
            </div>
            <div className="h-px bg-black mx-12" />
            {others.length > 0 && (
              <div className="flex items-center justify-center gap-6 px-12 py-6">
                {others.map(p => (
                  <div key={p.id} className="flex flex-col items-center gap-2 opacity-70">
                    <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-gray-300">
                      {p.photoUrl ? (
                        <img src={`${API_URL}${p.photoUrl}`} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-500 text-xl font-bold">{p.name[0]?.toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs text-center max-w-[80px] truncate">{p.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Mode AG : plein écran intervenants ── */}
      {panelistsAg && (
        <div className="fixed inset-0 z-[80] bg-gray-950 overflow-y-auto">
          <div
            className="grid w-full min-h-full p-8"
            style={{
              gridTemplateColumns: `repeat(${Math.min(panelists.length, 4)}, 1fr)`,
              gap: '2rem',
              alignItems: 'start',
              justifyItems: 'center',
              alignContent: 'center',
            }}
          >
            {panelists.map(p => (
              <div key={p.id} className={`flex flex-col items-center gap-4 w-full ${p.isActive ? 'opacity-100' : 'opacity-80'}`}>
                <div className={`rounded-2xl overflow-hidden w-full ring-4 transition-all ${
                  p.isActive ? 'ring-green-400 shadow-[0_0_40px_rgba(74,222,128,0.4)]' : 'ring-gray-700'
                }`} style={{ aspectRatio: '1/1', maxHeight: '55vh' }}>
                  {p.photoUrl ? (
                    <img
                      src={`${API_URL}${p.photoUrl}`}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <span className="text-gray-400 font-bold" style={{ fontSize: 'clamp(3rem, 10vw, 8rem)' }}>
                        {p.name[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-white font-bold text-center leading-tight"
                  style={{ fontSize: 'clamp(1.1rem, 2.5vw, 2rem)' }}>
                  {p.name}
                </p>
                {p.fonction && (
                  <p className="text-blue-300 text-center font-medium leading-tight"
                    style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1.1rem)' }}>
                    {p.fonction}
                  </p>
                )}
                {p.structure && (
                  <p className="text-gray-500 text-center leading-tight"
                    style={{ fontSize: 'clamp(0.7rem, 1.2vw, 0.95rem)' }}>
                    {p.structure}
                  </p>
                )}
                {p.isActive && (
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-400 text-sm font-semibold uppercase tracking-widest">En cours</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drawer intervenants */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[65] transition-transform duration-500 ease-in-out ${panelistsPanel ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '45vh' }}
      >
        <div className="bg-gray-900 border-t-2 border-blue-600 rounded-t-2xl shadow-2xl h-full overflow-y-auto">
          <div className="px-6 py-4">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-4 text-center">Intervenants</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {panelists.map(p => {
                const overtime = p.remainingSeconds < 0;
                return (
                  <div key={p.id} className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                    p.isActive ? 'bg-green-900 ring-2 ring-green-400' : 'bg-gray-800'
                  }`}>
                    <div className={`w-16 h-16 rounded-full overflow-hidden flex-shrink-0 ring-2 ${
                      p.isActive ? 'ring-green-400' : 'ring-gray-600'
                    }`}>
                      {p.photoUrl ? (
                        <img src={`${API_URL}${p.photoUrl}`} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-600 flex items-center justify-center">
                          <span className="text-white text-2xl font-bold">{p.name[0]?.toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-white text-sm font-semibold text-center leading-tight">{p.name}</p>
                    <p className={`text-xs font-mono font-bold ${overtime ? 'text-red-400' : p.isActive ? 'text-green-300' : 'text-gray-400'}`}>
                      {formatTime(p.remainingSeconds)}
                    </p>
                    {p.isActive && (
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Vagues de fond */}
      <div className={`relative w-full h-48 transition-opacity duration-500 ${hideMain ? 'opacity-0' : 'opacity-100'}`}>
        <svg className="absolute bottom-0 w-full" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320">
          <path fill="#3B82F6" fillOpacity="0.4" d="M0,32L48,69.3C96,107,192,181,288,186.7C384,192,480,128,576,128C672,128,768,192,864,218.7C960,245,1056,235,1152,202.7C1248,171,1344,117,1392,90.7L1440,64L1440,320L0,320Z" />
        </svg>
        <svg className="absolute bottom-0 w-full" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320">
          <path fill="#8B5CF6" fillOpacity="0.35" d="M0,128L48,149.3C96,171,192,213,288,218.7C384,224,480,192,576,165.3C672,139,768,117,864,128C960,139,1056,181,1152,186.7C1248,192,1344,160,1392,144L1440,128L1440,320L0,320Z" />
        </svg>
        <svg className="absolute bottom-0 w-full" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320">
          <path fill="#F97316" fillOpacity="0.25" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,186.7C1248,149,1344,107,1392,85.3L1440,64L1440,320L0,320Z" />
        </svg>
      </div>
    </div>
  );
}

function Motifs() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Haut-gauche */}
      <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-amber-400 opacity-15" />
      <div className="absolute top-16 -left-4 w-14 h-52 rounded-xl bg-blue-600 opacity-10" />
      {/* Haut-droit */}
      <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-amber-400 opacity-10" />
      <div className="absolute -top-4 right-16 w-10 h-44 rounded-xl bg-teal-500 opacity-15" />
      {/* Bas-gauche */}
      <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-teal-500 opacity-10" />
      <div className="absolute bottom-10 left-20 w-36 h-7 rounded-lg bg-blue-600 opacity-10" />
      {/* Bas-droit */}
      <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-blue-600 opacity-10" />
      <div className="absolute bottom-16 right-12 w-7 h-32 rounded-xl bg-amber-400 opacity-15" />
      {/* Accents petits */}
      <div className="absolute top-[12%] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-amber-400 opacity-50" />
      <div className="absolute top-1/2 left-[6%] -translate-y-1/2 w-4 h-4 rounded-full bg-teal-500 opacity-30" />
      <div className="absolute top-1/2 right-[6%] -translate-y-1/2 w-4 h-4 rounded-full bg-blue-600 opacity-30" />
    </div>
  );
}

function TimeBlock({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className={`bg-gradient-to-br ${color} text-white p-10 rounded-xl shadow-lg transform transition-all hover:scale-105 min-w-[200px]`}>
      <div className="text-[12rem] font-bold text-center leading-none animate-pulse-slow">{value}</div>
      <div className="text-3xl font-bold text-center mt-6">{label}</div>
    </div>
  );
}
