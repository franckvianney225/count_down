'use client';

import { useEffect, useState, useCallback } from 'react';
import { use } from 'react';
import { getSocket } from '@/lib/socket';

interface VoteOption {
  id: number;
  label: string;
  order: number;
}

interface VoteQuestion {
  id: number;
  code: string;
  question: string;
  isActive: boolean;
  isClosed: boolean;
  showResults: boolean;
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
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'voted' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

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
    socket.on('vote_question', (data: VoteQuestion | null) => {
      if (!data) return;
      if (data.code === code) setQuestion(data);
    });
    return () => { socket.off('vote_question'); };
  }, [code]);

  // Anti-doublon localStorage
  const hasVoted = question ? !!localStorage.getItem(`voted_${question.id}`) : false;

  const submitVote = useCallback(async () => {
    if (!question || selected === null) return;
    setStatus('loading');
    const token = getOrCreateToken();
    try {
      const res = await fetch(`${API}/vote/${question.id}/cast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, optionId: selected }),
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
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-xl font-medium text-slate-300">Vote pas encore ouvert</p>
          <p className="text-sm text-slate-500 mt-2">Restez sur cette page, il s'ouvrira automatiquement</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-blue-600 px-6 py-5">
            <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wide">
              Vote en cours
            </span>
            <h1 className="text-white text-xl font-bold leading-tight mt-3">{question.question}</h1>
          </div>

          <div className="p-6 space-y-3">
            {question.options.map(opt => (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all duration-150 font-medium text-base ${
                  selected === opt.id
                    ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                    : 'border-slate-600 bg-slate-700 text-slate-200 hover:border-slate-400'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    selected === opt.id ? 'border-blue-400 bg-blue-500' : 'border-slate-500'
                  }`}>
                    {selected === opt.id && <span className="w-2 h-2 bg-white rounded-full" />}
                  </span>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>

          {status === 'error' && (
            <div className="mx-6 mb-4 px-4 py-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {errorMsg}
            </div>
          )}

          <div className="px-6 pb-6">
            <button
              onClick={submitVote}
              disabled={selected === null || status === 'loading'}
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
