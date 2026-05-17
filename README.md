# Compte à Rebours — v2

Application de compte à rebours en temps réel avec panel d'administration.

## Stack technique

| Couche | Technologie | Port |
|--------|-------------|------|
| Frontend | Next.js 15 + TailwindCSS | 8005 |
| Backend | NestJS + Prisma | 8006 |
| Base de données | PostgreSQL 16 | 5437 |

## Lancement avec Docker (recommandé)

```bash
# Copier et configurer les variables d'environnement
cp .env.example .env

# Lancer tous les services
docker compose up --build

# Accès
# Frontend : http://localhost:8005
# Admin    : http://localhost:8005/admin/login
# API      : http://localhost:8006
```

## Lancement en développement local

### Prérequis
- Node.js 20+
- PostgreSQL 16 en cours d'exécution sur le port 5437

### Backend

```bash
cd backend
npm install
cp .env .env.local   # adapter si besoin
npx prisma migrate dev --name init
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Fonctionnalités

- Affichage temps réel (HH:MM:SS) synchronisé via WebSocket
- Mode dramatique plein-écran pour les 60 dernières secondes
- Changement de couleur : noir → orange (30s) → rouge (10s)
- Panel admin protégé par JWT :
  - Définir la durée
  - Démarrer / Arrêter (pause)
  - Réinitialiser
- État du timer persisté en base de données (reconnexion correcte)

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `ADMIN_PASSWORD` | Mot de passe admin | `admin123` |
| `JWT_SECRET` | Clé secrète JWT | — |
| `FRONTEND_URL` | URL CORS autorisée | `http://localhost:8005` |
| `NEXT_PUBLIC_API_URL` | URL de l'API (frontend) | `http://localhost:8006` |

## Structure du projet

```
count_down/
├── backend/                # NestJS
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── auth/           # JWT, login
│   │   ├── timer/          # Service, Gateway WS, Controller
│   │   └── prisma/         # Client Prisma
│   └── Dockerfile
├── frontend/               # Next.js
│   ├── src/
│   │   ├── app/            # Pages (App Router)
│   │   ├── components/     # CountdownDisplay, AdminDashboard, AdminLoginForm
│   │   └── lib/            # socket.ts, api.ts
│   └── Dockerfile
└── docker-compose.yml
```
