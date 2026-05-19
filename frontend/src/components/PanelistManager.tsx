'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { apiCall } from '@/lib/api';

export interface PanelistInfo {
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

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function formattemps(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sec < 0 ? '-' : ''}${pad(m)}:${pad(s)}`;
}

function progressPct(p: PanelistInfo): number {
  if (p.totalSeconds === 0) return 0;
  const used = p.totalSeconds - p.remainingSeconds;
  return Math.min(100, Math.max(0, (used / p.totalSeconds) * 100));
}

interface Props {
  panelists: PanelistInfo[];
  onUpdate: (list: PanelistInfo[]) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8006';

export default function PanelistManager({ panelists, onUpdate }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [fonctionInput, setFonctionInput] = useState('');
  const [structureInput, setStructureInput] = useState('');
  const [tempsMin, setTempsMin] = useState(5);
  const [loading, setLoading] = useState<string | null>(null);

  const call = async (path: string, method = 'POST', body?: object) => {
    setLoading(path);
    try {
      const res = await apiCall<PanelistInfo[]>(`/panelists${path}`, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      onUpdate(res);
    } finally {
      setLoading(null);
    }
  };

  const handleAdd = async () => {
    if (!nameInput.trim()) return;
    await call('', 'POST', {
      name: nameInput.trim(),
      totalSeconds: tempsMin * 60,
      fonction: fonctionInput.trim() || undefined,
      structure: structureInput.trim() || undefined,
    });
    setNameInput('');
    setFonctionInput('');
    setStructureInput('');
    setTempsMin(5);
    setModalOpen(false);
  };

  const closeModal = () => {
    setModalOpen(false);
    setNameInput('');
    setFonctionInput('');
    setStructureInput('');
    setTempsMin(5);
  };

  const activeOne = panelists.find(p => p.isActive);

  return (
    <div className="space-y-4">

      {/* Bouton ouvrir modal */}
      <button
        onClick={() => setModalOpen(true)}
        className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
      >
        <span className="text-lg leading-none">+</span>
        Ajouter un intervenant
      </button>

      {/* Modal — rendu dans le body via portal pour couvrir toute la page */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />

          {/* Carte */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5">
            {/* En-tête */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Nouvel intervenant</h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Champ Nom */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Nom <span className="text-red-400">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="Nom complet de l'intervenant"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            {/* Champ Fonction */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Fonction
              </label>
              <input
                type="text"
                value={fonctionInput}
                onChange={e => setFonctionInput(e.target.value)}
                placeholder="ex : Directeur Général, Ministre…"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            {/* Champ Structure */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Structure
              </label>
              <input
                type="text"
                value={structureInput}
                onChange={e => setStructureInput(e.target.value)}
                placeholder="ex : Ministère de l'Éducation, ONG…"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            {/* Champ Temps */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Temps de parole
              </label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={1}
                    value={tempsMin}
                    onChange={e => setTempsMin(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm pr-14 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                  <span className="absolute inset-y-0 right-4 flex items-center text-gray-400 text-sm font-medium pointer-events-none">
                    min
                  </span>
                </div>
                <div className="flex gap-1">
                  {[3, 5, 10, 15].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTempsMin(v)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        tempsMin === v
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={closeModal}
                className="flex-1 py-3 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleAdd}
                disabled={!!loading || !nameInput.trim()}
                className="flex-1 py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {loading === '' ? 'Ajout…' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Liste des panélistes */}
      {panelists.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">Aucun intervenant configuré</p>
      ) : (
        <div className="space-y-2">
          {panelists.map(p => {
            const pct = progressPct(p);
            const overtemps = p.remainingSeconds < 0;
            return (
              <div
                key={p.id}
                className={`rounded-lg border transition-all ${
                  p.isActive
                    ? 'border-green-400 bg-green-50'
                    : overtemps
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-3 px-3 py-2">
                  {/* Indicateur actif */}
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    p.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                  }`} />

                  {/* Photo miniature */}
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                      {p.photoUrl ? (
                        <img src={`${API_URL}${p.photoUrl}`} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-400 text-xs font-bold">{p.name[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <label className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-600">
                      <span className="text-white text-[8px] font-bold">+</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const form = new FormData();
                          form.append('photo', file);
                          setLoading(`photo-${p.id}`);
                          try {
                            const res = await fetch(`${API_URL}/panelists/${p.id}/photo`, {
                              method: 'POST',
                              body: form,
                              credentials: 'include',
                            });
                            const data = await res.json();
                            onUpdate(data);
                          } finally {
                            setLoading(null);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Nom + fonction + structure + temps */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${p.isActive ? 'text-green-800' : 'text-gray-800'}`}>
                      {p.name}
                    </p>
                    {(p.fonction || p.structure) && (
                      <p className="text-xs text-gray-500 truncate">
                        {[p.fonction, p.structure].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className={`text-xs ${overtemps ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                      {overtemps ? `+${formattemps(Math.abs(p.remainingSeconds))} dépassement` : `${formattemps(p.remainingSeconds)} restant`}
                    </p>
                  </div>

                  {/* Boutons */}
                  <div className="flex gap-1 flex-shrink-0">
                    {p.isActive ? (
                      <button
                        onClick={() => call('/stop')}
                        disabled={!!loading}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50 transition-all"
                      >
                        Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => call(`/${p.id}/activate`)}
                        disabled={!!loading}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 transition-all"
                      >
                        Activer
                      </button>
                    )}
                    <button
                      onClick={() => call(`/${p.id}/reset`, 'POST')}
                      disabled={!!loading}
                      title="Remettre à zéro"
                      className="px-2 py-1.5 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 transition-all"
                    >
                      ↺
                    </button>
                    <button
                      onClick={() => call(`/${p.id}`, 'DELETE')}
                      disabled={!!loading}
                      title="Supprimer"
                      className="px-2 py-1.5 text-xs text-red-400 bg-red-50 hover:bg-red-100 rounded-lg disabled:opacity-50 transition-all"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Barre de progression */}
                <div className="h-1 bg-gray-100 rounded-b-lg overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${overtemps ? 'bg-red-500' : p.isActive ? 'bg-green-500' : 'bg-blue-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Actions globales */}
      {panelists.length > 0 && (
        <div className="flex gap-2 pt-1">
          {activeOne && (
            <button
              onClick={() => call('/stop')}
              disabled={!!loading}
              className="flex-1 py-1.5 text-xs text-red-600 border border-red-200 hover:bg-red-50 rounded-lg font-medium transition-all"
            >
              Stopper le chrono
            </button>
          )}
          <button
            onClick={() => call('/reset-all')}
            disabled={!!loading}
            className="flex-1 py-1.5 text-xs text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-lg font-medium transition-all"
          >
            Tout remettre à zéro
          </button>
          <button
            onClick={() => call('/all', 'DELETE')}
            disabled={!!loading}
            className="flex-1 py-1.5 text-xs text-red-600 border border-red-200 hover:bg-red-50 rounded-lg font-medium transition-all"
          >
            Effacer tout
          </button>
        </div>
      )}
    </div>
  );
}
