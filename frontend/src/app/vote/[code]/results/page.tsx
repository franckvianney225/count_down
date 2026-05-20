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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  // FLIP: translateX offsets applied just before animation to 0
  const [flipOffsets, setFlipOffsets] = useState<Record<number, number>>({});
  const isFirst = useRef(true);
  // Stable color assignment: optionId -> color index (fixed on first data load)
  const colorMap = useRef<Record<number, number>>({});
  // DOM refs for FLIP position measurement
  const barRefs = useRef<Record<number, HTMLDivElement | null>>({});
  // Previous left positions (before sort)
  const prevLeft = useRef<Record<number, number>>({});

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const applyHeights = (data: VoteResults) => {
    const next: Record<number, number> = {};
    data.options.forEach(o => {
      next[o.id] = (o.percentage / 100) * MAX_BAR_PX;
    });
    return next;
  };

  const assignColors = (options: VoteResultOption[]) => {
    options.forEach((o, i) => {
      if (!(o.id in colorMap.current)) colorMap.current[o.id] = i % BAR_COLORS.length;
    });
  };

  const capturePositions = () => {
    Object.entries(barRefs.current).forEach(([id, el]) => {
      if (el) prevLeft.current[Number(id)] = el.getBoundingClientRect().left;
    });
  };

  const runFlip = (sortedIds: number[]) => {
    const deltas: Record<number, number> = {};
    sortedIds.forEach(id => {
      const el = barRefs.current[id];
      if (!el) return;
      const newLeft = el.getBoundingClientRect().left;
      const oldLeft = prevLeft.current[id];
      if (oldLeft !== undefined && Math.abs(oldLeft - newLeft) > 1) {
        deltas[id] = oldLeft - newLeft;
      }
    });
    if (Object.keys(deltas).length === 0) return;
    // Apply inverse offsets instantly (no transition)
    setFlipOffsets(deltas);
    // Next frame: clear offsets → CSS transition animates to 0
    requestAnimationFrame(() => setFlipOffsets({}));
  };

  const handleData = (data: VoteResults, firstLoad: boolean) => {
    assignColors(data.options);

    if (firstLoad) {
      setResults(data);
      const zeros: Record<number, number> = {};
      data.options.forEach(o => { zeros[o.id] = 0; });
      setBarHeights(zeros);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setBarHeights(applyHeights(data));
        isFirst.current = false;
      }));
    } else {
      // Capture positions BEFORE re-render (current sort order)
      capturePositions();
      setResults(data);
      setBarHeights(applyHeights(data));
      // After DOM update (new sort order rendered), run FLIP
      requestAnimationFrame(() => {
        runFlip(data.options.map(o => o.id));
      });
    }
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
        handleData(data, true);
      })
      .catch(() => setNotFound(true));
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // Socket
  useEffect(() => {
    const socket = getSocket();
    socket.on('vote_results', (data: VoteResults | null) => {
      if (!data || data.code !== code) return;
      handleData(data, isFirst.current);
    });
    socket.on('vote_viewers', (data: { code: string; count: number }) => {
      if (data.code === code) setViewerCount(data.count);
    });
    return () => {
      socket.off('vote_results');
      socket.off('vote_viewers');
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Sort options by count descending (stable: ties keep original option order)
  const sortedOptions = [...results.options].sort((a, b) =>
    b.count !== a.count ? b.count - a.count : a.id - b.id
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 gap-10 relative">

      {/* Bouton plein écran */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
        title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
      >
        {isFullscreen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9h4.5M15 9V4.5M15 9l5.25-5.25M9 15H4.5M9 15v4.5M9 15l-5.25 5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
          </svg>
        )}
      </button>

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
        <p className="text-slate-500 mt-1 text-sm flex items-center justify-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {viewerCount} participant{viewerCount !== 1 ? 's' : ''} connecté{viewerCount !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="w-full max-w-4xl px-4">
        <div
          className="flex items-end justify-center gap-4 md:gap-6 border-b border-slate-700"
          style={{ height: `${MAX_BAR_PX + 60}px` }}
        >
          {sortedOptions.map((opt) => {
            const colorIdx = colorMap.current[opt.id] ?? 0;
            const color = BAR_COLORS[colorIdx];
            const h = barHeights[opt.id] ?? 0;
            const isWinner = winner?.id === opt.id && opt.count > 0;
            const offset = flipOffsets[opt.id] ?? 0;

            return (
              <div
                key={opt.id}
                ref={el => { barRefs.current[opt.id] = el; }}
                className="flex-1 min-w-0 flex flex-col items-center justify-end"
                style={{
                  transform: `translateX(${offset}px)`,
                  transition: offset !== 0
                    ? 'none'
                    : 'transform 600ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
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
          {sortedOptions.map((opt) => {
            const colorIdx = colorMap.current[opt.id] ?? 0;
            const color = BAR_COLORS[colorIdx];
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
