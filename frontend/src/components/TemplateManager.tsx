'use client';

import { useState, useEffect } from 'react';
import { apiCall } from '@/lib/api';

interface TemplatePhaseInfo {
  name: string;
  duration: number;
  order: number;
}

export interface TemplateInfo {
  id: number;
  name: string;
  createdAt: string;
  phaseCount: number;
  totalDuration: number;
  phases: TemplatePhaseInfo[];
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  return `${m} min`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface Props {
  onSessionLoaded: () => void;
}

export default function TemplateManager({ onSessionLoaded }: Props) {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [nameInput, setNameInput] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    apiCall<TemplateInfo[]>('/templates').then(setTemplates).catch(() => {});
  }, []);

  const call = async <T,>(path: string, method = 'GET', body?: object): Promise<T> => {
    const res = await apiCall<T>(`/templates${path}`, {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
    return res;
  };

  const handleSave = async () => {
    if (!nameInput.trim()) return;
    setLoading('save');
    setError(null);
    try {
      const updated = await call<TemplateInfo[]>('', 'POST', { name: nameInput.trim() });
      setTemplates(updated);
      setNameInput('');
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setLoading(null);
    }
  };

  const handleLoad = async (id: number) => {
    setLoading(`load-${id}`);
    setError(null);
    try {
      await call(`/${id}/load`, 'POST');
      onSessionLoaded();
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message || 'Erreur lors du chargement.');
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (id: number) => {
    setLoading(`delete-${id}`);
    try {
      const updated = await call<TemplateInfo[]>(`/${id}`, 'DELETE');
      setTemplates(updated);
      if (expandedId === id) setExpandedId(null);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">

      {/* Formulaire de sauvegarde */}
      <div>
        <p className="text-xs text-gray-500 mb-2">
          Sauvegarde la session courante (phases configurées) comme template réutilisable.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Nom du template (ex: Conférence 2026)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
          />
          <button
            onClick={handleSave}
            disabled={!!loading || !nameInput.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all whitespace-nowrap"
          >
            {loading === 'save' ? '...' : 'Sauvegarder'}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>

      {/* Liste des templates */}
      {templates.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">Aucun template sauvegardé</p>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* En-tête */}
              <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50">
                <button
                  onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                >
                  <span className="text-sm font-semibold text-gray-800 truncate">{t.name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {t.phaseCount} phase{t.phaseCount > 1 ? 's' : ''} · {formatDuration(t.totalDuration)}
                  </span>
                  <span className="text-gray-300 text-xs ml-auto flex-shrink-0">
                    {expandedId === t.id ? '▲' : '▼'}
                  </span>
                </button>
                <button
                  onClick={() => handleLoad(t.id)}
                  disabled={!!loading}
                  className="px-3 py-1 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 transition-all flex-shrink-0"
                >
                  {loading === `load-${t.id}` ? '...' : 'Charger'}
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={!!loading}
                  className="px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-all flex-shrink-0"
                  title="Supprimer"
                >
                  ×
                </button>
              </div>

              {/* Détail des phases */}
              {expandedId === t.id && (
                <div className="px-3 pb-3 pt-1 border-t border-gray-100 bg-white">
                  <p className="text-xs text-gray-400 mb-2">
                    Créé le {formatDate(t.createdAt)}
                  </p>
                  <div className="space-y-1">
                    {t.phases.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="w-4 text-center text-xs text-gray-400 font-mono">{i + 1}</span>
                        <span className="flex-1">{p.name}</span>
                        <span className="text-xs text-gray-400">{Math.floor(p.duration / 60)} min</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
