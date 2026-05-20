# Implémentation — Système de Vote Temps Réel

## Vue d'ensemble

Système de vote en ligne intégré au projet `count_down`, avec pages dédiées indépendantes du compteur.  
Technologie partagée : NestJS backend, Prisma/PostgreSQL, Socket.io, Next.js 15.

---

## 1. BASE DE DONNÉES — Prisma Schema

### 1.1 Nouveau modèle `VoteQuestion`
```prisma
model VoteQuestion {
  id          Int          @id @default(autoincrement())
  question    String
  isActive    Boolean      @default(false)
  isClosed    Boolean      @default(false)
  showResults Boolean      @default(false)
  createdAt   DateTime     @default(now())
  options     VoteOption[]
  responses   VoteResponse[]

  @@map("vote_questions")
}
```
Champs :
- `question` — texte de la question posée
- `isActive` — vote ouvert aux participants (un seul actif à la fois)
- `isClosed` — vote terminé, plus de réponses acceptées
- `showResults` — résultats visibles sur la page publique `/vote/results`

### 1.2 Nouveau modèle `VoteOption`
```prisma
model VoteOption {
  id         Int           @id @default(autoincrement())
  label      String
  order      Int           @default(0)
  questionId Int
  question   VoteQuestion  @relation(fields: [questionId], references: [id], onDelete: Cascade)
  responses  VoteResponse[]

  @@map("vote_options")
}
```
Champs :
- `label` — texte de l'option (ex: "Oui", "Non", "Peut-être")
- `order` — ordre d'affichage

### 1.3 Nouveau modèle `VoteResponse`
```prisma
model VoteResponse {
  id         Int         @id @default(autoincrement())
  token      String      // token localStorage de l'appareil
  questionId Int
  optionId   Int
  createdAt  DateTime    @default(now())
  question   VoteQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  option     VoteOption   @relation(fields: [optionId], references: [id], onDelete: Cascade)

  @@unique([token, questionId])   // un seul vote par appareil par question
  @@map("vote_responses")
}
```
Champs :
- `token` — identifiant unique de l'appareil (UUID généré côté client, stocké en localStorage)
- `@@unique([token, questionId])` — contrainte DB anti-doublon

### 1.4 Migration SQL
Fichier : `backend/prisma/migrations/20260520000000_add_vote_system/migration.sql`
```sql
CREATE TABLE "vote_questions" (
  "id" SERIAL PRIMARY KEY,
  "question" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "isClosed" BOOLEAN NOT NULL DEFAULT false,
  "showResults" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "vote_options" (
  "id" SERIAL PRIMARY KEY,
  "label" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "questionId" INTEGER NOT NULL,
  CONSTRAINT "vote_options_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "vote_questions"("id") ON DELETE CASCADE
);

CREATE TABLE "vote_responses" (
  "id" SERIAL PRIMARY KEY,
  "token" TEXT NOT NULL,
  "questionId" INTEGER NOT NULL,
  "optionId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vote_responses_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "vote_questions"("id") ON DELETE CASCADE,
  CONSTRAINT "vote_responses_optionId_fkey"
    FOREIGN KEY ("optionId") REFERENCES "vote_options"("id") ON DELETE CASCADE,
  CONSTRAINT "vote_responses_token_questionId_key"
    UNIQUE ("token", "questionId")
);
```

---

## 2. BACKEND — Module NestJS `vote`

### 2.1 Fichiers créés
```
backend/src/vote/
├── vote.module.ts
├── vote.service.ts
├── vote.controller.ts
└── dto/
    ├── create-question.dto.ts
    └── cast-vote.dto.ts
```

### 2.2 DTOs

**`create-question.dto.ts`**
```typescript
{
  question: string        // @IsString @IsNotEmpty
  options: string[]       // @IsArray @ArrayMinSize(2) @ArrayMaxSize(6)
}
```

**`cast-vote.dto.ts`**
```typescript
{
  token: string    // @IsString @IsNotEmpty — UUID appareil
  optionId: number // @IsInt
}
```

### 2.3 `VoteService` — méthodes

| Méthode | Description |
|---|---|
| `createQuestion(dto)` | Crée une question avec ses options |
| `getAll()` | Liste toutes les questions (admin) |
| `getActive()` | Retourne la question active + ses options + comptes de votes |
| `activate(id)` | Active une question (désactive la précédente) |
| `close(id)` | Ferme le vote pour cette question |
| `toggleResults(id, show)` | Affiche/masque les résultats sur la page publique |
| `castVote(questionId, dto)` | Enregistre un vote (vérifie unicité token+question) |
| `getResults(questionId)` | Retourne les résultats avec comptage par option |
| `deleteQuestion(id)` | Supprime une question et ses données |
| `resetQuestion(id)` | Supprime toutes les réponses d'une question |

**Format retour `getResults()`**
```typescript
{
  questionId: number
  question: string
  total: number
  isClosed: boolean
  showResults: boolean
  options: Array<{
    id: number
    label: string
    count: number
    percentage: number  // arrondi à 1 décimale
  }>
}
```

### 2.4 `VoteController` — routes

Toutes les routes admin sont protégées par `@UseGuards(JwtAuthGuard)`.

| Méthode | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/vote/active` | ❌ public | Question active (pour la page votant) |
| `POST` | `/vote/:id/cast` | ❌ public | Voter sur une question |
| `GET` | `/vote/:id/results` | ❌ public | Résultats d'une question |
| `GET` | `/vote` | ✅ admin | Liste toutes les questions |
| `POST` | `/vote` | ✅ admin | Créer une question |
| `POST` | `/vote/:id/activate` | ✅ admin | Activer une question |
| `POST` | `/vote/:id/close` | ✅ admin | Fermer le vote |
| `POST` | `/vote/:id/show-results` | ✅ admin | Afficher résultats publiquement |
| `POST` | `/vote/:id/hide-results` | ✅ admin | Masquer résultats |
| `POST` | `/vote/:id/reset` | ✅ admin | Remettre les votes à zéro |
| `DELETE` | `/vote/:id` | ✅ admin | Supprimer une question |

### 2.5 `vote.module.ts`
- Import `PrismaModule`, `TimerGateway` (pour broadcast socket)
- Export `VoteService`

---

## 3. SOCKET.IO — Événements temps réel

### 3.1 Nouveaux événements broadcast (gateway existant `timer.gateway.ts`)

| Événement | Payload | Déclenché quand |
|---|---|---|
| `vote_question` | `{ id, question, options[], isActive, isClosed }` ou `null` | question activée/fermée/supprimée |
| `vote_results` | `{ questionId, total, options[{ id, label, count, percentage }] }` ou `null` | à chaque vote reçu, quand résultats affichés/masqués |
| `vote_status` | `{ isActive, isClosed, showResults }` | changement d'état de la question |

### 3.2 Émission à la connexion (`handleConnection`)
- `client.emit('vote_question', currentActiveQuestion)` — état initial
- `client.emit('vote_results', currentResults)` — résultats en cours si `showResults = true`

### 3.3 Nouvelles méthodes dans `TimerGateway`
```typescript
broadcastVoteQuestion(data: VoteQuestionPayload | null)
broadcastVoteResults(data: VoteResultsPayload | null)
```

---

## 4. FRONTEND — Pages et composants

### 4.1 Page votant `/vote`

**Fichier :** `frontend/src/app/vote/page.tsx`

**Comportement :**
1. Au chargement : génère ou récupère un UUID depuis `localStorage` (`vote_token`)
2. Se connecte au socket et écoute `vote_question`
3. Si aucune question active → affiche "Aucun vote en cours"
4. Si question active :
   - Affiche le texte de la question
   - Affiche les boutons d'options
   - Si déjà voté (vérifié via `localStorage` clé `voted_${questionId}`) → affiche "Vous avez déjà voté"
5. Au clic sur une option :
   - Appel `POST /vote/:id/cast` avec `{ token, optionId }`
   - Sauvegarde `voted_${questionId} = optionId` dans `localStorage`
   - Affiche animation de confirmation "Merci pour votre vote !"
6. Si `showResults = true` → affiche mini-histogramme inline sur la page votant aussi

**Design :** Mobile-first, sobre, centré, grand texte lisible.

**Composants internes :**
- `VoteCard` — affiche question + boutons options
- `VoteConfirmation` — animation confirmation
- `VoteClosed` — message vote fermé
- `VoteWaiting` — message aucun vote en cours

### 4.2 Page résultats `/vote/results`

**Fichier :** `frontend/src/app/vote/results/page.tsx`

**Comportement :**
1. Se connecte au socket, écoute `vote_results` et `vote_question`
2. Si `showResults = false` → fond noir, "En attente des résultats…"
3. Si `showResults = true` :
   - Affiche le texte de la question en titre
   - Histogramme animé avec barres horizontales ou verticales
   - Compteur total de votes
   - Chaque barre se met à jour en temps réel à chaque nouveau vote
   - Pourcentage + nombre de votes affiché sur chaque barre

**Design :**
- Fond sombre (gray-950)
- Barres colorées avec animation `transition-all duration-500`
- Couleurs distinctes par option (bleu, teal, amber, violet, rouge, vert)
- Grand texte de question en haut
- Total votes en bas

### 4.3 Section Admin dans `AdminDashboard.tsx`

**Nouvelle section** "Votes → écran public" dans la colonne droite (après "Image de fond").

**Contenu :**

**Bloc création question :**
- Input texte pour la question
- Champ dynamique pour ajouter des options (min 2, max 6)
  - Bouton "+" pour ajouter une option
  - Bouton "×" pour supprimer une option
- Bouton "Créer le vote"

**Liste des questions existantes :**
- Chaque question affiche :
  - Texte de la question
  - Nombre de votes reçus
  - Statut : badge `En attente` / `Actif` / `Fermé`
  - Boutons d'action :
    - `Activer` (ouvre le vote)
    - `Fermer` (clôture le vote)
    - `Afficher résultats` / `Masquer résultats`
    - `Réinitialiser` (remet les votes à 0, avec confirmation)
    - `Supprimer` (avec confirmation)

**Lien rapide :**
- Lien vers `/vote` (page votant) avec icône pour copier l'URL
- Lien vers `/vote/results` (page résultats)
- QR code textuel de l'URL `/vote` (optionnel phase 2)

---

## 5. ANTI-DOUBLON — Stratégie

### 5.1 Token appareil
- À la première visite sur `/vote`, génère `crypto.randomUUID()` côté client
- Stocké dans `localStorage` sous la clé `vote_token`
- Envoyé avec chaque vote
- Contrainte `@@unique([token, questionId])` en DB bloque les doublons au niveau base de données
- Si doublon → backend retourne `409 Conflict` → frontend affiche "Vous avez déjà voté"

### 5.2 État local
- Après vote, `localStorage` stocke `voted_${questionId}: optionId`
- Évite même l'appel réseau si déjà voté sur cet appareil

### 5.3 Limites connues
- Le token est lié à l'appareil + navigateur (pas cross-browser)
- Vider le localStorage permet de revoter (acceptable pour un usage événementiel)
- Pas d'authentification obligatoire → vote anonyme par design

---

## 6. ORDRE D'IMPLÉMENTATION

```
Étape 1 — Backend DB
  ├── Modifier prisma/schema.prisma (3 nouveaux modèles)
  ├── Créer fichier migration SQL
  └── Appliquer : docker cp + prisma migrate deploy

Étape 2 — Backend service + controller
  ├── Créer vote/dto/create-question.dto.ts
  ├── Créer vote/dto/cast-vote.dto.ts
  ├── Créer vote/vote.service.ts
  ├── Créer vote/vote.controller.ts
  └── Créer vote/vote.module.ts + enregistrer dans app.module.ts

Étape 3 — Socket.io
  ├── Ajouter broadcastVoteQuestion() dans timer.gateway.ts
  ├── Ajouter broadcastVoteResults() dans timer.gateway.ts
  └── Émettre état initial dans handleConnection()

Étape 4 — Rebuild backend
  └── docker compose up --build -d backend

Étape 5 — Frontend page /vote
  ├── Créer app/vote/page.tsx
  └── Créer composants VoteCard, VoteConfirmation, VoteWaiting

Étape 6 — Frontend page /vote/results
  └── Créer app/vote/results/page.tsx avec histogramme

Étape 7 — Admin section vote
  └── Ajouter section dans AdminDashboard.tsx

Étape 8 — Tests
  ├── Créer une question depuis l'admin
  ├── Voter depuis /vote (plusieurs onglets = anti-doublon)
  ├── Vérifier histogramme en temps réel sur /vote/results
  └── Activer/fermer/réinitialiser depuis l'admin
```

---

## 7. CE QUI N'EST PAS INCLUS (phase 2 possible)

- QR code généré automatiquement dans l'admin
- Export CSV des résultats
- Historique des votes par session/événement
- Vote pondéré ou classement (ranking)
- Authentification des votants par email/badge
- Modération des questions (approbation avant publication)

---

## 8. AMÉLIORATIONS IDENTIFIÉES (à implémenter ensemble)

### 8.1 QR Code — Priorité HAUTE
**Problème :** Le lien `/vote/44z5zhbsz` est impossible à taper sur mobile en conditions réelles.  
**Solution :** Générer un QR code dans l'admin pour chaque question, affichable en grand sur projecteur.  
**Technique :** Librairie `qrcode.react` côté frontend, aucun changement backend.  
**Ce qui change :**
- Onglet Vote admin : bouton "Afficher QR" sur chaque question → modal avec QR code en grand
- Le QR code encode `window.location.origin/vote/${q.code}`

---

### 8.2 Timer automatique — Priorité HAUTE
**Problème :** L'admin doit penser à cliquer "Fermer" manuellement, risque d'oubli en conditions réelles.  
**Solution :** Champ optionnel "Durée" à la création (ex: 30s, 1min, 2min). Le backend ferme automatiquement le vote à l'expiration.  
**Technique :**
- Ajouter `closesAt DateTime?` dans `VoteQuestion` (Prisma + migration)
- Lors de `activate(id)`, si `closesAt` défini → lancer un `setTimeout` côté backend qui appelle `close(id)` et broadcast
- Frontend : afficher un compte à rebours sur la page de vote `/vote/[code]`

---

### 8.3 Mode plein écran résultats — Priorité HAUTE
**Problème :** La page `/vote/[code]/results` doit s'afficher sur vidéoprojecteur, le header et les marges sont inutiles.  
**Solution :** Bouton "Plein écran" dans l'admin qui ouvre la page résultats en fullscreen via `document.documentElement.requestFullscreen()`.  
**Ce qui change :**
- Bouton "📺 Projeter" dans l'onglet Vote admin, à côté du lien résultats
- La page résultats détecte `?fullscreen=1` dans l'URL et masque tout sauf l'histogramme

---

### 8.4 Compteur de participants connectés — Priorité MOYENNE
**Problème :** On ne sait pas combien de personnes sont sur la page de vote en temps réel.  
**Solution :** Compter les sockets connectés sur la "room" du vote et broadcaster ce nombre.  
**Technique :**
- Socket.io rooms : quand un client rejoint `/vote/[code]`, il rejoint la room `vote:${code}`
- Backend compte les membres de la room et broadcast `vote_viewers` à chaque join/leave
- Page résultats affiche "X participants connectés"

---

### 8.5 Tri dynamique des barres — Priorité MOYENNE
**Problème :** Les barres restent dans l'ordre de création même si l'option B dépasse l'option A.  
**Solution :** Trier les options par `count` décroissant à chaque mise à jour, avec animation de repositionnement.  
**Technique :** Tri côté frontend dans la page résultats + `transition` CSS sur les positions (`layout` animation).

---

### 8.6 Export CSV — Priorité BASSE
**Problème :** Pas moyen de garder une trace des résultats après l'événement.  
**Solution :** Bouton "Télécharger CSV" dans l'admin sur les questions fermées.  
**Technique :**
- Route backend `GET /vote/:id/export` (admin) qui retourne un CSV
- Frontend : `<a href="/vote/${id}/export" download>`

---

### 8.7 Vote multi-choix — Priorité BASSE
**Problème :** Parfois on veut permettre plusieurs réponses (ex: "Quels sujets vous intéressent ?").  
**Solution :** Champ `multiChoice: boolean` à la création. Le frontend affiche des checkboxes au lieu de radio buttons.  
**Technique :**
- Ajouter `multiChoice Boolean @default(false)` dans `VoteQuestion`
- `castVote` accepte `optionIds: number[]` si multiChoice
- Contrainte anti-doublon : `@@unique([token, questionId, optionId])` au lieu de `@@unique([token, questionId])`

---

### Récapitulatif

| # | Amélioration | Priorité | Complexité | Backend | Frontend |
|---|---|---|---|---|---|
| 8.1 | QR Code | 🔴 Haute | Faible | ❌ | ✅ qrcode.react |
| 8.2 | Timer automatique | 🔴 Haute | Moyenne | ✅ closesAt + setTimeout | ✅ countdown |
| 8.3 | Plein écran résultats | 🔴 Haute | Faible | ❌ | ✅ fullscreen API |
| 8.4 | Compteur participants | 🟡 Moyenne | Moyenne | ✅ socket rooms | ✅ affichage |
| 8.5 | Tri dynamique barres | 🟡 Moyenne | Faible | ❌ | ✅ sort + animation |
| 8.6 | Export CSV | 🟢 Basse | Faible | ✅ route export | ✅ lien download |
| 8.7 | Vote multi-choix | 🟢 Basse | Haute | ✅ schema + logic | ✅ checkboxes |
