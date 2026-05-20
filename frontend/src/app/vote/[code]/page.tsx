'use client';

import { useEffect, useState, useCallback } from 'react';
import { use } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getSocket } from '@/lib/socket';

interface VoteOption {
  id: number;
  label: string;
  order: number;
}

interface VoteQuestion {
  id: number;
  code: string;
  closesAt: string | null;
  question: string;
  isActive: boolean;
  isClosed: boolean;
  showResults: boolean;
  multiChoice: boolean;
  options: VoteOption[];
}

function getOrCreateToken(): string {
  let token = localStorage.getItem('vote_token');
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem('vote_token', token);
  }
  return token;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8006';

export default function VotePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [question, setQuestion] = useState<VoteQuestion | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<'idle' | 'loading' | 'voted' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  // Chargement initial par code
  useEffect(() => {
    fetch(`${API}/vote/code/${code}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then(data => { if (data) setQuestion(data); })
      .catch(() => setNotFound(true));
  }, [code]);

  // Socket — on écoute uniquement les events pour CE vote
  useEffect(() => {
    const socket = getSocket();
    socket.emit('join_vote', { code });
    socket.on('vote_question', (data: VoteQuestion | null) => {
      if (!data) return;
      if (data.code === code) setQuestion(data);
    });
    return () => {
      socket.emit('leave_vote', { code });
      socket.off('vote_question');
    };
  }, [code]);

  // Countdown timer
  useEffect(() => {
    if (!question?.isActive || !question.closesAt) { setCountdown(null); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.round((new Date(question.closesAt!).getTime() - Date.now()) / 1000));
      setCountdown(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [question?.closesAt, question?.isActive]);

  // Anti-doublon localStorage
  const hasVoted = question ? !!localStorage.getItem(`voted_${question.id}`) : false;

  const submitVote = useCallback(async () => {
    if (!question || selected.size === 0) return;
    setStatus('loading');
    const token = getOrCreateToken();
    try {
      const res = await fetch(`${API}/vote/${question.id}/cast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, optionIds: Array.from(selected) }),
      });
      if (res.status === 409) {
        localStorage.setItem(`voted_${question.id}`, '1');
        setStatus('voted');
        return;
      }
      if (!res.ok) {
        const d = await res.json();
        setErrorMsg(d.message || 'Erreur');
        setStatus('error');
        return;
      }
      localStorage.setItem(`voted_${question.id}`, '1');
      setStatus('voted');
    } catch {
      setErrorMsg('Erreur réseau');
      setStatus('error');
    }
  }, [question, selected]);

  // États d'affichage
  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">❓</div>
          <p className="text-xl font-medium text-slate-300">Vote introuvable</p>
          <p className="text-sm text-slate-500 mt-2">Ce lien n'existe pas</p>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'voted' || hasVoted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">✅</div>
          <p className="text-2xl font-bold text-green-400 mb-2">Vote enregistré !</p>
          <p className="text-slate-400">Merci pour votre participation</p>
        </div>
      </div>
    );
  }

  if (question.isClosed) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-xl font-medium text-slate-300">Ce vote est terminé</p>
        </div>
      </div>
    );
  }

  if (!question.isActive) {
    const voteUrl = typeof window !== 'undefined' ? `${window.location.origin}/vote/${code}` : '';
    return (
      <div
        className="min-h-screen flex flex-col p-6"
        style={{
          backgroundColor: '#ffffff',
          backgroundImage: `
            radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px),
            radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)
          `,
          backgroundSize: '28px 28px',
          backgroundPosition: '0 0, 14px 14px',
          justifyContent: isFullscreen ? 'center' : 'space-between',
          alignItems: isFullscreen ? 'center' : 'stretch',
        }}
      >
        {!isFullscreen && (
          <div className="text-center pt-16">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-xl font-medium text-slate-700">Vote pas encore ouvert</p>
            <p className="text-sm text-slate-400 mt-2">Restez sur cette page, il s'ouvrira automatiquement</p>
          </div>
        )}
        {voteUrl && (
          <div className={`flex flex-col items-center gap-4 ${isFullscreen ? '' : 'pb-10'}`}>
            {!isFullscreen && (
              <p className="text-xs text-slate-400 uppercase tracking-widest">Scannez pour rejoindre</p>
            )}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-100" style={{ padding: isFullscreen ? '24px' : '12px' }}>
                <QRCodeSVG value={voteUrl} size={isFullscreen ? 520 : 180} level="M" />
              </div>
              <button
                onClick={toggleFullscreen}
                className="absolute -top-3 -right-3 w-8 h-8 bg-slate-700 hover:bg-slate-800 text-white rounded-full flex items-center justify-center shadow-md transition-all"
                title={isFullscreen ? 'Quitter le plein écran' : 'Afficher en plein écran'}
              >
                {isFullscreen ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M15 9h4.5M15 9V4.5M9 15H4.5M9 15v4.5M15 15h4.5M15 15v4.5" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400 font-mono text-center">{voteUrl}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-blue-600 px-6 py-5">
            <div className="flex items-center justify-between mb-3">
              <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wide">
                Vote en cours
              </span>
              {countdown !== null && (
                <span className={`font-mono font-bold text-lg ${countdown <= 10 ? 'text-red-300 animate-pulse' : 'text-white/80'}`}>
                  {Math.floor(countdown / 60).toString().padStart(2, '0')}:{(countdown % 60).toString().padStart(2, '0')}
                </span>
              )}
            </div>
            <h1 className="text-white text-xl font-bold leading-tight">{question.question}</h1>
          </div>

          <div className="p-6 space-y-3">
            {question.multiChoice && (
              <p className="text-xs text-slate-400 text-center -mt-1 mb-1">Plusieurs réponses possibles</p>
            )}
            {question.options.map(opt => {
              const isSelected = selected.has(opt.id);
              const toggle = () => {
                const next = new Set(selected);
                if (question.multiChoice) {
                  if (next.has(opt.id)) next.delete(opt.id); else next.add(opt.id);
                } else {
                  next.clear(); next.add(opt.id);
                }
                setSelected(next);
              };
              return (
                <button
                  key={opt.id}
                  onClick={toggle}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all duration-150 font-medium text-base ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                      : 'border-slate-600 bg-slate-700 text-slate-200 hover:border-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {question.multiChoice ? (
                      <span className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                        isSelected ? 'border-blue-400 bg-blue-500' : 'border-slate-500'
                      }`}>
                        {isSelected && <span className="text-white text-xs font-bold leading-none">✓</span>}
                      </span>
                    ) : (
                      <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        isSelected ? 'border-blue-400 bg-blue-500' : 'border-slate-500'
                      }`}>
                        {isSelected && <span className="w-2 h-2 bg-white rounded-full" />}
                      </span>
                    )}
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>

          {status === 'error' && (
            <div className="mx-6 mb-4 px-4 py-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {errorMsg}
            </div>
          )}

          <div className="px-6 pb-6">
            <button
              onClick={submitVote}
              disabled={selected.size === 0 || status === 'loading'}
              className="w-full py-4 rounded-xl font-bold text-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-lg"
            >
              {status === 'loading' ? 'Envoi...' : 'Voter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
