# Analyse du projet `count_down`

## Vue d'ensemble

Application fullstack de **gestion d'événements en temps réel** — outil professionnel destiné aux conférences, panels et assemblées générales. Permet de gérer le temps, les intervenants, les votes et l'affichage public depuis un tableau de bord admin.

---

## Architecture

```
count_down/
├── backend/           NestJS (Node.js) — API REST + WebSocket
├── frontend/          Next.js 15 / React 19 — UI publique + admin
├── docker-compose.yml PostgreSQL + Backend + Frontend
└── .env               JWT_SECRET, ADMIN_PASSWORD, FRONTEND_URL
```

**Stack :**
- **Backend** : NestJS 10, Prisma 5, PostgreSQL 16, Socket.io 4, JWT (passport)
- **Frontend** : Next.js 15, React 19, Tailwind CSS 3, socket.io-client, qrcode.react
- **Infra** : Docker Compose, ports `8005` (front) / `8006` (back)

---

## Modules backend (`backend/src/`)

| Module | Rôle |
|---|---|
| `auth` | Login admin (mot de passe unique), JWT en cookie httpOnly |
| `timer` | Minuteur simple (start/stop/reset/set-duration) + upload image de fond |
| `session` | Session multi-phases avec navigation prev/next et pause |
| `panelist` | Intervenants avec temps de parole chronométré |
| `template` | Templates de sessions réutilisables |
| `vote` | Votes en ligne avec QR code, fermeture auto, export CSV |

**Communication temps réel :** le `TimerGateway` (WebSocket) diffuse les événements suivants vers tous les clients connectés :

- `timer_state` — état du minuteur global
- `session_state` — état de la session multi-phases
- `panelist_update` — état des intervenants
- `flash_message` — message flash ponctuel
- `preshow` / `commencer` — modes d'affichage des intervenants
- `panelists_panel` / `panelists_ag` — modes panneau intervenants
- `background_image` — image de fond écran public
- `vote_question` / `vote_results` — vote en cours et résultats

---

## Base de données (schéma Prisma)

```
TimerSettings       → minuteur global (durée, restant, actif, image de fond)
EventSession        → session à phases multiples
  └── Phase         → phases ordonnées (nom, durée)
EventTemplate       → templates de sessions réutilisables
  └── TemplatePhase → phases d'un template
Panelist            → intervenants (nom, temps total/utilisé, photo, fonction, structure)
VoteQuestion        → questions de vote (code unique, options, multi-choix, fermeture auto)
  ├── VoteOption    → options de réponse
  └── VoteResponse  → votes avec token anti-doublon unique (token + questionId + optionId)
```

---

## Frontend — Composants clés

| Composant | Rôle |
|---|---|
| `CountdownDisplay.tsx` | **Écran public** — 3 modes : `normal`, `minimal`, `overlay`. Gère horloge, phases, overtime, preshow/spotlight, panéliste actif, flash messages, alertes sonores |
| `AdminDashboard.tsx` | **Tableau de bord admin** — 2 onglets : Compteur + Vote |
| `SessionSetup.tsx` | Configuration des phases de session |
| `PanelistManager.tsx` | Gestion des intervenants (CRUD + chrono) |
| `TemplateManager.tsx` | Gestion des templates de session |

### Routes frontend

| URL | Description |
|---|---|
| `/` | Écran public (CountdownDisplay mode normal) |
| `/admin/login` | Connexion administrateur |
| `/admin` | Tableau de bord admin |
| `/vote/[code]` | Page de vote pour les participants |
| `/vote/[code]/results` | Page de résultats projetable |

---

## Fonctionnalités notables

- **Overtime** : le timer peut devenir négatif (affiché en rouge avec "DÉPASSEMENT")
- **Mode final** : les 60 dernières secondes s'affichent en plein écran avec compteur animé et fond coloré (orange → rouge selon les secondes restantes)
- **Preshow** : rotation automatique spotlight sur les intervenants toutes les 8s
- **Mode Commencer** : spotlight sur l'intervenant actif
- **Mode AG** : grille plein écran de tous les intervenants avec photo
- **Alertes sonores** : Web Audio API — bips à 5 min, 1 min, et à 0 (activé par premier clic utilisateur)
- **Vote avec QR code** : génération d'un code unique par question, QR code pour accès mobile
- **Fermeture auto du vote** : timer optionnel (30s / 1min / 2min / 5min) côté serveur avec `setTimeout`
- **Résultats en direct** : pourcentages recalculés à chaque vote, diffusés via WebSocket
- **Export CSV** : téléchargement des résultats d'un vote fermé
- **Anti-doublon vote** : contrainte unique `(token, questionId, optionId)` en base
- **Image de fond** : upload d'image affiché sur l'écran public quand aucune session n'est active
- **Rate limiting** : ThrottlerModule (5 req / 60s) via `@nestjs/throttler`
- **Tick client-side** : le frontend décrémente localement le timer toutes les secondes pour éviter la latence réseau, resynchronisé à chaque événement WebSocket

---

## Points d'attention / axes d'amélioration

### 1. Rate limiter trop restrictif
Le throttle global de 5 requêtes / 60s (`app.module.ts:13`) peut bloquer l'admin lors d'une navigation rapide entre phases (prev/next/start/stop). Il devrait être relâché ou retiré sur les routes admin authentifiées.

### 2. État WebSocket en mémoire non persisté
Les états `panelistsPanelVisible`, `preshowVisible`, `commencerVisible`, etc. dans `TimerGateway` sont stockés en mémoire. Un redémarrage du serveur les réinitialise tous, désynchronisant l'écran public.

### 3. Duplication des types TypeScript
Les interfaces `SessionState`, `PanelistInfo`, `PhaseInfo`, `VoteQuestionPayload` sont redéfinies dans le backend ET le frontend sans partage. Un package partagé (`packages/types`) éviterait les désynchronisations silencieuses.

### 4. Token anti-doublon côté client
Le token utilisé pour prévenir les doubles votes est généré côté client (facilement forgeable). Il n'est pas lié à une session authentifiée ni à une adresse IP. Un utilisateur motivé peut voter plusieurs fois avec des tokens différents.

### 5. Absence de rate limiting sur les routes de vote public
Les routes `/vote/:id/cast` (vote anonyme) ne semblent pas avoir de protection anti-spam spécifique au-delà du throttle global. Cela expose le vote à du bourrage.

### 6. Chemins hardcodés
Le répertoire d'upload `/app/uploads` est en dur dans `main.ts` et `timer.controller.ts`. Cela fonctionne en Docker mais rend difficile l'exécution en local sans créer le dossier manuellement.

### 7. Pas de reconnexion WebSocket côté frontend
La connexion Socket.io est initialisée une seule fois dans `socket.ts` (singleton). Si la connexion est perdue, il n'y a pas de logique explicite de re-synchronisation de l'état (par exemple, re-fetch de l'état courant après reconnexion).

### 8. `bcrypt` absent — mot de passe en clair comparé
`auth.service.ts` compare le mot de passe directement via `===`. Si `ADMIN_PASSWORD` est compromis (logs, variables d'environnement exposées), il n'y a pas de hachage pour limiter les dégâts.

---

## Flux de données typique

```
Admin → POST /session/start
      → SessionService.start()
      → TimerGateway.broadcastSessionState()
      → Socket.io → tous les clients connectés
      → CountdownDisplay.tsx met à jour son état React
      → Tick local décrémente chaque seconde côté client
```

---

## Démarrage local

```bash
# Démarrer la base de données
docker compose up postgres -d

# Backend
cd backend
npm install
npx prisma migrate dev
npm run start:dev        # http://localhost:8006

# Frontend
cd frontend
npm install
npm run dev              # http://localhost:8005
```

Variables d'environnement nécessaires (`.env` à la racine) :
```
DATABASE_URL=postgresql://countdown_user:countdown_secret@localhost:5437/countdown
JWT_SECRET=your_secret
ADMIN_PASSWORD=admin123
FRONTEND_URL=http://localhost:8005
```
