'use client';

import { useEffect, useRef, useState } from 'react';
import { use } from 'react';
import { getSocket } from '@/lib/socket';

interface VoteResultOption {
  id: number;
  label: string;
  count: number;
  percentage: number;
}

interface VoteResults {
  questionId: number;
  code: string;
  question: string;
  total: number;
  isClosed: boolean;
  showResults: boolean;
  options: VoteResultOption[];
}

const BAR_COLORS = [
  { bg: '#3b82f6', light: '#93c5fd' },
  { bg: '#10b981', light: '#6ee7b7' },
  { bg: '#f59e0b', light: '#fcd34d' },
  { bg: '#8b5cf6', light: '#c4b5fd' },
  { bg: '#f43f5e', light: '#fda4af' },
  { bg: '#06b6d4', light: '#67e8f9' },
];

const MAX_BAR_PX = 300;
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8006';

export default function VoteResultsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [results, setResults] = useState<VoteResults | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [barHeights, setBarHeights] = useState<Record<number, number>>({});
  const isFirst = useRef(true);

  const applyHeights = (data: VoteResults) => {
    const next: Record<number, number> = {};
    data.options.forEach(o => {
      next[o.id] = (o.percentage / 100) * MAX_BAR_PX;
    });
    return next;
  };

  // Chargement initial
  useEffect(() => {
    fetch(`${API}/vote/code/${code}/results`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data: VoteResults | null) => {
        if (!data) return;
        setResults(data);
        const zeros: Record<number, number> = {};
        data.options.forEach(o => { zeros[o.id] = 0; });
        setBarHeights(zeros);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          setBarHeights(applyHeights(data));
          isFirst.current = false;
        }));
      })
      .catch(() => setNotFound(true));
  }, [code]);

  // Socket — on filtre par code
  useEffect(() => {
    const socket = getSocket();
    socket.on('vote_results', (data: VoteResults | null) => {
      if (!data || data.code !== code) return;
      setResults(data);
      if (isFirst.current) {
        const zeros: Record<number, number> = {};
        data.options.forEach(o => { zeros[o.id] = 0; });
        setBarHeights(zeros);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          setBarHeights(applyHeights(data));
          isFirst.current = false;
        }));
      } else {
        setBarHeights(applyHeights(data));
      }
    });
    return () => { socket.off('vote_results'); };
  }, [code]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">❓</div>
          <p className="text-xl text-slate-400">Vote introuvable</p>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-7xl mb-6">📊</div>
          <p className="text-2xl text-slate-400 font-light">En attente des résultats...</p>
        </div>
      </div>
    );
  }

  const winner = results.isClosed
    ? results.options.reduce((a, b) => a.count >= b.count ? a : b, results.options[0])
    : null;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 gap-10">

      <div className="text-center max-w-3xl">
        <span className={`inline-block text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest mb-4 ${
          results.isClosed
            ? 'bg-slate-700 text-slate-300'
            : 'bg-emerald-800 text-emerald-300 animate-pulse'
        }`}>
          {results.isClosed ? 'Vote terminé' : 'Vote en cours'}
        </span>
        <h1 className="text-white text-3xl md:text-4xl font-bold leading-tight">{results.question}</h1>
        <p className="text-slate-400 mt-3 text-lg">
          {results.total} vote{results.total !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="w-full max-w-4xl px-4">
        <div
          className="flex items-end justify-center gap-4 md:gap-6 border-b border-slate-700"
          style={{ height: `${MAX_BAR_PX + 60}px` }}
        >
          {results.options.map((opt, i) => {
            const color = BAR_COLORS[i % BAR_COLORS.length];
            const h = barHeights[opt.id] ?? 0;
            const isWinner = winner?.id === opt.id && opt.count > 0;

            return (
              <div key={opt.id} className="flex-1 min-w-0 flex flex-col items-center justify-end">
                <div className="text-center mb-2">
                  <span className="block text-white font-bold text-2xl leading-none">
                    {opt.percentage}%
                  </span>
                  <span className="block text-slate-400 text-xs mt-0.5">
                    {opt.count} vote{opt.count !== 1 ? 's' : ''}
                  </span>
                </div>

                <div
                  className="w-full rounded-t-2xl relative"
                  style={{
                    height: `${h}px`,
                    minHeight: h > 0 ? '6px' : '0px',
                    transition: 'height 700ms cubic-bezier(0.4, 0, 0.2, 1)',
                    background: isWinner
                      ? `linear-gradient(to top, ${color.bg}, ${color.light})`
                      : color.bg,
                    boxShadow: isWinner ? `0 0 32px ${color.bg}99` : 'none',
                  }}
                >
                  {isWinner && (
                    <div className="absolute -top-8 left-0 right-0 flex justify-center">
                      <span className="text-2xl">🏆</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-center gap-4 md:gap-6 mt-4">
          {results.options.map((opt, i) => {
            const color = BAR_COLORS[i % BAR_COLORS.length];
            return (
              <div key={opt.id} className="flex-1 min-w-0 text-center">
                <div className="w-4 h-1 rounded-full mx-auto mb-1.5" style={{ background: color.bg }} />
                <p className="text-slate-300 text-sm font-medium leading-snug line-clamp-2">
                  {opt.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
