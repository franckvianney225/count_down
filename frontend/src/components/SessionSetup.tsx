'use client';

import { useState } from 'react';
import { apiCall } from '@/lib/api';

interface PhaseInput {
  name: string;
  duration: number; // minutes
}

interface Props {
  onSetupComplete: () => void;
}

export default function SessionSetup({ onSetupComplete }: Props) {
  const [sessionName, setSessionName] = useState('');
  const [phases, setPhases] = useState<PhaseInput[]>([
    { name: '', duration: 30 },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPhase = () =>
    setPhases(prev => [...prev, { name: '', duration: 30 }]);

  const removePhase = (i: number) =>
    setPhases(prev => prev.filter((_, idx) => idx !== i));

  const updatePhase = (i: number, field: keyof PhaseInput, value: string | number) =>
    setPhases(prev =>
      prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p))
    );

  const moveUp = (i: number) => {
    if (i === 0) return;
    setPhases(prev => {
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  };

  const moveDown = (i: number) => {
    setPhases(prev => {
      if (i === prev.length - 1) return prev;
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next;
    });
  };

  const handleSubmit = async () => {
    if (phases.some(p => !p.name.trim())) {
      setError('Chaque phase doit avoir un nom.');
      return;
    }
    if (phases.some(p => p.duration < 1)) {
      setError('La durée minimale est 1 minute.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiCall('/session/setup', {
        method: 'POST',
        body: JSON.stringify({
          name: sessionName.trim() || 'Session',
          phases: phases.map((p, i) => ({
            name: p.name.trim(),
            duration: p.duration * 60,
            order: i,
          })),
        }),
      });
      onSetupComplete();
    } catch {
      setError('Erreur lors de la configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nom de la session
        </label>
        <input
          type="text"
          value={sessionName}
          onChange={e => setSessionName(e.target.value)}
          placeholder="Ex: Conférence 2026"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Phases ({phases.length})
        </label>
        <div className="space-y-2">
          {phases.map((phase, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-xs leading-none"
                >▲</button>
                <button
                  onClick={() => moveDown(i)}
                  disabled={i === phases.length - 1}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-xs leading-none"
                >▼</button>
              </div>
              <span className="text-xs text-gray-400 w-5 text-center font-mono">{i + 1}</span>
              <input
                type="text"
                value={phase.name}
                onChange={e => updatePhase(i, 'name', e.target.value)}
                placeholder="Nom de la phase"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              <div className="relative w-24">
                <input
                  type="number"
                  min={1}
                  value={phase.duration}
                  onChange={e => updatePhase(i, 'duration', Number(e.target.value))}
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 pr-8"
                />
                <span className="absolute inset-y-0 right-2 flex items-center text-gray-400 text-xs">min</span>
              </div>
              <button
                onClick={() => removePhase(i)}
                disabled={phases.length === 1}
                className="text-red-400 hover:text-red-600 disabled:opacity-20 text-lg font-bold leading-none"
                title="Supprimer"
              >×</button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={addPhase}
          className="flex-1 py-2 border border-dashed border-blue-400 text-blue-600 rounded-lg text-sm hover:bg-blue-50 font-medium transition-all"
        >
          + Ajouter une phase
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-all"
        >
          {loading ? '...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
