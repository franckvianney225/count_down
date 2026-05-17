'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { apiCall } from '@/lib/api';
import SessionSetup from './SessionSetup';
import PanelistManager, { PanelistInfo } from './PanelistManager';
import TemplateManager from './TemplateManager';

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

interface ApiError extends Error {
  status?: number;
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

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
        <p className="text-gray-700 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-all">
            Annuler
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-all">
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [panelists, setPanelists] = useState<PanelistInfo[]>([]);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | { label: string; action: () => void }>(null);
  const [messageText, setMessageText] = useState('');
  const [messageDuration, setMessageDuration] = useState(10);

  useEffect(() => {
    apiCall('/auth/me')
      .then(() => {
        setAuthChecked(true);
        const socket = getSocket();
        socket.on('session_state', (data: SessionState) => setSessionState(data));
        socket.on('panelist_update', (data: PanelistInfo[]) => setPanelists(data));
      })
      .catch(() => router.push('/admin/login'));

    return () => {
      getSocket().off('session_state');
      getSocket().off('panelist_update');
    };
  }, [router]);

  // Tick local session
  useEffect(() => {
    if (!sessionState?.isActive) return;
    const interval = setInterval(() => {
      setSessionState(prev => prev ? {
        ...prev,
        remainingSeconds: prev.remainingSeconds - 1,
        isOvertime: prev.remainingSeconds - 1 < 0,
      } : null);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionState?.isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick local panéliste actif
  const activePanelist = panelists.find(p => p.isActive) ?? null;
  useEffect(() => {
    if (!activePanelist) return;
    const interval = setInterval(() => {
      setPanelists(prev => prev.map(p =>
        p.isActive ? { ...p, remainingSeconds: p.remainingSeconds - 1, usedSeconds: p.usedSeconds + 1 } : p
      ));
    }, 1000);
    return () => clearInterval(interval);
  }, [activePanelist?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const showFeedback = (text: string, ok = true) => {
    setFeedback({ text, ok });
    setTimeout(() => setFeedback(null), 3000);
  };

  const sessionAction = async (endpoint: string) => {
    setLoading(endpoint);
    const method = endpoint === 'delete' ? 'DELETE' : 'POST';
    const path = endpoint === 'delete' ? '/session' : `/session/${endpoint}`;
    try {
      await apiCall(path, { method });
      showFeedback('Opération réussie');
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 401 || e.status === 403) router.push('/admin/login');
      else showFeedback(e.message || 'Erreur serveur', false);
    } finally {
      setLoading(null);
    }
  };

  const timerAction = async (endpoint: string, body?: object) => {
    setLoading(endpoint);
    try {
      await apiCall(`/timer/${endpoint}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 401 || e.status === 403) router.push('/admin/login');
      else showFeedback(e.message || 'Erreur serveur', false);
    } finally {
      setLoading(null);
    }
  };

  const handleLogout = async () => {
    await apiCall('/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/admin/login');
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Vérification de la session...</p>
      </div>
    );
  }

  const hasSession = sessionState && sessionState.sessionId !== null && sessionState.phases.length > 0;
  const remaining = sessionState?.remainingSeconds ?? 0;
  const isOvertime = sessionState?.isOvertime ?? false;
  const isActive = sessionState?.isActive ?? false;
  const currentPhase = hasSession ? sessionState!.phases[sessionState!.currentPhaseIndex] : null;
  const isFirstPhase = (sessionState?.currentPhaseIndex ?? 0) === 0;
  const isLastPhase = hasSession ? sessionState!.currentPhaseIndex === sessionState!.phases.length - 1 : true;

  return (
    <>
      {confirmAction && (
        <ConfirmModal
          message={confirmAction.label}
          onConfirm={() => { setConfirmAction(null); confirmAction.action(); }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      <div className="min-h-screen bg-gray-50 flex flex-col">

        {/* Header */}
        <header className="bg-gradient-to-r from-blue-700 to-indigo-800 px-6 py-4 flex items-center justify-between shadow-md flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-white">Administration</h1>
            <p className="text-blue-200 text-xs">
              {hasSession ? sessionState!.sessionName : 'Aucune session configurée'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {feedback && (
              <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${
                feedback.ok ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
              }`}>
                {feedback.text}
              </span>
            )}
            <button onClick={handleLogout} className="px-4 py-2 text-sm text-white bg-red-500 bg-opacity-80 rounded-lg hover:bg-opacity-100 transition-all font-medium">
              Déconnexion
            </button>
          </div>
        </header>

        {/* Contenu — deux colonnes */}
        <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">

          {/* ── Colonne gauche : Timer + Contrôles + Intervenants ── */}
          <div className="space-y-5">

            {/* Timer */}
            <Section title="Timer">
              {hasSession ? (
                <div className={`rounded-xl p-5 text-center transition-colors duration-500 ${isOvertime ? 'bg-red-950' : 'bg-gray-900'}`}>
                  <p className={`text-xs uppercase tracking-widest mb-1 ${isOvertime ? 'text-red-400 animate-pulse' : 'text-gray-400'}`}>
                    {isOvertime ? 'DÉPASSEMENT' : (currentPhase?.name ?? 'Phase')}
                  </p>
                  <div className={`text-6xl font-bold font-mono tracking-wider ${isOvertime ? 'text-red-400' : 'text-white'}`}>
                    {formatTime(remaining)}
                  </div>
                  <div className={`mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    isOvertime ? 'bg-red-900 text-red-300' :
                    isActive ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
                      isOvertime ? 'bg-red-400 animate-pulse' :
                      isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                    }`} />
                    {isOvertime ? 'Overtime' : isActive ? 'En cours' : 'En pause'}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl p-6 bg-gray-50 border-2 border-dashed border-gray-200 text-center">
                  <p className="text-gray-400 text-sm">Configurez des phases pour démarrer</p>
                </div>
              )}

              {/* Contrôles navigation + start/stop */}
              {hasSession && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setConfirmAction({ label: 'Revenir à la phase précédente ?', action: () => sessionAction('prev') })}
                    disabled={!!loading || isFirstPhase}
                    className="py-2.5 text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 rounded-lg transition-all"
                  >
                    ← Préc.
                  </button>
                  <button
                    onClick={() => sessionAction(isActive ? 'stop' : 'start')}
                    disabled={!!loading}
                    className={`py-2.5 text-sm font-bold text-white rounded-lg disabled:opacity-60 transition-all ${
                      isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {loading === 'start' || loading === 'stop' ? '...' : isActive ? 'Pause' : 'Démarrer'}
                  </button>
                  <button
                    onClick={() => setConfirmAction({ label: 'Passer à la phase suivante ?', action: () => sessionAction('next') })}
                    disabled={!!loading || isLastPhase}
                    className="py-2.5 text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 rounded-lg transition-all"
                  >
                    Suiv. →
                  </button>
                </div>
              )}

              {hasSession && (
                <button
                  onClick={() => setConfirmAction({ label: 'Remettre la phase courante à zéro ?', action: () => sessionAction('reset') })}
                  disabled={!!loading}
                  className="mt-2 w-full py-2 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-all"
                >
                  Réinitialiser la phase
                </button>
              )}
            </Section>

            {/* Intervenants */}
            <Section title="Temps de parole">
              <PanelistManager panelists={panelists} onUpdate={setPanelists} />
            </Section>

          </div>

          {/* ── Colonne droite : Phases + Templates + Flash ── */}
          <div className="space-y-5">

            {/* Phases en cours */}
            {hasSession && (
              <Section title={`Phases — ${sessionState!.sessionName}`}>
                <div className="space-y-1">
                  {sessionState!.phases.map((p, i) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                        i === sessionState!.currentPhaseIndex
                          ? 'bg-blue-50 border border-blue-200 text-blue-800 font-semibold'
                          : i < sessionState!.currentPhaseIndex
                            ? 'text-gray-400 line-through'
                            : 'text-gray-600 bg-gray-50'
                      }`}
                    >
                      <span className="w-6 text-center text-xs font-mono text-gray-400">{i + 1}</span>
                      <span className="flex-1">{p.name}</span>
                      <span className="text-xs text-gray-400">{Math.floor(p.duration / 60)} min</span>
                      {i === sessionState!.currentPhaseIndex && (
                        <span className="text-blue-500 text-xs font-bold">◀ en cours</span>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setConfirmAction({
                    label: 'Supprimer la session en cours ? Les phases seront perdues.',
                    action: () => sessionAction('delete'),
                  })}
                  disabled={!!loading}
                  className="mt-3 w-full py-2 text-sm text-red-500 border border-red-200 hover:bg-red-50 rounded-lg font-medium transition-all disabled:opacity-50"
                >
                  Supprimer la session
                </button>
              </Section>
            )}

            {/* Configuration des phases */}
            <Section title="Configurer les phases">
              <SessionSetup onSetupComplete={() => {}} />
            </Section>

            {/* Templates */}
            <Section title="Templates de session">
              <TemplateManager onSessionLoaded={() => {}} />
            </Section>

            {/* Message flash */}
            <Section title="Message flash → écran public">
              <div className="space-y-3">
                <textarea
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  placeholder="Ex: Merci de conclure… / 1 question maximum"
                  maxLength={120}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                />
                <div className="flex gap-2">
                  <select
                    value={messageDuration}
                    onChange={e => setMessageDuration(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value={5}>5 s</option>
                    <option value={10}>10 s</option>
                    <option value={30}>30 s</option>
                    <option value={0}>Permanent</option>
                  </select>
                  <button
                    onClick={() => {
                      if (!messageText.trim()) return;
                      timerAction('message', { text: messageText.trim(), duration: messageDuration });
                      setMessageText('');
                    }}
                    disabled={!!loading || !messageText.trim()}
                    className="flex-1 py-2 font-semibold text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-all"
                  >
                    {loading === 'message' ? '...' : 'Envoyer'}
                  </button>
                  <button
                    onClick={() => timerAction('message/clear')}
                    disabled={!!loading}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-all text-sm font-medium"
                  >
                    Effacer
                  </button>
                </div>
              </div>
            </Section>

          </div>
        </div>
      </div>
    </>
  );
}
