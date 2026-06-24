'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getSocket } from '@/lib/socket';
import { apiCall } from '@/lib/api';
import SessionSetup from './SessionSetup';
import PanelistManager, { PanelistInfo } from './PanelistManager';
import TemplateManager from './TemplateManager';

function copyToClipboard(text: string): void {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text: string): void {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

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

interface VoteQuestion {
  id: number;
  code: string;
  question: string;
  isActive: boolean;
  isClosed: boolean;
  showResults: boolean;
  multiChoice: boolean;
  closesAt: string | null;
  options: { id: number; label: string; order: number }[];
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8006';

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

function QRModal({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-800 text-center leading-snug">{label}</h2>
        <div className="p-3 bg-white rounded-xl border-2 border-gray-100 shadow-inner">
          <QRCodeSVG value={url} size={220} level="M" />
        </div>
        <p className="text-xs text-gray-400 font-mono text-center break-all">{url}</p>
        <div className="flex gap-3 w-full">
          <button
            onClick={copy}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              copied ? 'bg-green-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {copied ? '✓ Copié !' : 'Copier le lien'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body
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
  const [panelistsPanelVisible, setPanelistsPanelVisible] = useState(false);
  const [panelistsAgVisible, setPanelistsAgVisible] = useState(false);
  const [preshowVisible, setPreshowVisible] = useState(false);
  const [commencerVisible, setCommencerVisible] = useState(false);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [panelPoster, setPanelPoster] = useState<{ url: string | null; visible: boolean }>({ url: null, visible: false });
  const [posterUploading, setPosterUploading] = useState(false);
  const [voteQuestions, setVoteQuestions] = useState<VoteQuestion[]>([]);
  const [voteNewQuestion, setVoteNewQuestion] = useState('');
  const [voteNewOptions, setVoteNewOptions] = useState(['', '']);
  const [voteNewMultiChoice, setVoteNewMultiChoice] = useState(false);
  const [voteLoading, setVoteLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'compteur' | 'vote'>('compteur');
  const [qrModal, setQrModal] = useState<{ url: string; label: string } | null>(null);
  const [voteTimers, setVoteTimers] = useState<Record<number, number>>({});
  const [votePage, setVotePage] = useState(0);
  const VOTE_PAGE_SIZE = 5;
  const [editingQuestion, setEditingQuestion] = useState<VoteQuestion | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editOptions, setEditOptions] = useState(['', '']);
  const [editMultiChoice, setEditMultiChoice] = useState(false);

  useEffect(() => {
    const totalPages = Math.ceil(voteQuestions.length / VOTE_PAGE_SIZE);
    if (votePage >= totalPages && totalPages > 0) setVotePage(totalPages - 1);
    if (voteQuestions.length === 0) setVotePage(0);
  }, [voteQuestions.length, voteQuestions, votePage]);

  useEffect(() => {
    apiCall('/auth/me')
      .then(() => {
        setAuthChecked(true);
        const socket = getSocket();
        socket.on('session_state', (data: SessionState) => setSessionState(data));
        socket.on('panelist_update', (data: PanelistInfo[]) => setPanelists(data));
        socket.on('panelists_panel', (v: boolean) => setPanelistsPanelVisible(v));
        socket.on('panelists_ag', (v: boolean) => setPanelistsAgVisible(v));
        socket.on('preshow', (v: boolean) => setPreshowVisible(v));
        socket.on('commencer', (v: boolean) => setCommencerVisible(v));
        socket.on('background_image', (url: string | null) => setBackgroundImageUrl(url));
        socket.on('panel_poster', (state: { url: string | null; visible: boolean }) => setPanelPoster(state));
        socket.on('vote_question', () => {
          apiCall<VoteQuestion[]>('/vote').then(setVoteQuestions).catch(() => {});
        });
        apiCall<VoteQuestion[]>('/vote').then(setVoteQuestions).catch(() => {});
      })
      .catch(() => router.push('/admin/login'));

    return () => {
      const socket = getSocket();
      socket.off('session_state');
      socket.off('panelist_update');
      socket.off('panelists_panel');
      socket.off('panelists_ag');
      socket.off('preshow');
      socket.off('commencer');
      socket.off('background_image');
      socket.off('panel_poster');
      socket.off('vote_question');
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

  const voteAction = async (path: string, method = 'POST', body?: object) => {
    setVoteLoading(path);
    try {
      await apiCall(path, { method, body: body ? JSON.stringify(body) : undefined });
      const questions = await apiCall<VoteQuestion[]>('/vote');
      setVoteQuestions(questions);
      showFeedback('Opération réussie');
    } catch (err) {
      const e = err as ApiError;
      showFeedback(e.message || 'Erreur serveur', false);
    } finally {
      setVoteLoading(null);
    }
  };

  const handleExportCsv = async (q: VoteQuestion) => {
    const res = await fetch(`${API}/vote/${q.id}/export`, { credentials: 'include' });
    if (!res.ok) { showFeedback('Erreur export CSV', false); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vote_${q.code}_resultats.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      {qrModal && (
        <QRModal url={qrModal.url} label={qrModal.label} onClose={() => setQrModal(null)} />
      )}

      <div className="min-h-screen bg-slate-100 flex flex-col">

        {/* Header */}
        <header className="bg-gradient-to-r from-blue-700 to-indigo-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-white">Administration</h1>
            <p className="text-blue-200 text-xs">
              {hasSession ? sessionState!.sessionName : 'Aucune session configurée'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(['compteur', 'vote'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-semibold transition-all ${
                  activeTab === tab
                    ? 'bg-white text-blue-700 rounded-t-lg rounded-b-none'
                    : 'rounded-lg text-blue-200 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab === 'compteur' ? '⏱ Compteur' : '🗳️ Vote'}
              </button>
            ))}
            <div className="w-px h-6 bg-blue-500 mx-1" />
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
        <div className={`flex-1 p-6 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start bg-white shadow-sm rounded-b-xl -mt-px ${activeTab !== 'compteur' ? 'hidden' : ''}`}>

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
              <PanelistManager panelists={panelists} onUpdate={setPanelists} phases={sessionState?.phases ?? []} />
            </Section>

            {/* Affiche Panel en cours */}
            <Section title="Affiche Panel en cours">
              <div className="space-y-3">
                {panelPoster.url && (
                  <div className="relative rounded-lg overflow-hidden border border-gray-200" style={{ height: '120px' }}>
                    <img
                      src={`${API}${panelPoster.url}`}
                      alt="Affiche Panel"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={async () => {
                        await apiCall('/timer/panel-poster/clear', { method: 'POST' });
                      }}
                      className="absolute top-2 right-2 w-7 h-7 bg-red-600 hover:bg-red-700 text-white rounded-full text-sm font-bold flex items-center justify-center shadow-lg transition-all"
                      title="Supprimer l'affiche"
                    >
                      ×
                    </button>
                  </div>
                )}
                <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border-2 border-dashed cursor-pointer transition-all text-sm font-medium ${
                  posterUploading ? 'border-gray-300 text-gray-400' : 'border-blue-300 text-blue-600 hover:border-blue-500 hover:bg-blue-50'
                }`}>
                  <span>{posterUploading ? 'Envoi…' : panelPoster.url ? "Changer l'affiche" : 'Choisir une image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={posterUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setPosterUploading(true);
                      try {
                        const form = new FormData();
                        form.append('image', file);
                        await fetch(`${API}/timer/panel-poster`, {
                          method: 'POST',
                          body: form,
                          credentials: 'include',
                        });
                      } finally {
                        setPosterUploading(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
                {panelPoster.url && (
                  <button
                    onClick={() => timerAction('panel-poster/toggle', { visible: !panelPoster.visible })}
                    className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all ${
                      panelPoster.visible
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {panelPoster.visible ? 'Fermer l\'affiche' : 'Afficher'}
                  </button>
                )}
              </div>
            </Section>

            {/* Panneau intervenants */}
            <Section title="Panneau intervenants → écran public">
              <div className="flex items-center gap-2">
                {/* Drawer compact */}
                <button
                  onClick={() => timerAction('panelists-panel', { visible: !panelistsPanelVisible })}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    panelistsPanelVisible
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {panelistsPanelVisible ? 'Masquer' : 'Afficher 1'}
                </button>
                {/* Affichage Grand */}
                <button
                  onClick={() => timerAction('panelists-ag', { visible: !panelistsAgVisible })}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                    panelistsAgVisible
                      ? 'bg-purple-200 text-purple-800 hover:bg-purple-300'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {panelistsAgVisible ? 'Fermer Afficher 2' : 'Afficher 2'}
                </button>
              </div>
              {/* Avant commencement + Commencer */}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => timerAction('preshow', { visible: !preshowVisible })}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                    preshowVisible
                      ? 'bg-amber-200 text-amber-800 hover:bg-amber-300'
                      : 'bg-amber-500 text-white hover:bg-amber-600'
                  }`}
                >
                  {preshowVisible ? 'Fermer Intervenant' : 'Intervenant'}
                </button>
                <button
                  onClick={() => timerAction('commencer', { visible: !commencerVisible })}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                    commencerVisible
                      ? 'bg-green-200 text-green-800 hover:bg-green-300'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {commencerVisible ? 'Fermer' : 'Intervenant Actif'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                <span className="font-medium text-gray-500">Afficher 1</span> = bandeau bas ·{' '}
                <span className="font-medium text-gray-500">Afficher 2</span> = grille plein écran ·{' '}
                <span className="font-medium text-gray-500">Intervenant</span> = spotlight tournant ·{' '}
                <span className="font-medium text-gray-500">Intervenant Actif</span> = spotlight actif
              </p>
            </Section>

          </div>

          {/* ── Colonne droite : Phases + Templates + Flash ── */}
          <div className="space-y-5">

            {/* Phases en cours */}
            {hasSession && (() => {
              const isCurrentEditable = !sessionState!.isActive;
              return (
              <Section title={`Phases — ${sessionState!.sessionName}`}>
                <div className="space-y-1">
                  {sessionState!.phases.map((p, i) => {
                    const isCurrent = i === sessionState!.currentPhaseIndex;
                    return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isCurrent
                          ? 'bg-blue-50 border border-blue-200 text-blue-800 font-semibold'
                          : i < sessionState!.currentPhaseIndex
                            ? 'text-gray-400 line-through'
                            : 'text-gray-600 bg-gray-50'
                      }`}
                    >
                      <span className="w-5 text-center text-xs font-mono text-gray-400 flex-shrink-0">{i + 1}</span>
                      <input
                        defaultValue={p.name}
                        onBlur={e => {
                          const val = e.target.value.trim();
                          if (val && val !== p.name) {
                            apiCall(`/session/phases/${p.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ name: val }),
                            }).catch(() => showFeedback('Erreur modification nom', false));
                          }
                        }}
                        disabled={!!loading}
                        className={`flex-1 min-w-0 px-2 py-1 rounded border ${
                          isCurrent
                            ? 'border-blue-300 bg-blue-50 text-blue-800 font-semibold'
                            : 'border-transparent bg-transparent text-gray-600'
                        } focus:border-gray-400 focus:bg-white focus:outline-none text-sm disabled:opacity-50`}
                      />
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <input
                          type="number"
                          min={1}
                          defaultValue={Math.floor(p.duration / 60)}
                          disabled={isCurrent && sessionState!.isActive}
                          onBlur={e => {
                            const val = Number(e.target.value);
                            if (val >= 1 && val * 60 !== p.duration) {
                              apiCall(`/session/phases/${p.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ duration: val * 60 }),
                              }).catch(() => showFeedback('Erreur modification durée', false));
                            }
                          }}
                          className={`w-14 px-1.5 py-1 rounded border text-center ${
                            isCurrent && sessionState!.isActive
                              ? 'border-transparent bg-transparent text-gray-400 cursor-not-allowed'
                              : 'border-gray-300 bg-white text-gray-700'
                          } focus:border-gray-400 focus:outline-none text-sm disabled:opacity-50`}
                        />
                        <span className="text-xs text-gray-400">min</span>
                      </div>
                      <button
                        onClick={() => setConfirmAction({
                          label: `Supprimer la phase "${p.name}" ?`,
                          action: async () => {
                            try {
                              await apiCall(`/session/phases/${p.id}`, { method: 'DELETE' });
                              showFeedback('Phase supprimée');
                            } catch {
                              showFeedback('Erreur suppression', false);
                            }
                          },
                        })}
                        disabled={!!loading}
                        className="text-red-400 hover:text-red-600 disabled:opacity-20 text-lg font-bold leading-none px-1 flex-shrink-0"
                        title="Supprimer cette phase"
                      >×</button>
                    </div>
                    );
                  })}
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
              );
            })()}

            {/* Configuration des phases */}
            <Section title={hasSession ? 'Ajouter des phases' : 'Configurer les phases'}>
              <SessionSetup onSetupComplete={() => {}} hasActiveSession={!!hasSession} />
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

            {/* Image de fond écran public */}
            <Section title="Image de fond → écran public">
              <div className="space-y-3">
                {backgroundImageUrl && (
                  <div className="relative rounded-lg overflow-hidden border border-gray-200" style={{ height: '120px' }}>
                    <img
                      src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8006'}${backgroundImageUrl}`}
                      alt="Fond"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={async () => {
                        await apiCall('/timer/background-image/clear', { method: 'POST' });
                      }}
                      className="absolute top-2 right-2 w-7 h-7 bg-red-600 hover:bg-red-700 text-white rounded-full text-sm font-bold flex items-center justify-center shadow-lg transition-all"
                      title="Supprimer l'image"
                    >
                      ×
                    </button>
                  </div>
                )}
                <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border-2 border-dashed cursor-pointer transition-all text-sm font-medium ${
                  bgUploading ? 'border-gray-300 text-gray-400' : 'border-blue-300 text-blue-600 hover:border-blue-500 hover:bg-blue-50'
                }`}>
                  <span>{bgUploading ? 'Envoi…' : backgroundImageUrl ? "Changer l'image" : 'Choisir une image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={bgUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setBgUploading(true);
                      try {
                        const form = new FormData();
                        form.append('image', file);
                        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8006'}/timer/background-image`, {
                          method: 'POST',
                          body: form,
                          credentials: 'include',
                        });
                      } finally {
                        setBgUploading(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
                <p className="text-xs text-gray-400">S'affiche uniquement quand aucune session n'est configurée</p>
              </div>
            </Section>

          </div>
        </div>

        {/* Onglet Vote */}
        <div className={`flex-1 p-6 bg-white shadow-sm rounded-b-xl -mt-px ${activeTab !== 'vote' ? 'hidden' : ''}`}>
          <Section title="Vote en ligne">
              {/* Créer une question */}
              <div className="space-y-3 mb-5">
                <input
                  type="text"
                  value={voteNewQuestion}
                  onChange={e => setVoteNewQuestion(e.target.value)}
                  placeholder="Question de vote…"
                  maxLength={200}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                />
                <div className="space-y-2">
                  {voteNewOptions.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={e => {
                          const next = [...voteNewOptions];
                          next[i] = e.target.value;
                          setVoteNewOptions(next);
                        }}
                        placeholder={`Option ${i + 1}`}
                        maxLength={100}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                      />
                      {voteNewOptions.length > 2 && (
                        <button
                          onClick={() => setVoteNewOptions(voteNewOptions.filter((_, j) => j !== i))}
                          className="px-2 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={voteNewMultiChoice}
                    onChange={e => setVoteNewMultiChoice(e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <span className="text-sm text-gray-600">Réponses multiples (multi-choix)</span>
                </label>
                <div className="flex gap-2">
                  {voteNewOptions.length < 6 && (
                    <button
                      onClick={() => setVoteNewOptions([...voteNewOptions, ''])}
                      className="flex-1 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 font-medium transition-all"
                    >
                      + Option
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      const opts = voteNewOptions.map(o => o.trim()).filter(Boolean);
                      if (!voteNewQuestion.trim() || opts.length < 2) return;
                      await voteAction('/vote', 'POST', { question: voteNewQuestion.trim(), options: opts, multiChoice: voteNewMultiChoice });
                      setVoteNewQuestion('');
                      setVoteNewOptions(['', '']);
                      setVoteNewMultiChoice(false);
                    }}
                    disabled={!!voteLoading || !voteNewQuestion.trim() || voteNewOptions.filter(o => o.trim()).length < 2}
                    className="flex-1 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-all"
                  >
                    {voteLoading === '/vote' ? '...' : 'Créer'}
                  </button>
                </div>
              </div>

              {/* Liste des questions */}
              {voteQuestions.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">Aucune question créée</p>
              ) : (
                <>
                <div className="space-y-3">
                  {voteQuestions.slice(votePage * VOTE_PAGE_SIZE, (votePage + 1) * VOTE_PAGE_SIZE).map(q => (
                    <div key={q.id} className={`rounded-xl border p-4 ${q.isActive ? 'border-blue-300 bg-blue-50' : q.isClosed ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'}`}>
                      <div className="flex items-start gap-2 mb-2">
                        <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                          q.isActive ? 'bg-blue-600 text-white' :
                          q.isClosed ? 'bg-gray-500 text-white' :
                          'bg-gray-200 text-gray-600'
                        }`}>
                          {q.isActive ? 'ACTIF' : q.isClosed ? 'FERMÉ' : 'INACTIF'}
                        </span>
                        {q.multiChoice && (
                          <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                            MULTI
                          </span>
                        )}
                        <p className="text-sm font-semibold text-gray-800 flex-1 leading-snug">{q.question}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <button
                          onClick={() => copyToClipboard(`${window.location.origin}/vote/${q.code}`)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-mono transition-all"
                          title="Copier le lien vote"
                        >
                          🗳️ /vote/{q.code}
                        </button>
                        <button
                          onClick={() => setQrModal({ url: `${window.location.origin}/vote/${q.code}`, label: q.question })}
                          className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all"
                          title="Afficher QR Code vote"
                        >
                          QR Vote
                        </button>
                        <button
                          onClick={() => copyToClipboard(`${window.location.origin}/vote/${q.code}/results`)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-xs font-mono transition-all"
                          title="Copier le lien résultats"
                        >
                          📊 résultats
                        </button>
                        <button
                          onClick={() => setQrModal({ url: `${window.location.origin}/vote/${q.code}/results`, label: `Résultats — ${q.question}` })}
                          className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all"
                          title="Afficher QR Code résultats"
                        >
                          QR Résultats
                        </button>
                        <button
                          onClick={() => window.open(`${window.location.origin}/vote/${q.code}/results`, '_blank')}
                          className="flex items-center gap-1 px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all"
                          title="Ouvrir les résultats en plein écran"
                        >
                          📺 Projeter
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {!q.isActive && !q.isClosed && (
                          <div className="flex items-center gap-1">
                            <select
                              value={voteTimers[q.id] ?? 0}
                              onChange={e => setVoteTimers(prev => ({ ...prev, [q.id]: Number(e.target.value) }))}
                              className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white text-gray-700"
                            >
                              <option value={0}>∞ Sans limite</option>
                              <option value={30}>30 s</option>
                              <option value={60}>1 min</option>
                              <option value={120}>2 min</option>
                              <option value={300}>5 min</option>
                            </select>
                            <button
                              onClick={() => voteAction(`/vote/${q.id}/activate`, 'POST', voteTimers[q.id] ? { durationSeconds: voteTimers[q.id] } : undefined)}
                              disabled={!!voteLoading}
                              className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-all"
                            >
                              Activer
                            </button>
                          </div>
                        )}
                        {q.isActive && (
                          <button
                            onClick={() => setConfirmAction({ label: 'Fermer ce vote ? Les participants ne pourront plus voter.', action: () => voteAction(`/vote/${q.id}/close`) })}
                            disabled={!!voteLoading}
                            className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 transition-all"
                          >
                            Fermer
                          </button>
                        )}
                        {q.isClosed && !q.showResults && (
                          <button
                            onClick={() => voteAction(`/vote/${q.id}/show-results`)}
                            disabled={!!voteLoading}
                            className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-all"
                          >
                            Afficher résultats
                          </button>
                        )}
                        {q.showResults && (
                          <button
                            onClick={() => voteAction(`/vote/${q.id}/hide-results`)}
                            disabled={!!voteLoading}
                            className="px-3 py-1.5 text-xs font-bold bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-40 transition-all"
                          >
                            Masquer résultats
                          </button>
                        )}
                        {q.isClosed && (
                          <>
                            <button
                              onClick={() => handleExportCsv(q)}
                              className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-all"
                              title="Télécharger les résultats en CSV"
                            >
                              ⬇ CSV
                            </button>
                            <button
                              onClick={() => setConfirmAction({ label: 'Réinitialiser tous les votes de cette question ?', action: () => voteAction(`/vote/${q.id}/reset`) })}
                              disabled={!!voteLoading}
                              className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 disabled:opacity-40 transition-all"
                            >
                              Réinitialiser
                            </button>
                          </>
                        )}
                        {!q.isActive && !q.isClosed && (
                          <button
                            onClick={() => {
                              setEditingQuestion(q);
                              setEditQuestion(q.question);
                              setEditOptions(q.options.map(o => o.label));
                              setEditMultiChoice(q.multiChoice);
                            }}
                            disabled={!!voteLoading}
                            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 disabled:opacity-40 transition-all"
                          >
                            ✏️ Modifier
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmAction({
                            label: 'Supprimer cette question de vote ?',
                            action: () => voteAction(`/vote/${q.id}`, 'DELETE'),
                          })}
                          disabled={!!voteLoading}
                          className="px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-40 transition-all"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {voteQuestions.length > VOTE_PAGE_SIZE && (
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <button
                      onClick={() => setVotePage(p => Math.max(0, p - 1))}
                      disabled={votePage === 0}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-30 transition-all"
                    >
                      ← Précédent
                    </button>
                    <span className="text-xs text-gray-500">
                      {Math.min(votePage * VOTE_PAGE_SIZE + 1, voteQuestions.length)}–{Math.min((votePage + 1) * VOTE_PAGE_SIZE, voteQuestions.length)} / {voteQuestions.length}
                    </span>
                    <button
                      onClick={() => setVotePage(p => Math.min(Math.ceil(voteQuestions.length / VOTE_PAGE_SIZE) - 1, p + 1))}
                      disabled={votePage >= Math.ceil(voteQuestions.length / VOTE_PAGE_SIZE) - 1}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-30 transition-all"
                    >
                      Suivant →
                    </button>
                  </div>
                )}
              </>
              )}
              <p className="text-xs text-gray-400 mt-3">
                Cliquez sur un lien pour le copier · chaque question a son URL unique
              </p>
          </Section>
        </div>
      </div>

      {editingQuestion && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setEditingQuestion(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Modifier la question</h2>
            <div className="space-y-3">
              <input
                type="text"
                value={editQuestion}
                onChange={e => setEditQuestion(e.target.value)}
                placeholder="Question de vote…"
                maxLength={200}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
              />
              <div className="space-y-2">
                {editOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={e => {
                        const next = [...editOptions];
                        next[i] = e.target.value;
                        setEditOptions(next);
                      }}
                      placeholder={`Option ${i + 1}`}
                      maxLength={100}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                    />
                    {editOptions.length > 2 && (
                      <button
                        onClick={() => setEditOptions(editOptions.filter((_, j) => j !== i))}
                        className="px-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editMultiChoice}
                  onChange={e => setEditMultiChoice(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <span className="text-sm text-gray-600">Réponses multiples (multi-choix)</span>
              </label>
              <div className="flex gap-2">
                {editOptions.length < 6 && (
                  <button
                    onClick={() => setEditOptions([...editOptions, ''])}
                    className="flex-1 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 font-medium transition-all"
                  >
                    + Option
                  </button>
                )}
                <button
                  onClick={async () => {
                    const opts = editOptions.map(o => o.trim()).filter(Boolean);
                    if (!editQuestion.trim() || opts.length < 2) return;
                    await voteAction(`/vote/${editingQuestion.id}`, 'PATCH', {
                      question: editQuestion.trim(),
                      options: opts,
                      multiChoice: editMultiChoice,
                    });
                    setEditingQuestion(null);
                  }}
                  disabled={!!voteLoading || !editQuestion.trim() || editOptions.filter(o => o.trim()).length < 2}
                  className="flex-1 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-all"
                >
                  {voteLoading === `/vote/${editingQuestion.id}` ? '...' : 'Enregistrer'}
                </button>
                <button
                  onClick={() => setEditingQuestion(null)}
                  className="flex-1 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
